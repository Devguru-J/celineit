// Cloudflare Worker (운영): Cron → Apify run 시작 → 완료 webhook/폴링 → 적재. (Queue 미사용 — 무료 플랜)
// - scheduled(): 일일 cron 은 활성 계정의 Apify run 을 시작만 하고, 분단위 cron 은 밀린 run 을 reconcile
// - fetch(): /manual-collect(관리 화면), /webhook(Apify 완료 알림), /health
//
// DB 연결은 Cloudflare Hyperdrive 바인딩으로 Supabase Postgres 에 접속한다.
import { brandAccounts, collectionRuns, createDb } from "@celine/db";
import { ACTIVE_PLATFORMS, META_ADS_DEFAULT_MAX_ITEMS, jstDate, type Platform } from "@celine/shared";
import { and, eq, gt, inArray, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import { ApifyClient } from "./apify";
import { CLAIM_LEASE_MINUTES, finishCollect, startCollect, type CollectAccount } from "./collect";

export interface Env {
  HYPERDRIVE: { connectionString: string };
  APIFY_TOKEN: string;
  APIFY_ACTOR_META_ADS?: string;
  APIFY_ACTOR_INSTAGRAM?: string;
  APIFY_ACTOR_TWITTER?: string;
  APIFY_ACTOR_TIKTOK?: string;
  MAX_ITEMS?: string;
  // Meta Ads 는 run당 비용이 압도적으로 높아 별도로 낮은 상한을 둔다(기본 15).
  META_ADS_MAX_ITEMS?: string;
  MANUAL_COLLECT_SECRET?: string;
  // 이 워커의 공개 URL. Apify 완료 webhook 수신 주소(${PUBLIC_URL}/webhook)에 사용.
  PUBLIC_URL?: string;
}

function actorFor(env: Env, platform: Platform): string | undefined {
  return (env as unknown as Record<string, string | undefined>)[`APIFY_ACTOR_${platform.toUpperCase()}`];
}

// 격일 플랫폼은 epoch 일수 짝수 날에만 수집한다. day-of-month 홀짝이면 31일 달의
// 월말(30→31→1→2)에서 3일 공백이 생기지만, epoch 일수는 엄격히 하루씩 번갈아 든다.
function dueToday(cadence: string, epochDay: number): boolean {
  if (cadence === "every_2d") return epochDay % 2 === 0;
  return true;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function parseMaxItems(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(1, Math.min(200, Math.floor(value)));
}

// 환경변수 정수 파싱. 잘못 설정된 값("", "abc")이 NaN 으로 흘러가면 actor 의
// resultsLimit 이 무효화되어 무제한 수집(비용 폭탄)이 되므로 반드시 fallback 처리.
function envInt(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return value !== undefined && Number.isFinite(n) && n >= 1 ? Math.min(200, Math.floor(n)) : fallback;
}

// 이 워커의 공개 webhook 주소. Apify 가 완료 시 호출한다(외부→워커라 loopback 무관).
function webhookUrlOf(env: Env): string | undefined {
  if (!env.PUBLIC_URL) return undefined;
  const base = env.PUBLIC_URL.replace(/\/$/, "");
  return env.MANUAL_COLLECT_SECRET
    ? `${base}/webhook?secret=${encodeURIComponent(env.MANUAL_COLLECT_SECRET)}`
    : `${base}/webhook`;
}

// Cloudflare Queues 없이(무료 플랜) 각 계정의 Apify run 을 "시작"만 하고 즉시 끝낸다.
// 실제 데이터 적재는 Apify 완료 webhook(/webhook) 에서 처리하므로 Worker 실행 시간이 짧다.
// startRun 은 빠르게(수백 ms) 반환되므로 병렬로 시작한다.
async function startMany(
  env: Env,
  accounts: CollectAccount[],
  date: string,
  maxItems: number,
): Promise<void> {
  const db = createDb(env.HYPERDRIVE.connectionString);
  const apify = new ApifyClient(env.APIFY_TOKEN);
  const webhookUrl = webhookUrlOf(env);
  // Meta Ads 는 비용이 높아 플랫폼별로 더 낮은 수집 상한을 적용한다.
  const metaMaxItems = envInt(env.META_ADS_MAX_ITEMS, META_ADS_DEFAULT_MAX_ITEMS);
  const results = await Promise.all(
    accounts.map((account) =>
      startCollect(db, apify, account, {
        date,
        maxItems: account.platform === "meta_ads" ? metaMaxItems : maxItems,
        actorOverride: actorFor(env, account.platform),
        webhookUrl,
      }).catch((err) => {
        console.error("[collect] startCollect threw", { accountId: account.id, platform: account.platform, err: String(err) });
        return undefined;
      }),
    ),
  );
  const started = results.filter((r) => r && !r.error && !r.skipped).length;
  const skipped = results.filter((r) => r?.skipped).length;
  const failed = results.filter((r) => r?.error).length;
  console.log("[collect] startMany", { date, accounts: accounts.length, started, skipped, failed });
}

/** reconciler/webhook 이 run 을 시작할 때 쓴 상한을 알 수 없으므로 env 기준 상한을 힌트로 넘긴다. */
function maxItemsHintFor(env: Env, platform: string): number {
  return platform === "meta_ads"
    ? envInt(env.META_ADS_MAX_ITEMS, META_ADS_DEFAULT_MAX_ITEMS)
    : envInt(env.MAX_ITEMS, 50);
}

// 폴링 기반 안전망(webhook 유실/버스트 대비). status='running' + apify_run_id 인 run 을
// 소량씩 골라 Apify 상태를 확인하고, 끝난 것(SUCCEEDED/FAILED)을 확정한다.
// 잦은 cron 으로 호출되어 밀린 run 을 점진적으로 배수한다. limit 를 작게 유지해 무료 플랜
// Worker 실행 예산 안에서 순차 적재가 완료되도록 한다.
const TERMINAL_FAIL = new Set(["FAILED", "ABORTED", "TIMED-OUT", "TIMED_OUT"]);

async function reconcilePending(env: Env, limit = 4): Promise<{ checked: number; done: number }> {
  const db = createDb(env.HYPERDRIVE.connectionString);
  const apify = new ApifyClient(env.APIFY_TOKEN);
  // 6시간 reconcile 창을 벗어나 영원히 running 으로 남는 고아 run 을 error 로 정리한다.
  // (Apify run 은 수 분 내 끝나므로 12시간이면 충분히 보수적)
  await db
    .update(collectionRuns)
    .set({ status: "error", error: "timeout: 12시간 내 완료되지 않아 자동 종료", finishedAt: new Date() })
    .where(
      and(
        eq(collectionRuns.status, "running"),
        sql`${collectionRuns.startedAt} < now() - interval '12 hours'`,
      ),
    );
  // 다른 경로(webhook)가 리스를 잡고 처리 중인 run(finished_at 이 최근)은 후보에서 제외한다.
  // 안 그러면 잘린 적재의 잔해가 가장 오래된 행으로 매 tick 상위 limit 개를 독점해 신규 run 이 굶는다.
  const rows = await db
    .select({ apifyRunId: collectionRuns.apifyRunId, platform: collectionRuns.platform })
    .from(collectionRuns)
    .where(
      and(
        eq(collectionRuns.status, "running"),
        isNotNull(collectionRuns.apifyRunId),
        gt(collectionRuns.startedAt, sql`now() - interval '6 hours'`),
        or(
          isNull(collectionRuns.finishedAt),
          lt(collectionRuns.finishedAt, sql`now() - interval '${sql.raw(String(CLAIM_LEASE_MINUTES))} minutes'`),
        ),
      ),
    )
    .orderBy(collectionRuns.startedAt)
    .limit(limit);

  let done = 0;
  for (const r of rows) {
    const runId = r.apifyRunId;
    if (!runId) continue;
    const run = await apify.getRun(runId).catch((err) => {
      console.warn("[collect] getRun failed", { apifyRunId: runId, err: String(err) });
      return null;
    });
    if (!run) continue;
    const maxItemsHint = maxItemsHintFor(env, r.platform);
    if (run.status === "SUCCEEDED") {
      const res = await finishCollect(db, apify, { apifyRunId: runId, datasetId: run.datasetId, succeeded: true, maxItemsHint });
      if (res.ok && !res.skipped) done++;
    } else if (TERMINAL_FAIL.has(run.status)) {
      await finishCollect(db, apify, { apifyRunId: runId, datasetId: run.datasetId, succeeded: false, statusText: run.status, maxItemsHint });
      done++;
    }
    // READY/RUNNING 등은 다음 tick 으로.
  }
  if (rows.length > 0) console.log("[collect] reconcile", { checked: rows.length, done });
  return { checked: rows.length, done };
}

export default {
  async scheduled(event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    // 잦은 cron(예: 매분)은 밀린 수집 run 을 배수(reconcile)하는 안전망으로 동작.
    // 일일 cron(0 3 * * *)만 실제 수집을 시작한다.
    if (event.cron !== "0 3 * * *") {
      await reconcilePending(env);
      return;
    }
    const db = createDb(env.HYPERDRIVE.connectionString);
    const today = jstDate();
    const epochDay = Math.floor(Date.now() / 86_400_000);

    const rows = await db
      .select({
        id: brandAccounts.id,
        platform: brandAccounts.platform,
        handle: brandAccounts.handle,
        profileUrl: brandAccounts.profileUrl,
        apifyInput: brandAccounts.apifyInput,
        cadence: brandAccounts.collectCadence,
      })
      .from(brandAccounts)
      .where(eq(brandAccounts.isActive, true));

    const due = rows.filter(
      (r) => ACTIVE_PLATFORMS.includes(r.platform as Platform) && dueToday(r.cadence, epochDay),
    );

    // Queue 없이(무료 플랜) Apify run 을 비동기로 시작만 한다. 적재는 완료 webhook 에서.
    const accounts: CollectAccount[] = due.map((r) => ({
      id: r.id,
      platform: r.platform as Platform,
      handle: r.handle,
      profileUrl: r.profileUrl,
      apifyInput: r.apifyInput as Record<string, unknown> | null,
    }));
    ctx.waitUntil(startMany(env, accounts, today, envInt(env.MAX_ITEMS, 50)));
  },

  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === "/health") return new Response("ok");
    if (url.pathname === "/manual-collect" && req.method === "POST") {
      if (!env.MANUAL_COLLECT_SECRET) {
        return json({ ok: false, error: "MANUAL_COLLECT_SECRET is not configured" }, 503);
      }
      const secret = req.headers.get("x-celine-collect-secret");
      if (secret !== env.MANUAL_COLLECT_SECRET) {
        return json({ ok: false, error: "Unauthorized" }, 401);
      }

      let body: { accountIds?: unknown; maxItems?: unknown };
      try {
        body = await req.json();
      } catch {
        return json({ ok: false, error: "Invalid JSON body" }, 400);
      }

      const ids = Array.isArray(body.accountIds)
        ? [...new Set(body.accountIds.filter((id): id is string => typeof id === "string" && id.length > 0))]
        : [];
      if (ids.length === 0) return json({ ok: false, error: "accountIds is required" }, 400);
      if (ids.length > 100) return json({ ok: false, error: "Too many accounts selected. Limit is 100." }, 400);

      const db = createDb(env.HYPERDRIVE.connectionString);
      const today = jstDate();
      const maxItems = parseMaxItems(body.maxItems, envInt(env.MAX_ITEMS, 50));
      const rows = await db
        .select({
          id: brandAccounts.id,
          platform: brandAccounts.platform,
          handle: brandAccounts.handle,
          profileUrl: brandAccounts.profileUrl,
          apifyInput: brandAccounts.apifyInput,
        })
        .from(brandAccounts)
        .where(and(eq(brandAccounts.isActive, true), inArray(brandAccounts.id, ids)));

      const queueable = rows.filter(
        (r) => ACTIVE_PLATFORMS.includes(r.platform as Platform),
      );
      const inactiveOrMissing = ids.length - queueable.length;
      const accounts: CollectAccount[] = queueable.map((r) => ({
        id: r.id,
        platform: r.platform as Platform,
        handle: r.handle,
        profileUrl: r.profileUrl,
        apifyInput: r.apifyInput as Record<string, unknown> | null,
      }));
      // Apify run 을 시작(빠름)한 뒤 202 응답. 데이터 적재는 완료 webhook 에서.
      // 진행상황은 관리 화면의 collection_runs 폴링으로 노출된다.
      await startMany(env, accounts, today, maxItems);

      return json({
        ok: true,
        queued: queueable.length,
        skipped: inactiveOrMissing,
        date: today,
        maxItems,
      }, 202);
    }
    // Apify 완료 webhook 수신 → 데이터셋 적재 + 상태 확정.
    if (url.pathname === "/webhook" && req.method === "POST") {
      if (env.MANUAL_COLLECT_SECRET && url.searchParams.get("secret") !== env.MANUAL_COLLECT_SECRET) {
        return json({ ok: false, error: "Unauthorized" }, 401);
      }
      let payload: {
        eventType?: string;
        eventData?: { actorRunId?: string };
        resource?: { id?: string; defaultDatasetId?: string; status?: string };
      };
      try {
        payload = await req.json();
      } catch {
        return json({ ok: false, error: "Invalid JSON body" }, 400);
      }
      const apifyRunId = payload.eventData?.actorRunId ?? payload.resource?.id;
      if (!apifyRunId) return json({ ok: false, error: "actorRunId 없음" }, 400);
      const status = payload.resource?.status ?? payload.eventType ?? "";
      const succeeded = status === "SUCCEEDED" || payload.eventType === "ACTOR.RUN.SUCCEEDED";

      const db = createDb(env.HYPERDRIVE.connectionString);
      const apify = new ApifyClient(env.APIFY_TOKEN);
      // 즉시 202 로 Apify 에 응답하고, 적재는 백그라운드로(데이터는 이미 준비됨 → 짧음).
      // 플랫폼은 run 조회 후에야 알 수 있으므로 finishCollect 안에서 힌트를 고르게 한다.
      ctx.waitUntil(
        (async () => {
          const [row] = await db
            .select({ platform: collectionRuns.platform })
            .from(collectionRuns)
            .where(eq(collectionRuns.apifyRunId, apifyRunId))
            .limit(1);
          return finishCollect(db, apify, {
            apifyRunId,
            datasetId: payload.resource?.defaultDatasetId,
            succeeded,
            statusText: String(status),
            maxItemsHint: row ? maxItemsHintFor(env, row.platform) : undefined,
          });
        })().catch((err) => console.error("[collect] webhook finish threw", { apifyRunId, err: String(err) })),
      );
      return new Response("accepted", { status: 202 });
    }
    return new Response("Celine collector", { status: 200 });
  },
};
