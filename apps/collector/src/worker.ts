// Cloudflare Worker (운영): Cron → Queue → 수집 → 적재.
// - scheduled(): 매일 활성 계정을 Queue 로 발행 (플랫폼별 주기 반영)
// - queue(): 계정 1개씩 Apify 실행 + 적재
// - fetch(): Apify 완료 webhook 수신 엔드포인트(향후 비동기 전환용) + 헬스체크
//
// DB 연결은 Cloudflare Hyperdrive 바인딩으로 Supabase Postgres 에 접속한다.
import { brandAccounts, brands, createDb } from "@celine/db";
import { ACTIVE_PLATFORMS, type Platform } from "@celine/shared";
import { eq } from "drizzle-orm";
import { ApifyClient } from "./apify";
import { collectAccount } from "./collect";

export interface Env {
  HYPERDRIVE: { connectionString: string };
  COLLECT_QUEUE: Queue<QueueMessage>;
  APIFY_TOKEN: string;
  APIFY_ACTOR_META_ADS?: string;
  APIFY_ACTOR_INSTAGRAM?: string;
  APIFY_ACTOR_TWITTER?: string;
  APIFY_ACTOR_TIKTOK?: string;
  MAX_ITEMS?: string;
}

interface QueueMessage {
  accountId: string;
  platform: Platform;
  handle: string;
  profileUrl: string | null;
  apifyInput: Record<string, unknown> | null;
  date: string;
}

function actorFor(env: Env, platform: Platform): string | undefined {
  return (env as unknown as Record<string, string | undefined>)[`APIFY_ACTOR_${platform.toUpperCase()}`];
}

// 격일 플랫폼은 짝수 day-of-month 에만 수집 (단순 규칙; 추후 cadence 컬럼 기반으로 정교화).
function dueToday(cadence: string, day: number): boolean {
  if (cadence === "every_2d") return day % 2 === 0;
  return true;
}

export default {
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
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

    // Queue 로 계정별 메시지 발행 (분산·재시도)
    await Promise.all(
      due.map((r) =>
        env.COLLECT_QUEUE.send({
          accountId: r.id,
          platform: r.platform as Platform,
          handle: r.handle,
          profileUrl: r.profileUrl,
          apifyInput: r.apifyInput as Record<string, unknown> | null,
          date: today,
        }),
      ),
    );
    ctx.waitUntil(Promise.resolve());
  },

  async queue(batch: MessageBatch<QueueMessage>, env: Env): Promise<void> {
    const db = createDb(env.HYPERDRIVE.connectionString);
    const apify = new ApifyClient(env.APIFY_TOKEN);
    const max = Number(env.MAX_ITEMS ?? 50);

    for (const msg of batch.messages) {
      const m = msg.body;
      try {
        const res = await collectAccount(
          db,
          apify,
          {
            id: m.accountId,
            platform: m.platform,
            handle: m.handle,
            profileUrl: m.profileUrl,
            apifyInput: m.apifyInput,
          },
          { date: m.date, maxItems: max, actorOverride: actorFor(env, m.platform) },
        );
        if (res.error) msg.retry();
        else msg.ack();
      } catch {
        msg.retry(); // 최종 실패는 dead-letter queue 로 (wrangler.toml 설정)
      }
    }
  },

  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === "/health") return new Response("ok");
    // /webhook: 향후 Apify 비동기 완료 알림 수신 지점 (현재 queue 가 동기 처리)
    if (url.pathname === "/webhook" && req.method === "POST") {
      return new Response("accepted", { status: 202 });
    }
    return new Response("Celine collector", { status: 200 });
  },
};
