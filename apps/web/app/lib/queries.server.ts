// 서버 전용: 대시보드 각 화면용 실데이터 쿼리.
import {
  accountMetricsDaily,
  ads as adsT,
  brandAccounts,
  brands as brandsT,
  collectionRuns,
  mediaAssets,
  postMetricsDaily,
  posts as postsT,
} from "@celine/db";
import type { Platform } from "@celine/shared";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { getDb } from "./db.server";

export type FeedItem = {
  id: string;
  kind: "ad" | "post";
  brand: string;
  platform: Platform;
  text: string | null;
  format: "image" | "video" | "carousel" | null;
  date: string | null;
  likes?: number | null;
  comments?: number | null;
  views?: number | null;
  daysActive?: number | null;
  imageUrl?: string | null;
};

// owner_id → 첫 미디어 URL 매핑
async function firstMediaByOwner(ownerType: "ad" | "post", ownerIds: string[]) {
  const db = getDb();
  if (ownerIds.length === 0) return new Map<string, string>();
  const rows = await db
    .select({ ownerId: mediaAssets.ownerId, url: mediaAssets.originalUrl, stored: mediaAssets.r2Key, kind: mediaAssets.kind })
    .from(mediaAssets)
    .where(and(eq(mediaAssets.ownerType, ownerType), inArray(mediaAssets.ownerId, ownerIds)));
  // 썸네일은 이미지 우선 (영상 URL이 첫 미디어면 회색이 되므로). 없으면 첫 미디어.
  const best = new Map<string, { url: string; isImage: boolean }>();
  for (const r of rows) {
    const url = r.stored ?? r.url;
    const isImage = r.kind === "image";
    const cur = best.get(r.ownerId);
    if (!cur || (isImage && !cur.isImage)) best.set(r.ownerId, { url, isImage });
  }
  const map = new Map<string, string>();
  for (const [k, v] of best) map.set(k, v.url);
  return map;
}

export async function getFeed(): Promise<FeedItem[]> {
  const db = getDb();
  const postRows = await db
    .select({
      id: postsT.id,
      brand: brandsT.name,
      platform: brandAccounts.platform,
      caption: postsT.caption,
      format: postsT.format,
      postedAt: postsT.postedAt,
      likes: sql<number | null>`max(${postMetricsDaily.likes})`,
      comments: sql<number | null>`max(${postMetricsDaily.comments})`,
      views: sql<number | null>`max(${postMetricsDaily.views})`,
    })
    .from(postsT)
    .innerJoin(brandAccounts, eq(postsT.brandAccountId, brandAccounts.id))
    .innerJoin(brandsT, eq(brandAccounts.brandId, brandsT.id))
    .leftJoin(postMetricsDaily, eq(postMetricsDaily.postId, postsT.id))
    .groupBy(postsT.id, brandsT.name, brandAccounts.platform)
    .orderBy(desc(postsT.postedAt))
    .limit(120);

  const adRows = await db
    .select({
      id: adsT.id,
      brand: brandsT.name,
      adCopy: adsT.adCopy,
      format: adsT.format,
      lastSeen: adsT.lastSeen,
      daysActive: adsT.daysActive,
      plat: brandAccounts.platform,
    })
    .from(adsT)
    .innerJoin(brandAccounts, eq(adsT.brandAccountId, brandAccounts.id))
    .innerJoin(brandsT, eq(brandAccounts.brandId, brandsT.id))
    .where(eq(adsT.isActive, true))
    .orderBy(desc(adsT.daysActive))
    .limit(60);

  const postMedia = await firstMediaByOwner("post", postRows.map((p) => p.id));
  const adMedia = await firstMediaByOwner("ad", adRows.map((a) => a.id));

  const items: FeedItem[] = [
    ...postRows.map((p) => ({
      id: p.id,
      kind: "post" as const,
      brand: p.brand,
      platform: p.platform as Platform,
      text: p.caption,
      format: p.format,
      date: p.postedAt ? p.postedAt.toISOString().slice(0, 10) : null,
      likes: p.likes,
      comments: p.comments,
      views: p.views,
      imageUrl: postMedia.get(p.id) ?? null,
    })),
    ...adRows.map((a) => ({
      id: a.id,
      kind: "ad" as const,
      brand: a.brand,
      platform: a.plat as Platform,
      text: a.adCopy,
      format: a.format,
      date: a.lastSeen,
      daysActive: a.daysActive,
      imageUrl: adMedia.get(a.id) ?? null,
    })),
  ];
  items.sort((x, y) => (x.date ?? "") < (y.date ?? "") ? 1 : -1);
  return items;
}

