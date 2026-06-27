// 계정 1개 수집 오케스트레이션: run 기록 → Apify 실행 → 정규화 → 적재.
import { collectionRuns, type Database } from "@celine/db";
import { DEFAULT_APIFY_ACTORS, type Platform } from "@celine/shared";
import { eq } from "drizzle-orm";
import { getAdapter } from "./adapters";
import { ApifyClient } from "./apify";
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
    const input = adapter.buildInput(account, { maxItems: opts.maxItems ?? 50 });
    const raw = await apify.runSyncGetItems(actor, input);
    const result = adapter.normalize(raw);
    const stats = await ingestResult(db, {
      brandAccountId: account.id,
      platform: account.platform,
      date: opts.date,
      result,
    });

    await db
      .update(collectionRuns)
      .set({
        status: "done",
        itemCount: result.ads.length + result.posts.length,
        finishedAt: new Date(),
        apifyRunId: actor,
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
