// 계정 1개 수집 오케스트레이션: run 기록 → Apify 실행 → 정규화 → 적재.
import { collectionRuns, type Database } from "@celine/db";
import { DEFAULT_APIFY_ACTORS, jstDate, type Platform } from "@celine/shared";
import { and, eq, gt, isNull, lt, or, sql } from "drizzle-orm";
import { getAdapter } from "./adapters";
import { ApifyClient, isTransientError } from "./apify";
import { ingestResult, type IngestStats } from "./ingest";

export interface CollectAccount {
  id: string;
  platform: Platform;
  handle: string;
  profileUrl?: string | null;
  apifyInput?: Record<string, unknown> | null;
}

export interface CollectOptions {
  date: string; // YYYY-MM-DD
  maxItems?: number;
  actorOverride?: string; // 환경변수로 지정된 actor
}

// actor input 으로 나가기 직전 최종 방어선. NaN/음수/소수가 resultsLimit 등으로
// 흘러가면 actor 가 상한을 무시하고 전량 수집(비용 폭탄)할 수 있다.
function safeMaxItems(value: number | undefined, fallback = 50): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 1) return fallback;
  return Math.min(200, Math.floor(value));
}

export async function collectAccount(
  db: Database,
  apify: ApifyClient,
  account: CollectAccount,
  opts: CollectOptions,
): Promise<{ runId: string; stats?: IngestStats; error?: string }> {
  const adapter = getAdapter(account.platform);
  const actor = opts.actorOverride ?? adapter.defaultActor ?? DEFAULT_APIFY_ACTORS[account.platform];

  const [run] = await db
    .insert(collectionRuns)
    .values({ brandAccountId: account.id, platform: account.platform, status: "running" })
    .returning({ id: collectionRuns.id });

  try {
    if (!actor) throw new Error(`${account.platform} 은 actor 가 없습니다.`);
    const maxItems = safeMaxItems(opts.maxItems);
    const input = adapter.buildInput(account, { maxItems });
    const raw = await apify.runSyncGetItems(actor, input);
    const result = adapter.normalize(raw);
    const stats = await ingestResult(db, {
      brandAccountId: account.id,
      platform: account.platform,
      date: opts.date,
      result,
      truncated: result.ads.length >= maxItems,
    });

    await db
      .update(collectionRuns)
      .set({
        status: "done",
        itemCount: result.ads.length + result.posts.length,
        finishedAt: new Date(),
        // apify_run_id 는 비동기 경로(startCollect)의 실제 run id 전용으로 남긴다.
        // actor 슬러그를 넣으면 reconcile/webhook 의 run 조회와 충돌한다.
      })
      .where(eq(collectionRuns.id, run.id));

    return { runId: run.id, stats };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .update(collectionRuns)
      .set({ status: "error", error: message, finishedAt: new Date() })
      .where(eq(collectionRuns.id, run.id));
    return { runId: run.id, error: message };
  }
}

// ── 비동기(webhook) 수집 ─────────────────────────────────────
// Cloudflare Worker 는 응답 후 백그라운드 실행 시간이 짧아 Apify 동기 대기(수십초)를
// 완주하지 못한다. 그래서 운영에서는 (1) Apify run 을 비동기로 "시작"만 하고 즉시 응답,
// (2) Apify 가 완료 webhook 을 보내오면 그때 데이터셋을 적재한다.