export async function getWinningAds() {
  const db = getDb();
  const rows = await db
    .select({
      id: adsT.id,
      brand: brandsT.name,
      platform: brandAccounts.platform,
      copy: adsT.adCopy,
      format: adsT.format,
      daysActive: adsT.daysActive,
      firstSeen: adsT.firstSeen,
      lastSeen: adsT.lastSeen,
      isActive: adsT.isActive,
      landingDomain: adsT.landingDomain,
    })
    .from(adsT)
    .innerJoin(brandAccounts, eq(adsT.brandAccountId, brandAccounts.id))
    .innerJoin(brandsT, eq(brandAccounts.brandId, brandsT.id))
    .orderBy(desc(adsT.daysActive))
    .limit(50);
  const media = await firstMediaByOwner("ad", rows.map((r) => r.id));
  return rows.map((r) => ({ ...r, platform: r.platform as Platform, imageUrl: media.get(r.id) ?? null }));
}

export async function getBrandsOverview() {
  const db = getDb();
  const rows = await db
    .select({
      id: brandsT.id,
      name: brandsT.name,
      slug: brandsT.slug,
      platform: brandAccounts.platform,
    })
    .from(brandsT)
    .leftJoin(brandAccounts, eq(brandAccounts.brandId, brandsT.id));

  const byBrand = new Map<string, { id: string; name: string; slug: string; platforms: Set<Platform> }>();
  for (const r of rows) {
    if (!byBrand.has(r.id)) byBrand.set(r.id, { id: r.id, name: r.name, slug: r.slug, platforms: new Set() });
    if (r.platform) byBrand.get(r.id)!.platforms.add(r.platform as Platform);
  }

  // 브랜드별 포스트/광고 수
  const postCounts = await db
    .select({ brandId: brandsT.id, n: sql<number>`count(${postsT.id})::int` })
    .from(brandsT)
    .leftJoin(brandAccounts, eq(brandAccounts.brandId, brandsT.id))
    .leftJoin(postsT, eq(postsT.brandAccountId, brandAccounts.id))
    .groupBy(brandsT.id);
  const adCounts = await db
    .select({ brandId: brandsT.id, n: sql<number>`count(${adsT.id})::int` })
    .from(brandsT)
    .leftJoin(brandAccounts, eq(brandAccounts.brandId, brandsT.id))
    .leftJoin(adsT, and(eq(adsT.brandAccountId, brandAccounts.id), eq(adsT.isActive, true)))
    .groupBy(brandsT.id);
  const pMap = new Map(postCounts.map((p) => [p.brandId, p.n]));
  const aMap = new Map(adCounts.map((a) => [a.brandId, a.n]));

  return [...byBrand.values()].map((b) => ({
    id: b.id,
    name: b.name,
    slug: b.slug,
    platforms: [...b.platforms],
    postsCount: pMap.get(b.id) ?? 0,
    adsCount: aMap.get(b.id) ?? 0,
  }));
}

export async function getRuns() {
  const db = getDb();
  const rows = await db
    .select({
      id: collectionRuns.id,
      brand: brandsT.name,
      platform: collectionRuns.platform,
      status: collectionRuns.status,
      itemCount: collectionRuns.itemCount,
      startedAt: collectionRuns.startedAt,
      finishedAt: collectionRuns.finishedAt,
      error: collectionRuns.error,
    })
    .from(collectionRuns)
    .innerJoin(brandAccounts, eq(collectionRuns.brandAccountId, brandAccounts.id))
    .innerJoin(brandsT, eq(brandAccounts.brandId, brandsT.id))
    .orderBy(desc(collectionRuns.startedAt))
    .limit(50);

  return rows.map((r) => {
    const dur =
      r.finishedAt && r.startedAt
        ? `${Math.max(0, Math.round((r.finishedAt.getTime() - r.startedAt.getTime()) / 1000))}초`
        : "—";
    return {
      id: r.id,
      brand: r.brand,
      platform: r.platform as Platform,
      status: r.status,
      items: r.itemCount,
      lastRun: r.startedAt ? r.startedAt.toISOString().slice(11, 16) : "—",
      duration: dur,
    };
  });
}

