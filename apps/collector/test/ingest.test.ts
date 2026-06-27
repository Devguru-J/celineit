import {
  accountMetricsDaily,
  adPresenceDaily,
  ads as adsTable,
  brandAccounts,
  brands,
  postMetricsDaily,
  posts as postsTable,
} from "@celine/db";
import { createTestDb } from "@celine/db/testing";
import { emptyResult, type NormalizedResult } from "@celine/shared";
import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { ingestResult } from "../src/ingest";

let db: Awaited<ReturnType<typeof createTestDb>>["db"];
let accountId: string;

async function seedAccount(platform: "meta_ads" | "instagram" = "meta_ads") {
  const [brand] = await db.insert(brands).values({ name: "테스트", slug: `t-${platform}` }).returning();
  const [acct] = await db
    .insert(brandAccounts)
    .values({ brandId: brand.id, platform, handle: "@test" })
    .returning();
  return acct.id;
}

function adResult(ids: string[], active = true): NormalizedResult {
  const r = emptyResult();
  for (const id of ids) {
    r.ads.push({
      platformAdId: id,
      adCopy: `광고 ${id}`,
      format: "image",
      destinationUrl: "https://celine.com/x",
      landingDomain: "celine.com",
      mediaUrls: [`https://m.example/${id}.jpg`],
      seenActive: active,
      raw: { id },
    });
  }
  return r;
}

beforeEach(async () => {
  ({ db } = await createTestDb());
  accountId = await seedAccount("meta_ads");
});

describe("광고 적재 + longevity", () => {
  it("신규 광고를 insert 하고 first/last_seen 을 설정한다", async () => {
    const stats = await ingestResult(db, {
      brandAccountId: accountId,
      platform: "meta_ads",
      date: "2026-06-01",
      result: adResult(["A1", "A2"]),
    });
    expect(stats.adsUpserted).toBe(2);

    const rows = await db.select().from(adsTable);
    expect(rows).toHaveLength(2);
    expect(rows[0].firstSeen).toBe("2026-06-01");
    expect(rows[0].lastSeen).toBe("2026-06-01");
    expect(rows[0].daysActive).toBe(1);
  });

  it("같은 날 재실행해도 멱등하다 (중복 없음)", async () => {
    const p = { brandAccountId: accountId, platform: "meta_ads" as const, date: "2026-06-01", result: adResult(["A1"]) };
    await ingestResult(db, p);
    await ingestResult(db, p);

    expect(await db.select().from(adsTable)).toHaveLength(1);
    expect(await db.select().from(adPresenceDaily)).toHaveLength(1);
  });

  it("여러 날 활성이면 days_active 가 누적된다", async () => {
    for (const d of ["2026-06-01", "2026-06-02", "2026-06-03"]) {
      await ingestResult(db, { brandAccountId: accountId, platform: "meta_ads", date: d, result: adResult(["A1"]) });
    }
    const [ad] = await db.select().from(adsTable).where(eq(adsTable.platformAdId, "A1"));
    expect(ad.daysActive).toBe(3);
    expect(ad.firstSeen).toBe("2026-06-01");
    expect(ad.lastSeen).toBe("2026-06-03");
    expect(ad.isActive).toBe(true);
  });

  it("어제 보였으나 오늘 안 보인 광고를 비활성 처리한다 (longevity 종료)", async () => {
    await ingestResult(db, { brandAccountId: accountId, platform: "meta_ads", date: "2026-06-01", result: adResult(["A1", "A2"]) });
    // 다음날 A1만 관측
    const stats = await ingestResult(db, { brandAccountId: accountId, platform: "meta_ads", date: "2026-06-02", result: adResult(["A1"]) });
    expect(stats.adsInactivated).toBe(1);

    const [a2] = await db.select().from(adsTable).where(eq(adsTable.platformAdId, "A2"));
    expect(a2.isActive).toBe(false);
    expect(a2.daysActive).toBe(1); // 첫날만 활성

    const [a1] = await db.select().from(adsTable).where(eq(adsTable.platformAdId, "A1"));
    expect(a1.daysActive).toBe(2);
  });

  it("빈 결과(스크래이프 실패 가정)는 기존 광고를 비활성화하지 않는다", async () => {
    await ingestResult(db, { brandAccountId: accountId, platform: "meta_ads", date: "2026-06-01", result: adResult(["A1"]) });
    await ingestResult(db, { brandAccountId: accountId, platform: "meta_ads", date: "2026-06-02", result: emptyResult() });
    const [a1] = await db.select().from(adsTable).where(eq(adsTable.platformAdId, "A1"));
    expect(a1.isActive).toBe(true);
  });

  it("미디어를 media_assets 에 멱등하게 연결한다", async () => {
    const p = { brandAccountId: accountId, platform: "meta_ads" as const, date: "2026-06-01", result: adResult(["A1"]) };
    const s1 = await ingestResult(db, p);
    const s2 = await ingestResult(db, p);
    expect(s1.mediaLinked).toBe(1);
    expect(s2.mediaLinked).toBe(0); // 두 번째는 중복이라 0
  });
});

describe("포스트 + 지표 적재", () => {
  beforeEach(async () => {
    accountId = await seedAccount("instagram");
  });

  it("포스트 upsert + 일별 지표 + 계정 팔로워를 적재한다", async () => {
    const r = emptyResult();
    r.posts.push({
      platformPostId: "P1",
      caption: "안녕",
      format: "image",
      permalink: "https://insta/p/P1",
      postedAt: "2026-06-01T00:00:00.000Z",
      mediaUrls: ["https://m/p1.jpg"],
      metrics: { likes: 100, comments: 5, views: 0 },
      raw: {},
    });
    r.accountMetric = { followers: 1000 };

    await ingestResult(db, { brandAccountId: accountId, platform: "instagram", date: "2026-06-01", result: r });

    expect(await db.select().from(postsTable)).toHaveLength(1);
    const [pm] = await db.select().from(postMetricsDaily);
    expect(pm.likes).toBe(100);
    const [am] = await db.select().from(accountMetricsDaily);
    expect(am.followers).toBe(1000);
  });

  it("팔로워 추세: 날짜별로 스냅샷이 쌓인다", async () => {
    for (const [d, f] of [["2026-06-01", 1000], ["2026-06-02", 1050]] as const) {
      const r = emptyResult();
      r.accountMetric = { followers: f };
      await ingestResult(db, { brandAccountId: accountId, platform: "instagram", date: d, result: r });
    }
    const rows = await db
      .select()
      .from(accountMetricsDaily)
      .where(eq(accountMetricsDaily.brandAccountId, accountId));
    expect(rows).toHaveLength(2);
  });
});