/** Apify run 을 시작만 하고 collection_runs 에 apifyRunId 를 기록한다(대기하지 않음). */
export async function startCollect(
  db: Database,
  apify: ApifyClient,
  account: CollectAccount,
  opts: CollectOptions & { webhookUrl?: string },
): Promise<{ runId: string; apifyRunId?: string; error?: string; skipped?: boolean }> {
  const adapter = getAdapter(account.platform);
  const actor = opts.actorOverride ?? adapter.defaultActor ?? DEFAULT_APIFY_ACTORS[account.platform];

  // 같은 계정에 아직 진행 중인 run 이 있으면 새로 시작하지 않는다 — 관리 화면 더블클릭이나
  // cron 직후 수동 수집이 Meta Ads run 을 N 개 병렬로 띄워 비용이 N 배가 되는 걸 막는다.
  const [inflight] = await db
    .select({ id: collectionRuns.id })
    .from(collectionRuns)
    .where(
      and(
        eq(collectionRuns.brandAccountId, account.id),
        eq(collectionRuns.status, "running"),
        gt(collectionRuns.startedAt, sql`now() - interval '2 hours'`),
      ),
    )
    .limit(1);
  if (inflight) return { runId: inflight.id, skipped: true };

  const [run] = await db
    .insert(collectionRuns)
    .values({ brandAccountId: account.id, platform: account.platform, status: "running" })
    .returning({ id: collectionRuns.id });

  try {
    if (!actor) throw new Error(`${account.platform} 은 actor 가 없습니다.`);
    const input = adapter.buildInput(account, { maxItems: safeMaxItems(opts.maxItems) });
    const { runId: apifyRunId } = await apify.startRun(actor, input, opts.webhookUrl);
    await db.update(collectionRuns).set({ apifyRunId }).where(eq(collectionRuns.id, run.id));
    return { runId: run.id, apifyRunId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .update(collectionRuns)
      .set({ status: "error", error: message, finishedAt: new Date() })
      .where(eq(collectionRuns.id, run.id));
    return { runId: run.id, error: message };
  }
}

/** Apify 완료 webhook 처리: apifyRunId 로 run 을 찾아 데이터셋을 적재하고 상태를 확정한다. */
export async function finishCollect(
  db: Database,
  apify: ApifyClient,
  params: {
    apifyRunId: string;
    datasetId?: string;
    succeeded: boolean;
    statusText?: string;
    /** 이 run 을 시작할 때 쓴 resultsLimit. 결과 건수가 이 값 이상이면 잘린 스크래이프로 보고 비활성 sweep 을 생략한다. */
    maxItemsHint?: number;
  },
): Promise<{ ok: boolean; error?: string; skipped?: boolean }> {
  const [run] = await db
    .select({
      id: collectionRuns.id,
      brandAccountId: collectionRuns.brandAccountId,
      platform: collectionRuns.platform,
      status: collectionRuns.status,
      startedAt: collectionRuns.startedAt,
    })
    .from(collectionRuns)
    .where(eq(collectionRuns.apifyRunId, params.apifyRunId))
    .limit(1);

  if (!run) return { ok: false, error: `run not found for apifyRunId=${params.apifyRunId}` };
  if (run.status === "done" || run.status === "error") return { ok: true }; // 멱등

  // webhook 과 분단위 reconciler 가 같은 run 을 동시에 집으면 데이터셋을 두 번
  // 내려받아 두 번 적재한다(멱등 upsert 라 데이터는 안전하지만 비용·시간 2배).
  // finished_at 을 "리스(lease)" 마커로 써서 한 쪽만 진행하도록 원자적으로 선점한다.
  // 클레임 후 Worker 가 잘려 running+finished_at 상태로 남으면 10분 뒤 리스가 만료돼
  // reconciler 가 다시 집는다(예전엔 12시간 sweep 까지 error 도 done 도 아닌 채 방치됐다).
  const claimed = await db
    .update(collectionRuns)
    .set({ finishedAt: new Date() })
    .where(
      and(
        eq(collectionRuns.id, run.id),
        eq(collectionRuns.status, "running"),
        or(isNull(collectionRuns.finishedAt), lt(collectionRuns.finishedAt, sql`now() - interval '${sql.raw(String(CLAIM_LEASE_MINUTES))} minutes'`)),
      ),
    )
    .returning({ id: collectionRuns.id });
  if (claimed.length === 0) return { ok: true, skipped: true }; // 다른 경로가 이미 처리 중

  if (!params.succeeded) {
    await db
      .update(collectionRuns)
      .set({ status: "error", error: params.statusText ?? "apify run failed", finishedAt: new Date() })
      .where(eq(collectionRuns.id, run.id));
    return { ok: true };
  }

  try {
    if (!params.datasetId) throw new Error("webhook 에 datasetId 가 없습니다.");
    const raw = await apify.getDatasetItems(params.datasetId);
    const adapter = getAdapter(run.platform as Platform);
    const result = adapter.normalize(raw);
    const date = jstDate(new Date(run.startedAt));
    await ingestResult(db, {
      brandAccountId: run.brandAccountId,
      platform: run.platform as Platform,
      date,
      result,
      truncated: params.maxItemsHint !== undefined && result.ads.length >= params.maxItemsHint,
    });
    await db
      .update(collectionRuns)
      .set({
        status: "done",
        itemCount: result.ads.length + result.posts.length,
        finishedAt: new Date(),
      })
      .where(eq(collectionRuns.id, run.id));
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (isTransientError(err)) {
      // 결제된 데이터셋은 Apify 에 남아 있다. run 을 error 로 확정하지 말고 리스를 풀어
      // reconciler 가 다음 tick 에 다시 적재하게 한다.
      console.warn("[collect] transient failure, will retry", { apifyRunId: params.apifyRunId, message });
      await db.update(collectionRuns).set({ finishedAt: null }).where(eq(collectionRuns.id, run.id));
      return { ok: false, error: message };
    }
    console.error("[collect] ingest failed", { apifyRunId: params.apifyRunId, runId: run.id, message });
    await db
      .update(collectionRuns)
      .set({ status: "error", error: message, finishedAt: new Date() })
      .where(eq(collectionRuns.id, run.id));
    return { ok: false, error: message };
  }
}

/** finishCollect 클레임 리스 길이(분). 이보다 오래 running+finished_at 이면 끊긴 적재로 보고 재시도한다. */
export const CLAIM_LEASE_MINUTES = 10;