export async function getSummary() {
  const db = getDb();
  const [[brandCount], [activeAds], [weekPosts], [runsToday]] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(brandsT),
    db.select({ n: sql<number>`count(*)::int` }).from(adsT).where(eq(adsT.isActive, true)),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(postsT)
      .where(gte(postsT.postedAt, sql`now() - interval '7 days'`)),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(collectionRuns)
      .where(and(eq(collectionRuns.status, "done"), gte(collectionRuns.startedAt, sql`now() - interval '1 day'`))),
  ]);

  // 최근 변경: 최신 포스트 6건
  const recentPosts = await db
    .select({
      brand: brandsT.name,
      platform: brandAccounts.platform,
      caption: postsT.caption,
      postedAt: postsT.postedAt,
    })
    .from(postsT)
    .innerJoin(brandAccounts, eq(postsT.brandAccountId, brandAccounts.id))
    .innerJoin(brandsT, eq(brandAccounts.brandId, brandsT.id))
    .orderBy(desc(postsT.postedAt))
    .limit(6);

  const brandsOverview = await getBrandsOverview();

  return {
    kpis: [
      { label: "추적 중인 브랜드", value: String(brandCount.n), icon: "analytics" },
      { label: "활성 광고", value: String(activeAds.n), icon: "ad_units" },
      { label: "최근 7일 신규 게시물", value: String(weekPosts.n), icon: "post_add" },
      { label: "오늘 완료된 수집", value: String(runsToday.n), icon: "sync" },
    ],
    recent: recentPosts.map((r) => ({
      brand: r.brand,
      platform: r.platform as Platform,
      caption: r.caption,
      when: r.postedAt ? r.postedAt.toISOString().slice(0, 10) : "",
    })),
    brands: brandsOverview,
  };
}

export async function getTrends(slug?: string) {
  const db = getDb();
  // 포스트가 가장 많은 instagram 계정 선택 (또는 지정 slug)
  const accounts = await db
    .select({
      accountId: brandAccounts.id,
      brand: brandsT.name,
      slug: brandsT.slug,
      platform: brandAccounts.platform,
      handle: brandAccounts.handle,
      n: sql<number>`count(${postsT.id})::int`,
    })
    .from(brandAccounts)
    .innerJoin(brandsT, eq(brandAccounts.brandId, brandsT.id))
    .leftJoin(postsT, eq(postsT.brandAccountId, brandAccounts.id))
    .groupBy(brandAccounts.id, brandsT.name, brandsT.slug, brandAccounts.platform, brandAccounts.handle)
    .orderBy(desc(sql`count(${postsT.id})`));

  const chosen = (slug ? accounts.find((a) => a.slug === slug) : undefined) ?? accounts[0];
  if (!chosen) return null;

  const followerRows = await db
    .select({ date: accountMetricsDaily.date, followers: accountMetricsDaily.followers })
    .from(accountMetricsDaily)
    .where(eq(accountMetricsDaily.brandAccountId, chosen.accountId))
    .orderBy(accountMetricsDaily.date);

  const topPosts = await db
    .select({
      id: postsT.id,
      caption: postsT.caption,
      format: postsT.format,
      likes: sql<number | null>`max(${postMetricsDaily.likes})`,
      comments: sql<number | null>`max(${postMetricsDaily.comments})`,
      views: sql<number | null>`max(${postMetricsDaily.views})`,
    })
    .from(postsT)
    .leftJoin(postMetricsDaily, eq(postMetricsDaily.postId, postsT.id))
    .where(eq(postsT.brandAccountId, chosen.accountId))
    .groupBy(postsT.id)
    .orderBy(desc(sql`max(${postMetricsDaily.likes})`))
    .limit(5);

  const media = await firstMediaByOwner("post", topPosts.map((p) => p.id));

  return {
    account: {
      brand: chosen.brand,
      platform: chosen.platform as Platform,
      handle: chosen.handle,
      followers: followerRows.at(-1)?.followers ?? null,
    },
    allAccounts: accounts.map((a) => ({ slug: a.slug, brand: a.brand, n: a.n })),
    followerSeries: followerRows.map((r) => ({ value: r.followers ?? 0 })),
    topPosts: topPosts.map((p) => ({ ...p, imageUrl: media.get(p.id) ?? null })),
  };
}

