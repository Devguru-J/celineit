// Cloudflare Worker (운영): Cron → Queue → 수집 → 적재.
// - scheduled(): 매일 활성 계정을 Queue 로 발행 (플랫폼별 주기 반영)
// - queue(): 계정 1개씩 Apify 실행 + 적재
// - fetch(): Apify 완료 webhook 수신 엔드포인트(향후 비동기 전환용) + 헬스체크
//
// DB 연결은 Cloudflare Hyperdrive 바인딩으로 Supabase Postgres 에 접속한다.
import { brandAccounts, brands, collectionRuns, createDb } from "@celine/db";
import { ACTIVE_PLATFORMS, type Platform } from "@celine/shared";
import { and, eq, gt, inArray, isNotNull, sql } from "drizzle-orm";
import { ApifyClient } from "./apify";
import { finishCollect, startCollect, type CollectAccount } from "./collect";

export interface Env {
  HYPERDRIVE: { connectionString: string };
  APIFY_TOKEN: string;
  APIFY_ACTOR_META_ADS?: string;
  APIFY_ACTOR_INSTAGRAM?: string;
  APIFY_ACTOR_TWITTER?: string;
  APIFY_ACTOR_TIKTOK?: string;
  MAX_ITEMS?: string;
  MANUAL_COLLECT_SECRET?: string;
  // 이 워커의 공개 URL. Apify 완료 webhook 수신 주소(${PUBLIC_URL}/webhook)에 사용.
  PUBLIC_URL?: string;
}

function actorFor(env: Env, platform: Platform): string | undefined {
  return (env as unknown as Record<string, string | undefined>)[`APIFY_ACTOR_${platform.toUpperCase()}`];
}

// 격일 플랫폼은 짝수 day-of-month 에만 수집 (단순 규칙; 추후 cadence 컬럼 기반으로 정교화).
function dueToday(cadence: string, day: number): boolean {
  if (cadence === "every_2d") return day % 2 === 0;
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
  await Promise.all(
    accounts.map((account) =>
      startCollect(db, apify, account, {
        date,
        maxItems,
        actorOverride: actorFor(env, account.platform),
        webhookUrl,
      }).catch(() => undefined),
    ),
  );
}

// 폴링 기반 안전망(webhook 유실/버스트 대비). status='running' + apify_run_id 인 run 을
// 소량씩 골라 Apify 상태를 확인하고, 끝난 것(SUCCEEDED/FAILED)을 확정한다.
// 잦은 cron 으로 호출되어 밀린 run 을 점진적으로 배수한다. limit 를 작게 유지해 무료 플랜
// Worker 실행 예산 안에서 순차 적재가 완료되도록 한다.
const TERMINAL_FAIL = new Set(["FAILED", "ABORTED", "TIMED-OUT", "TIMED_OUT"]);

async function reconcilePending(env: Env, limit = 4): Promise<{ checked: number; done: number }> {
  const db = createDb(env.HYPERDRIVE.connectionString);
  const apify = new ApifyClient(env.APIFY_TOKEN);
  const rows = await db
    .select({ apifyRunId: collectionRuns.apifyRunId })
    .from(collectionRuns)
    .where(
      and(
        eq(collectionRuns.status, "running"),
        isNotNull(collectionRuns.apifyRunId),
        gt(collectionRuns.startedAt, sql`now() - interval '6 hours'`),
      ),
    )
    .orderBy(collectionRuns.startedAt)
    .limit(limit);

  let done = 0;
  for (const r of rows) {
    const runId = r.apifyRunId;
    if (!runId) continue;
    const run = await apify.getRun(runId).catch(() => null);
    if (!run) continue;
    if (run.status === "SUCCEEDED") {
      const res = await finishCollect(db, apify, { apifyRunId: runId, datasetId: run.datasetId, succeeded: true });
      if (res.ok) done++;
    } else if (TERMINAL_FAIL.has(run.status)) {
      await finishCollect(db, apify, { apifyRunId: runId, datasetId: run.datasetId, succeeded: false, statusText: run.status });
      done++;
    }
    // READY/RUNNING 등은 다음 tick 으로.
  }
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
    const today = new Date().toISOString().slice(0, 10);
    const day = new Date().getUTCDate();

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
      (r) => ACTIVE_PLATFORMS.includes(r.platform as Platform) && dueToday(r.cadence, day),
    );

    // Queue 없이(무료 플랜) Apify run 을 비동기로 시작만 한다. 적재는 완료 webhook 에서.
    const accounts: CollectAccount[] = due.map((r) => ({
      id: r.id,
      platform: r.platform as Platform,
      handle: r.handle,
      profileUrl: r.profileUrl,
      apifyInput: r.apifyInput as Record<string, unknown> | null,
    }));
    ctx.waitUntil(startMany(env, accounts, today, Number(env.MAX_ITEMS ?? 50)));
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
      const today = new Date().toISOString().slice(0, 10);
      const maxItems = parseMaxItems(body.maxItems, Number(env.MAX_ITEMS ?? 50));
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
      ctx.waitUntil(
        finishCollect(db, apify, {
          apifyRunId,
          datasetId: payload.resource?.defaultDatasetId,
          succeeded,
          statusText: String(status),
        }).catch(() => undefined),
      );
      return new Response("accepted", { status: 202 });
    }
    return new Response("Celine collector", { status: 200 });
  },
};