export async function getItemDetail(kind: "post" | "ad", id: string) {
  const db = getDb();
  const mediaRows = await db
    .select({ url: mediaAssets.originalUrl, stored: mediaAssets.r2Key, kind: mediaAssets.kind })
    .from(mediaAssets)
    .where(and(eq(mediaAssets.ownerType, kind), eq(mediaAssets.ownerId, id)));
  const media = mediaRows.map((m) => ({ url: m.stored ?? m.url, kind: m.kind }));

  if (kind === "post") {
    const [p] = await db
      .select({
        id: postsT.id,
        brand: brandsT.name,
        platform: brandAccounts.platform,
        handle: brandAccounts.handle,
        caption: postsT.caption,
        format: postsT.format,
        permalink: postsT.permalink,
        postedAt: postsT.postedAt,
      })
      .from(postsT)
      .innerJoin(brandAccounts, eq(postsT.brandAccountId, brandAccounts.id))
      .innerJoin(brandsT, eq(brandAccounts.brandId, brandsT.id))
      .where(eq(postsT.id, id))
      .limit(1);
    if (!p) return null;
    const metrics = await db
      .select({
        date: postMetricsDaily.date,
        likes: postMetricsDaily.likes,
        comments: postMetricsDaily.comments,
        views: postMetricsDaily.views,
        shares: postMetricsDaily.shares,
      })
      .from(postMetricsDaily)
      .where(eq(postMetricsDaily.postId, id))
      .orderBy(postMetricsDaily.date);
    return {
      kind: "post" as const,
      brand: p.brand,
      platform: p.platform as Platform,
      handle: p.handle,
      title: p.caption,
      format: p.format,
      permalink: p.permalink,
      date: p.postedAt ? p.postedAt.toISOString().slice(0, 10) : null,
      media: media.map((m) => ({ url: m.url, kind: m.kind })),
      metricsHistory: metrics,
      ad: null,
    };
  }

  const [a] = await db
    .select({
      id: adsT.id,
      brand: brandsT.name,
      platform: brandAccounts.platform,
      handle: brandAccounts.handle,
      copy: adsT.adCopy,
      format: adsT.format,
      destinationUrl: adsT.destinationUrl,
      landingDomain: adsT.landingDomain,
      firstSeen: adsT.firstSeen,
      lastSeen: adsT.lastSeen,
      daysActive: adsT.daysActive,
      isActive: adsT.isActive,
    })
    .from(adsT)
    .innerJoin(brandAccounts, eq(adsT.brandAccountId, brandAccounts.id))
    .innerJoin(brandsT, eq(brandAccounts.brandId, brandsT.id))
    .where(eq(adsT.id, id))
    .limit(1);
  if (!a) return null;
  return {
    kind: "ad" as const,
    brand: a.brand,
    platform: a.platform as Platform,
    handle: a.handle,
    title: a.copy,
    format: a.format,
    permalink: a.destinationUrl,
    date: a.lastSeen,
    media: media.map((m) => ({ url: m.url, kind: m.kind })),
    metricsHistory: [],
    ad: {
      destinationUrl: a.destinationUrl,
      landingDomain: a.landingDomain,
      firstSeen: a.firstSeen,
      lastSeen: a.lastSeen,
      daysActive: a.daysActive,
      isActive: a.isActive,
    },
  };
}

// 같은 브랜드/플랫폼의 다른 게시물 (유사 콘텐츠 placeholder — 2차에서 임베딩 기반으로 고도화)
export async function getSimilarPosts(id: string, limit = 6) {
  const db = getDb();
  const [base] = await db
    .select({ brandAccountId: postsT.brandAccountId })
    .from(postsT)
    .where(eq(postsT.id, id))
    .limit(1);
  if (!base) return [];
  const rows = await db
    .select({ id: postsT.id, caption: postsT.caption, format: postsT.format })
    .from(postsT)
    .where(and(eq(postsT.brandAccountId, base.brandAccountId), sql`${postsT.id} <> ${id}`))
    .limit(limit);
  const media = await firstMediaByOwner("post", rows.map((r) => r.id));
  return rows.map((r) => ({ ...r, imageUrl: media.get(r.id) ?? null }));
}

export async function getCalendar() {
  const db = getDb();
  const rows = await db
    .select({ postedAt: postsT.postedAt, platform: brandAccounts.platform })
    .from(postsT)
    .innerJoin(brandAccounts, eq(postsT.brandAccountId, brandAccounts.id))
    .where(sql`${postsT.postedAt} is not null`);

  const byDate = new Map<string, { count: number; platforms: Set<Platform> }>();
  for (const r of rows) {
    if (!r.postedAt) continue;
    const key = r.postedAt.toISOString().slice(0, 10);
    if (!byDate.has(key)) byDate.set(key, { count: 0, platforms: new Set() });
    const e = byDate.get(key)!;
    e.count++;
    e.platforms.add(r.platform as Platform);
  }
  return [...byDate.entries()]
    .map(([date, v]) => ({ date, count: v.count, platforms: [...v.platforms] }))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}
