// 서버 전용: 대시보드 각 화면용 실데이터 쿼리.
import {
  accountMetricsDaily,
  adPresenceDaily,
  ads as adsT,
  brandAccounts,
  brands as brandsT,
  collectionRuns,
  comments as commentsT,
  commentKeywords,
  mediaAssets,
  postMetricsDaily,
  posts as postsT,
} from "@celine/db";
import { ACTIVE_PLATFORMS, FOCUS_KEYWORDS, type Platform } from "@celine/shared";
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
  mediaCount?: number;
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

// owner_id → 미디어 개수 (캐러셀 1/N 배지용)
async function mediaCountByOwner(ownerType: "ad" | "post", ownerIds: string[]) {
  const db = getDb();
  if (ownerIds.length === 0) return new Map<string, number>();
  const rows = await db
    .select({ ownerId: mediaAssets.ownerId, n: sql<number>`count(*)::int` })
    .from(mediaAssets)
    .where(and(eq(mediaAssets.ownerType, ownerType), inArray(mediaAssets.ownerId, ownerIds)))
    .groupBy(mediaAssets.ownerId);
  const map = new Map<string, number>();
  for (const r of rows) map.set(r.ownerId, r.n);
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
  const postMediaCount = await mediaCountByOwner("post", postRows.map((p) => p.id));
  const adMediaCount = await mediaCountByOwner("ad", adRows.map((a) => a.id));

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
      mediaCount: postMediaCount.get(p.id) ?? 0,
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
      mediaCount: adMediaCount.get(a.id) ?? 0,
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

// 브랜드 상세: 해당 브랜드의 게시물 + 광고를 한 화면에 모아본다. slug 없으면 null.
export async function getBrandDetail(slug: string) {
  const db = getDb();
  const [brand] = await db
    .select({ id: brandsT.id, name: brandsT.name, slug: brandsT.slug })
    .from(brandsT)
    .where(eq(brandsT.slug, slug));
  if (!brand) return null;

  const postRows = await db
    .select({
      id: postsT.id,
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
    .leftJoin(postMetricsDaily, eq(postMetricsDaily.postId, postsT.id))
    .where(eq(brandAccounts.brandId, brand.id))
    .groupBy(postsT.id, brandAccounts.platform)
    .orderBy(desc(postsT.postedAt))
    .limit(120);

  const adRows = await db
    .select({
      id: adsT.id,
      adCopy: adsT.adCopy,
      format: adsT.format,
      lastSeen: adsT.lastSeen,
      daysActive: adsT.daysActive,
      platform: brandAccounts.platform,
    })
    .from(adsT)
    .innerJoin(brandAccounts, eq(adsT.brandAccountId, brandAccounts.id))
    .where(and(eq(brandAccounts.brandId, brand.id), eq(adsT.isActive, true)))
    .orderBy(desc(adsT.daysActive))
    .limit(60);

  // 헤더용 실제 총계 (아이템 목록은 위에서 캡됨)
  const [[postTotal], [adTotal]] = await Promise.all([
    db
      .select({ n: sql<number>`count(${postsT.id})::int` })
      .from(postsT)
      .innerJoin(brandAccounts, eq(postsT.brandAccountId, brandAccounts.id))
      .where(eq(brandAccounts.brandId, brand.id)),
    db
      .select({ n: sql<number>`count(${adsT.id})::int` })
      .from(adsT)
      .innerJoin(brandAccounts, eq(adsT.brandAccountId, brandAccounts.id))
      .where(and(eq(brandAccounts.brandId, brand.id), eq(adsT.isActive, true))),
  ]);

  const postMedia = await firstMediaByOwner("post", postRows.map((p) => p.id));
  const adMedia = await firstMediaByOwner("ad", adRows.map((a) => a.id));

  const items: FeedItem[] = [
    ...postRows.map((p) => ({
      id: p.id,
      kind: "post" as const,
      brand: brand.name,
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
      brand: brand.name,
      platform: a.platform as Platform,
      text: a.adCopy,
      format: a.format,
      date: a.lastSeen,
      daysActive: a.daysActive,
      imageUrl: adMedia.get(a.id) ?? null,
    })),
  ];
  items.sort((x, y) => ((x.date ?? "") < (y.date ?? "") ? 1 : -1));

  return {
    brand,
    postsCount: postTotal.n,
    adsCount: adTotal.n,
    items,
  };
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
      error: r.error,
      duration: dur,
    };
  });
}

export type CollectableBrand = {
  id: string;
  name: string;
  slug: string;
  accounts: {
    id: string;
    platform: Platform;
    handle: string;
    cadence: string;
  }[];
};

export async function getCollectableAccounts(): Promise<CollectableBrand[]> {
  const db = getDb();
  const rows = await db
    .select({
      brandId: brandsT.id,
      brand: brandsT.name,
      slug: brandsT.slug,
      accountId: brandAccounts.id,
      platform: brandAccounts.platform,
      handle: brandAccounts.handle,
      cadence: brandAccounts.collectCadence,
    })
    .from(brandAccounts)
    .innerJoin(brandsT, eq(brandAccounts.brandId, brandsT.id))
    .where(eq(brandAccounts.isActive, true))
    .orderBy(brandsT.name, brandAccounts.platform, brandAccounts.handle);

  const byBrand = new Map<string, CollectableBrand>();
  for (const r of rows) {
    const platform = r.platform as Platform;
    if (!ACTIVE_PLATFORMS.includes(platform)) continue;
    if (!byBrand.has(r.brandId)) {
      byBrand.set(r.brandId, { id: r.brandId, name: r.brand, slug: r.slug, accounts: [] });
    }
    byBrand.get(r.brandId)!.accounts.push({
      id: r.accountId,
      platform,
      handle: r.handle,
      cadence: r.cadence,
    });
  }
  return [...byBrand.values()].filter((brand) => brand.accounts.length > 0);
}

export async function getRunStats() {
  const db = getDb();
  const [today, yesterday] = await Promise.all([
    db
      .select({
        total: sql<number>`count(*)::int`,
        ok: sql<number>`count(*) filter (where ${collectionRuns.status} = 'done')::int`,
        fail: sql<number>`count(*) filter (where ${collectionRuns.status} = 'error')::int`,
      })
      .from(collectionRuns)
      .where(gte(collectionRuns.startedAt, sql`date_trunc('day', now())`)),
    db
      .select({
        total: sql<number>`count(*)::int`,
        ok: sql<number>`count(*) filter (where ${collectionRuns.status} = 'done')::int`,
        fail: sql<number>`count(*) filter (where ${collectionRuns.status} = 'error')::int`,
      })
      .from(collectionRuns)
      .where(
        and(
          gte(collectionRuns.startedAt, sql`date_trunc('day', now()) - interval '1 day'`),
          sql`${collectionRuns.startedAt} < date_trunc('day', now())`,
        ),
      ),
  ]);
  const cur = today[0] ?? { total: 0, ok: 0, fail: 0 };
  const prev = yesterday[0] ?? { total: 0, ok: 0, fail: 0 };
  const rate = cur.total ? Math.round((cur.ok / cur.total) * 1000) / 10 : 0;
  const prevRate = prev.total ? Math.round((prev.ok / prev.total) * 1000) / 10 : 0;
  return {
    total: cur.total,
    totalDelta: cur.total - prev.total,
    rate,
    rateDelta: Math.round((rate - prevRate) * 10) / 10,
    fail: cur.fail,
    failDelta: cur.fail - prev.fail,
  };
}

export type KpiDelta = { dir: "up" | "down" | "flat"; text: string };

// 증감 배지용 퍼센트 델타. prev=0 이면 신규/미표시 처리.
function pctDelta(cur: number, prev: number): KpiDelta | undefined {
  if (prev === 0) return cur > 0 ? { dir: "up", text: "신규" } : undefined;
  const pct = Math.round(((cur - prev) / prev) * 100);
  return { dir: pct > 0 ? "up" : pct < 0 ? "down" : "flat", text: `${pct > 0 ? "+" : ""}${pct}%` };
}

type MatrixCell = {
  platform: Platform;
  followers: number | null;
  posts: number;
  activeAds: number;
  engagement: number;
  score: number;
};

export type PlatformMatrixRow = {
  brand: string;
  slug: string;
  totalScore: number;
  platforms: MatrixCell[];
};

export type DashboardAlert = {
  id: string;
  severity: "high" | "medium" | "low";
  icon: string;
  title: string;
  detail: string;
  linkTo: string;
};

export type DataQualityStatus = {
  platform: Platform;
  status: "fresh" | "stale" | "missing";
  lastRun: string | null;
  accounts: number;
  message: string;
};

function toDateOnly(v: Date | string | null | undefined) {
  if (!v) return null;
  return typeof v === "string" ? v.slice(0, 10) : v.toISOString().slice(0, 10);
}

function platformLabel(platform: Platform) {
  switch (platform) {
    case "meta_ads":
      return "Meta";
    case "instagram":
      return "Instagram";
    case "twitter":
      return "X";
    case "tiktok":
      return "TikTok";
    case "tiktok_ads":
      return "TikTok Ads";
    default:
      return platform;
  }
}

function contentTagOf(text: string | null | undefined, format?: string | null) {
  const t = (text ?? "").toLowerCase();
  if (/new|新発売|新商品|launch|発売|신제품/.test(t)) return "신제품";
  if (/sale|off|割引|送料無料|coupon|クーポン|할인|세일/.test(t)) return "프로모션";
  if (/how to|tutorial|使い方|レビュー|routine|ルーティン|방법|튜토리얼/.test(t)) return "튜토리얼";
  if (/uv|sun|spf|日焼け|선케어|자외선/.test(t)) return "선케어";
  if (/lip|リップ|口紅|립/.test(t)) return "립";
  if (/cream|クリーム|保湿|moisture|hydrating|수분|보습/.test(t)) return "보습";
  if (/serum|ampoule|美容液|앰플|세럼/.test(t)) return "세럼";
  if (format === "video") return "영상형";
  if (format === "carousel") return "캐러셀";
  return "제품/브랜드";
}

function engagementOf(v: { likes?: number | null; comments?: number | null; views?: number | null }) {
  return (v.likes ?? 0) + (v.comments ?? 0) + (v.views ?? 0);
}

export async function getPlatformMatrix(): Promise<PlatformMatrixRow[]> {
  const db = getDb();
  const accounts = await db
    .select({
      accountId: brandAccounts.id,
      brand: brandsT.name,
      slug: brandsT.slug,
      platform: brandAccounts.platform,
    })
    .from(brandAccounts)
    .innerJoin(brandsT, eq(brandAccounts.brandId, brandsT.id))
    .where(eq(brandAccounts.isActive, true));

  const accountIds = accounts.map((a) => a.accountId);
  if (accountIds.length === 0) return [];

  const [metricRows, postRows, adRows] = await Promise.all([
    db
      .select({
        accountId: accountMetricsDaily.brandAccountId,
        date: accountMetricsDaily.date,
        followers: accountMetricsDaily.followers,
        engagementRate: accountMetricsDaily.engagementRate30d,
      })
      .from(accountMetricsDaily)
      .where(inArray(accountMetricsDaily.brandAccountId, accountIds))
      .orderBy(accountMetricsDaily.brandAccountId, accountMetricsDaily.date),
    db
      .select({
        accountId: postsT.brandAccountId,
        posts: sql<number>`count(distinct ${postsT.id})::int`,
        engagement: sql<number>`coalesce(sum(coalesce(${postMetricsDaily.likes}, 0) + coalesce(${postMetricsDaily.comments}, 0) + coalesce(${postMetricsDaily.views}, 0)), 0)::int`,
      })
      .from(postsT)
      .leftJoin(postMetricsDaily, eq(postMetricsDaily.postId, postsT.id))
      .where(inArray(postsT.brandAccountId, accountIds))
      .groupBy(postsT.brandAccountId),
    db
      .select({
        accountId: adsT.brandAccountId,
        activeAds: sql<number>`count(*) filter (where ${adsT.isActive} = true)::int`,
      })
      .from(adsT)
      .where(inArray(adsT.brandAccountId, accountIds))
      .groupBy(adsT.brandAccountId),
  ]);

  const latestMetric = new Map<string, { followers: number | null; engagementRate: number | null }>();
  for (const r of metricRows) latestMetric.set(r.accountId, { followers: r.followers ?? null, engagementRate: r.engagementRate ?? null });
  const postMap = new Map(postRows.map((r) => [r.accountId, r]));
  const adMap = new Map(adRows.map((r) => [r.accountId, r.activeAds]));
  const byBrand = new Map<string, PlatformMatrixRow>();

  for (const a of accounts) {
    const key = a.slug;
    if (!byBrand.has(key)) {
      byBrand.set(key, {
        brand: a.brand,
        slug: a.slug,
        totalScore: 0,
        platforms: ACTIVE_PLATFORMS.map((platform) => ({ platform, followers: null, posts: 0, activeAds: 0, engagement: 0, score: 0 })),
      });
    }
    const row = byBrand.get(key)!;
    const cell = row.platforms.find((p) => p.platform === a.platform);
    if (!cell) continue;
    const metric = latestMetric.get(a.accountId);
    const posts = postMap.get(a.accountId);
    cell.followers = metric?.followers ?? cell.followers;
    cell.posts += posts?.posts ?? 0;
    cell.activeAds += adMap.get(a.accountId) ?? 0;
    cell.engagement += posts?.engagement ?? 0;
    cell.score += (metric?.followers ?? 0) / 1000 + (posts?.posts ?? 0) * 4 + (adMap.get(a.accountId) ?? 0) * 8 + (posts?.engagement ?? 0) / 10000;
  }

  for (const row of byBrand.values()) row.totalScore = row.platforms.reduce((sum, p) => sum + p.score, 0);
  return [...byBrand.values()].sort((a, b) => b.totalScore - a.totalScore);
}

export async function getDataQualityStatus(): Promise<DataQualityStatus[]> {
  const db = getDb();
  const [runs, accounts] = await Promise.all([
    db
      .select({
        platform: collectionRuns.platform,
        status: collectionRuns.status,
        startedAt: collectionRuns.startedAt,
        finishedAt: collectionRuns.finishedAt,
      })
      .from(collectionRuns)
      .orderBy(desc(collectionRuns.startedAt))
      .limit(200),
    db
      .select({ platform: brandAccounts.platform, n: sql<number>`count(*)::int` })
      .from(brandAccounts)
      .where(eq(brandAccounts.isActive, true))
      .groupBy(brandAccounts.platform),
  ]);

  const accountMap = new Map(accounts.map((a) => [a.platform as Platform, a.n]));
  return ACTIVE_PLATFORMS.map((platform) => {
    const latest = runs.find((r) => r.platform === platform);
    const lastRun = toDateOnly(latest?.finishedAt ?? latest?.startedAt);
    const status =
      !latest ? "missing" : latest.status === "done" && latest.startedAt.getTime() > Date.now() - 36 * 60 * 60 * 1000 ? "fresh" : "stale";
    return {
      platform,
      status,
      lastRun,
      accounts: accountMap.get(platform) ?? 0,
      message:
        status === "fresh"
          ? "최근 수집 성공"
          : status === "stale"
            ? latest?.status === "error"
              ? "최근 수집 실패"
              : "수집 시점 오래됨"
            : "수집 기록 없음",
    };
  });
}

export async function getDashboardAlerts(limit = 5): Promise<DashboardAlert[]> {
  const [changes, quality] = await Promise.all([getRecentChanges(12), getDataQualityStatus()]);
  const alerts: DashboardAlert[] = [];
  for (const q of quality.filter((q) => q.status !== "fresh")) {
    alerts.push({
      id: `quality-${q.platform}`,
      severity: q.status === "missing" ? "high" : "medium",
      icon: q.status === "missing" ? "sync_problem" : "schedule",
      title: `${platformLabel(q.platform)} 데이터 상태 확인`,
      detail: q.message,
      linkTo: "/admin/runs",
    });
  }
  for (const c of changes) {
    if (c.kind === "follower_spike") {
      alerts.push({
        id: `spike-${c.id}`,
        severity: "high",
        icon: "trending_up",
        title: `${c.brand} 팔로워 급증`,
        detail: c.text ?? `${platformLabel(c.platform)}에서 변화 감지`,
        linkTo: c.linkTo,
      });
    } else if (c.kind === "new_ad") {
      alerts.push({
        id: `ad-${c.id}`,
        severity: "medium",
        icon: "campaign",
        title: `${c.brand} 신규 광고`,
        detail: c.text?.slice(0, 80) || `${platformLabel(c.platform)} 광고 활성화`,
        linkTo: c.linkTo,
      });
    }
  }
  return alerts.slice(0, limit);
}

export async function getSummary() {
  const db = getDb();
  const [
    [brandCount],
    [newBrands7d],
    [activeAds],
    [activeAdsYesterday],
    [weekPosts],
    [prevWeekPosts],
    [runsToday],
    [runsYesterday],
  ] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(brandsT),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(brandsT)
      .where(gte(brandsT.createdAt, sql`now() - interval '7 days'`)),
    db.select({ n: sql<number>`count(*)::int` }).from(adsT).where(eq(adsT.isActive, true)),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(adPresenceDaily)
      .where(and(eq(adPresenceDaily.date, sql`current_date - 1`), eq(adPresenceDaily.wasActive, true))),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(postsT)
      .where(gte(postsT.postedAt, sql`now() - interval '7 days'`)),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(postsT)
      .where(
        and(
          gte(postsT.postedAt, sql`now() - interval '14 days'`),
          sql`${postsT.postedAt} < now() - interval '7 days'`,
        ),
      ),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(collectionRuns)
      .where(and(eq(collectionRuns.status, "done"), gte(collectionRuns.startedAt, sql`now() - interval '1 day'`))),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(collectionRuns)
      .where(
        and(
          eq(collectionRuns.status, "done"),
          gte(collectionRuns.startedAt, sql`now() - interval '2 days'`),
          sql`${collectionRuns.startedAt} < now() - interval '1 day'`,
        ),
      ),
  ]);

  const brandsOverview = await getBrandsOverview();

  return {
    kpis: [
      {
        label: "추적 중인 브랜드",
        value: String(brandCount.n),
        icon: "analytics",
        delta: newBrands7d.n > 0 ? ({ dir: "up", text: `+${newBrands7d.n} 이번 주` } as KpiDelta) : undefined,
      },
      { label: "활성 광고", value: String(activeAds.n), icon: "ad_units", delta: pctDelta(activeAds.n, activeAdsYesterday.n) },
      { label: "최근 7일 신규 게시물", value: String(weekPosts.n), icon: "post_add", delta: pctDelta(weekPosts.n, prevWeekPosts.n) },
      { label: "오늘 완료된 수집", value: String(runsToday.n), icon: "sync", delta: pctDelta(runsToday.n, runsYesterday.n) },
    ],
    brands: brandsOverview,
  };
}

export async function getTrends(slug?: string, selectedPlatform?: Platform | "all") {
  const db = getDb();
  const platformFilter = selectedPlatform === "all" ? undefined : selectedPlatform;
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

  const brandMap = new Map<string, { slug: string; brand: string; n: number }>();
  for (const a of accounts) {
    const cur = brandMap.get(a.slug);
    if (cur) cur.n += a.n;
    else brandMap.set(a.slug, { slug: a.slug, brand: a.brand, n: a.n });
  }

  const base = (slug ? accounts.find((a) => a.slug === slug) : undefined) ?? accounts[0];
  if (!base) return null;

  const brandAccountsForTrends = accounts.filter((a) => a.slug === base.slug);
  const scopedAccounts = brandAccountsForTrends.filter((a) => !platformFilter || a.platform === platformFilter);
  const selectedAccounts = scopedAccounts.length ? scopedAccounts : brandAccountsForTrends;
  const allBrandAccountIds = brandAccountsForTrends.map((a) => a.accountId);
  const accountIds = selectedAccounts.map((a) => a.accountId);

  const selectedLabel =
    !platformFilter || selectedAccounts.length > 1
      ? "전체 매체"
      : selectedAccounts[0].handle;

  const rawFollowerRows = await db
    .select({
      accountId: accountMetricsDaily.brandAccountId,
      date: accountMetricsDaily.date,
      followers: accountMetricsDaily.followers,
      engagementRate: accountMetricsDaily.engagementRate30d,
    })
    .from(accountMetricsDaily)
    .where(inArray(accountMetricsDaily.brandAccountId, accountIds))
    .orderBy(accountMetricsDaily.date);

  const rawBrandFollowerRows = await db
    .select({
      accountId: accountMetricsDaily.brandAccountId,
      date: accountMetricsDaily.date,
      followers: accountMetricsDaily.followers,
    })
    .from(accountMetricsDaily)
    .where(inArray(accountMetricsDaily.brandAccountId, allBrandAccountIds))
    .orderBy(accountMetricsDaily.date);

  const followersByDate = new Map<string, number>();
  const engagementByDate = new Map<string, { sum: number; n: number }>();
  for (const r of rawFollowerRows) {
    if (r.followers != null) followersByDate.set(r.date, (followersByDate.get(r.date) ?? 0) + r.followers);
    if (r.engagementRate != null) {
      const cur = engagementByDate.get(r.date) ?? { sum: 0, n: 0 };
      cur.sum += r.engagementRate;
      cur.n += 1;
      engagementByDate.set(r.date, cur);
    }
  }
  const followerRows = [...followersByDate.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([date, followers]) => ({
      date,
      followers,
      engagementRate: engagementByDate.has(date) ? engagementByDate.get(date)!.sum / engagementByDate.get(date)!.n : null,
    }));

  const metricRows = await db
    .select({
      id: postsT.id,
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
    .leftJoin(postMetricsDaily, eq(postMetricsDaily.postId, postsT.id))
    .where(inArray(postsT.brandAccountId, accountIds))
    .groupBy(postsT.id, brandAccounts.platform)
    .orderBy(desc(sql`coalesce(max(${postMetricsDaily.likes}), 0) + coalesce(max(${postMetricsDaily.comments}), 0) + coalesce(max(${postMetricsDaily.views}), 0)`));

  const allBrandMetricRows = await db
    .select({
      id: postsT.id,
      platform: brandAccounts.platform,
      likes: sql<number | null>`max(${postMetricsDaily.likes})`,
      comments: sql<number | null>`max(${postMetricsDaily.comments})`,
      views: sql<number | null>`max(${postMetricsDaily.views})`,
    })
    .from(postsT)
    .innerJoin(brandAccounts, eq(postsT.brandAccountId, brandAccounts.id))
    .leftJoin(postMetricsDaily, eq(postMetricsDaily.postId, postsT.id))
    .where(inArray(postsT.brandAccountId, allBrandAccountIds))
    .groupBy(postsT.id, brandAccounts.platform);

  const topPosts = metricRows.slice(0, 8);

  const media = await firstMediaByOwner("post", topPosts.map((p) => p.id));
  const engagementValues = metricRows
    .map((p) => (p.likes ?? 0) + (p.comments ?? 0) + (p.views ?? 0))
    .filter((v) => v > 0)
    .sort((a, b) => a - b);
  const medianEngagement =
    engagementValues.length === 0
      ? 0
      : engagementValues.length % 2
        ? engagementValues[Math.floor(engagementValues.length / 2)]
        : (engagementValues[engagementValues.length / 2 - 1] + engagementValues[engagementValues.length / 2]) / 2;

  const weeklyRows = await db
    .select({
      date: postMetricsDaily.date,
      likes: postMetricsDaily.likes,
      comments: postMetricsDaily.comments,
      views: postMetricsDaily.views,
    })
    .from(postMetricsDaily)
    .innerJoin(postsT, eq(postMetricsDaily.postId, postsT.id))
    .where(and(inArray(postsT.brandAccountId, accountIds), gte(postMetricsDaily.date, sql`current_date - 28`)))
    .orderBy(postMetricsDaily.date);

  const weeklyMap = new Map<string, number>();
  for (const r of weeklyRows) {
    const d = new Date(`${r.date}T00:00:00Z`);
    const now = new Date();
    const diffDays = Math.max(0, Math.floor((Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - d.getTime()) / 86_400_000));
    const idx = Math.min(3, Math.floor(diffDays / 7));
    const label = `W${4 - idx}`;
    weeklyMap.set(label, (weeklyMap.get(label) ?? 0) + (r.likes ?? 0) + (r.comments ?? 0) + (r.views ?? 0));
  }
  const weeklyEngagement = ["W1", "W2", "W3", "W4"].map((week) => ({ week, value: weeklyMap.get(week) ?? 0 }));

  const allMetricRows = await db
    .select({
      accountId: accountMetricsDaily.brandAccountId,
      date: accountMetricsDaily.date,
      engagementRate: accountMetricsDaily.engagementRate30d,
    })
    .from(accountMetricsDaily)
    .orderBy(accountMetricsDaily.brandAccountId, accountMetricsDaily.date);
  const latestByAccount = new Map<string, number>();
  for (const r of allMetricRows) {
    if (r.engagementRate != null) latestByAccount.set(r.accountId, r.engagementRate);
  }
  const engagementRate = followerRows.at(-1)?.engagementRate ?? null;
  const distribution = [...latestByAccount.values()].sort((a, b) => a - b);
  const percentile =
    engagementRate != null && distribution.length >= 3
      ? Math.round((distribution.filter((v) => v <= engagementRate).length / distribution.length) * 100)
      : null;
  const band = percentile == null ? "N/A" : percentile >= 90 ? "High" : percentile >= 50 ? "Mid" : "Low";

  const platformBreakdown = brandAccountsForTrends.map((a) => {
    const latest = rawBrandFollowerRows.filter((r) => r.accountId === a.accountId).at(-1);
    const posts = allBrandMetricRows.filter((p) => p.platform === a.platform);
    const engagement = posts.reduce((sum, p) => sum + (p.likes ?? 0) + (p.comments ?? 0) + (p.views ?? 0), 0);
    return {
      platform: a.platform as Platform,
      handle: a.handle,
      posts: posts.length,
      followers: latest?.followers ?? null,
      engagement,
      active: selectedAccounts.some((s) => s.accountId === a.accountId),
    };
  });

  const contentClusters = [...metricRows.reduce((map, p) => {
    const tag = contentTagOf(p.caption, p.format);
    const cur = map.get(tag) ?? { tag, posts: 0, engagement: 0, examples: [] as string[] };
    cur.posts += 1;
    cur.engagement += engagementOf(p);
    if (p.caption && cur.examples.length < 2) cur.examples.push(p.caption);
    map.set(tag, cur);
    return map;
  }, new Map<string, { tag: string; posts: number; engagement: number; examples: string[] }>()).values()]
    .map((c) => ({ ...c, avgEngagement: c.posts ? Math.round(c.engagement / c.posts) : 0 }))
    .sort((a, b) => b.engagement - a.engagement)
    .slice(0, 6);

  const topPlatform = [...platformBreakdown].sort((a, b) => b.engagement + (b.followers ?? 0) / 100 - (a.engagement + (a.followers ?? 0) / 100))[0];
  const topCluster = contentClusters[0] ?? null;
  const followerDelta =
    followerRows.length >= 2 ? followerRows.at(-1)!.followers - followerRows[0].followers : null;
  const insights = [
    topPlatform
      ? `${platformLabel(topPlatform.platform)}가 현재 가장 강한 채널입니다. 게시물 ${topPlatform.posts}개, 반응 ${topPlatform.engagement.toLocaleString()} 기준입니다.`
      : "채널별 성과 데이터가 더 쌓이면 주력 채널이 표시됩니다.",
    topCluster
      ? `${topCluster.tag} 콘텐츠가 반응을 가장 많이 만들고 있습니다. 평균 반응은 ${topCluster.avgEngagement.toLocaleString()}입니다.`
      : "콘텐츠 클러스터는 게시물 텍스트가 누적되면 표시됩니다.",
    followerDelta == null
      ? "팔로워 추세는 2일 이상 계정 지표가 수집되면 계산됩니다."
      : followerDelta >= 0
        ? `선택 범위 팔로워가 ${followerDelta.toLocaleString()}명 증가했습니다.`
        : `선택 범위 팔로워가 ${Math.abs(followerDelta).toLocaleString()}명 감소했습니다.`,
  ];

  const metaAccountIds = brandAccountsForTrends.filter((a) => a.platform === "meta_ads").map((a) => a.accountId);
  const metaAds =
    metaAccountIds.length === 0
      ? {
          active: 0,
          new7d: 0,
          inactive7d: 0,
          avgDaysActive: null as number | null,
          longestActive: null as { id: string; daysActive: number; copy: string | null } | null,
          creativeReuse: 0,
          ctaMix: [] as { cta: string; count: number }[],
        }
      : await (async () => {
          const rows = await db
            .select({
              id: adsT.id,
              copy: adsT.adCopy,
              isActive: adsT.isActive,
              daysActive: adsT.daysActive,
              firstSeen: adsT.firstSeen,
              lastSeen: adsT.lastSeen,
              raw: adsT.raw,
            })
            .from(adsT)
            .where(inArray(adsT.brandAccountId, metaAccountIds));
          const activeRows = rows.filter((r) => r.isActive);
          const cta = new Map<string, number>();
          let creativeReuse = 0;
          for (const r of rows) {
            const meta = extractAdMeta(r.raw);
            if (meta.variantCount && meta.variantCount > 1) creativeReuse += meta.variantCount;
            if (meta.cta) cta.set(meta.cta, (cta.get(meta.cta) ?? 0) + 1);
          }
          const activeDays = activeRows.map((r) => r.daysActive ?? 0).filter((v) => v > 0);
          return {
            active: activeRows.length,
            new7d: rows.filter((r) => r.firstSeen >= new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10)).length,
            inactive7d: rows.filter((r) => !r.isActive && r.lastSeen >= new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10)).length,
            avgDaysActive: activeDays.length ? Math.round(activeDays.reduce((sum, v) => sum + v, 0) / activeDays.length) : null,
            longestActive: activeRows
              .sort((a, b) => (b.daysActive ?? 0) - (a.daysActive ?? 0))
              .map((r) => ({ id: r.id, daysActive: r.daysActive ?? 0, copy: r.copy }))
              .at(0) ?? null,
            creativeReuse,
            ctaMix: [...cta.entries()].map(([cta, count]) => ({ cta, count })).sort((a, b) => b.count - a.count).slice(0, 5),
          };
        })();

  return {
    account: {
      brand: base.brand,
      slug: base.slug,
      platform: (platformFilter ?? "all") as Platform | "all",
      handle: selectedLabel,
      followers: followerRows.at(-1)?.followers ?? null,
      engagementRate,
      benchmark: { percentile, band },
    },
    allAccounts: [...brandMap.values()].sort((a, b) => b.n - a.n),
    platformBreakdown,
    insights,
    contentClusters,
    metaAds,
    followerSeries: followerRows.map((r) => ({ date: r.date, value: r.followers ?? 0 })),
    weeklyEngagement,
    topPosts: topPosts.map((p) => {
      const engagement = (p.likes ?? 0) + (p.comments ?? 0) + (p.views ?? 0);
      return {
        ...p,
        platform: p.platform as Platform,
        postedAt: p.postedAt ? p.postedAt.toISOString().slice(0, 10) : null,
        engagement,
        status: medianEngagement > 0 && engagement >= medianEngagement * 3 ? "VIRAL" : "STABLE",
        imageUrl: media.get(p.id) ?? null,
      };
    }),
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
    const kwRows = await db
      .select({ keyword: commentKeywords.keyword, kind: commentKeywords.kind, count: commentKeywords.count })
      .from(commentKeywords)
      .where(eq(commentKeywords.postId, id));
    const [{ total } = { total: 0 }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(commentsT)
      .where(eq(commentsT.postId, id));
    const top = kwRows
      .filter((k) => k.kind === "top")
      .sort((a, b) => b.count - a.count)
      .map((k) => ({ keyword: k.keyword, count: k.count }));
    const focusStored = new Map(kwRows.filter((k) => k.kind === "focus").map((k) => [k.keyword, k.count]));
    // FOCUS_KEYWORDS 전체를 노출(미언급=0), 언급 많은 순
    const focus = FOCUS_KEYWORDS.map((kw) => ({ keyword: kw, count: focusStored.get(kw) ?? 0 })).sort(
      (a, b) => b.count - a.count,
    );
    const commentKw =
      top.length > 0 || total > 0 ? { top, focus, totalComments: total } : null;
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
      commentKeywords: commentKw,
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
      raw: adsT.raw,
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
    commentKeywords: null,
    ad: {
      destinationUrl: a.destinationUrl,
      landingDomain: a.landingDomain,
      firstSeen: a.firstSeen,
      lastSeen: a.lastSeen,
      daysActive: a.daysActive,
      isActive: a.isActive,
      ...extractAdMeta(a.raw),
    },
  };
}

// Meta Ad Library raw 에서 유효·유용한 지표 추출.
// (노출·지출·CTR 은 상업광고라 Meta 가 비공개 → null. 아래는 실제로 채워지는 필드만.)
function epochToDate(v: unknown): string | null {
  if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) return null;
  const ms = v > 1e12 ? v : v * 1000;
  return new Date(ms).toISOString().slice(0, 10);
}

function extractAdMeta(raw: unknown) {
  const o = (raw ?? {}) as Record<string, any>;
  const s = (o.snapshot ?? {}) as Record<string, any>;
  const cards = Array.isArray(s.cards) ? s.cards.length : 0;
  const images = Array.isArray(s.images) ? s.images.length : 0;
  const videos = Array.isArray(s.videos) ? s.videos.length : 0;
  return {
    // 노출 지면 (어떤 플랫폼에 게재 중인지) — Facebook / Instagram / Audience Network / Messenger
    platforms: (Array.isArray(o.publisherPlatform) ? o.publisherPlatform : []) as string[],
    // 원본 광고 포맷: DCO(동적 크리에이티브) / CAROUSEL / VIDEO / IMAGE
    displayFormat: typeof s.displayFormat === "string" ? s.displayFormat : null,
    // 행동유도 버튼
    cta: typeof s.ctaText === "string" && s.ctaText ? s.ctaText : null,
    // 광고주 페이지 카테고리
    pageCategories: (Array.isArray(s.pageCategories) ? s.pageCategories : []) as string[],
    // 광고주 페이지 좋아요(팔로워) 수 — 0 이거나 비공개면 null
    pageLikeCount: typeof s.pageLikeCount === "number" && s.pageLikeCount > 0 ? s.pageLikeCount : null,
    // 묶음(변형) 광고 수 — 같은 크리에이티브 그룹으로 동시 게재 중인 변형 개수
    variantCount: typeof o.collationCount === "number" && o.collationCount > 1 ? o.collationCount : null,
    // 이 광고의 크리에이티브(카드/이미지/영상) 개수
    creativeCount: cards + images + videos || null,
    // 게재 예정 기간(스케줄) — firstSeen/lastSeen(우리가 관측한 기간)과 별개
    scheduledStart: epochToDate(o.startDate),
    scheduledEnd: epochToDate(o.endDate),
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
    .select({ postedAt: postsT.postedAt, platform: brandAccounts.platform, format: postsT.format })
    .from(postsT)
    .innerJoin(brandAccounts, eq(postsT.brandAccountId, brandAccounts.id))
    .where(sql`${postsT.postedAt} is not null`);

  const byDate = new Map<string, { count: number; platforms: Set<Platform> }>();
  const byPlatform = new Map<Platform, number>();
  const byFormat = new Map<string, number>();
  const byHour = new Map<number, number>();
  const latest = rows.reduce<Date | null>((max, r) => {
    if (!r.postedAt) return max;
    return !max || r.postedAt > max ? r.postedAt : max;
  }, null);
  const monthKey = latest ? latest.toISOString().slice(0, 7) : new Date().toISOString().slice(0, 7);
  let totalMTD = 0;
  for (const r of rows) {
    if (!r.postedAt) continue;
    const key = r.postedAt.toISOString().slice(0, 10);
    if (!byDate.has(key)) byDate.set(key, { count: 0, platforms: new Set() });
    const e = byDate.get(key)!;
    e.count++;
    e.platforms.add(r.platform as Platform);
    byPlatform.set(r.platform as Platform, (byPlatform.get(r.platform as Platform) ?? 0) + 1);
    byFormat.set(r.format ?? "unknown", (byFormat.get(r.format ?? "unknown") ?? 0) + 1);
    byHour.set(r.postedAt.getHours(), (byHour.get(r.postedAt.getHours()) ?? 0) + 1);
    if (key.startsWith(monthKey)) totalMTD++;
  }
  const days = [...byDate.entries()]
    .map(([date, v]) => ({ date, count: v.count, platforms: [...v.platforms] }))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  const totalPosts = rows.length;
  const formatMix = [...byFormat.entries()]
    .map(([format, count]) => ({ format, count, pct: totalPosts ? Math.round((count / totalPosts) * 100) : 0 }))
    .sort((a, b) => b.count - a.count);
  const firstDate = days.length ? new Date(`${days[days.length - 1].date}T00:00:00Z`) : null;
  const lastDate = days.length ? new Date(`${days[0].date}T00:00:00Z`) : null;
  const weeks = firstDate && lastDate ? Math.max(1, Math.ceil((lastDate.getTime() - firstDate.getTime() + 86_400_000) / (7 * 86_400_000))) : 1;
  const weeklyFrequency = [...byPlatform.entries()]
    .map(([platform, count]) => ({ platform, count, postsPerWeek: Math.round((count / weeks) * 10) / 10 }))
    .sort((a, b) => b.postsPerWeek - a.postsPerWeek);
  const activeDaysMTD = days.filter((d) => d.date.startsWith(monthKey)).length;
  const avgDailyCadence = activeDaysMTD ? Math.round((totalMTD / activeDaysMTD) * 10) / 10 : 0;
  const peak = [...byHour.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;
  const peakHour = peak ? `${String(peak[0]).padStart(2, "0")}:00` : null;
  const quiet = days.length
    ? ["일", "월", "화", "수", "목", "금", "토"][
        [...Array(7).keys()]
          .map((day) => ({
            day,
            count: rows.filter((r) => r.postedAt && r.postedAt.getDay() === day).length,
          }))
          .sort((a, b) => a.count - b.count)[0].day
      ]
    : null;

  return {
    days,
    monthKey,
    formatMix,
    weeklyFrequency,
    kpis: {
      totalMTD,
      avgDailyCadence,
      peakHour,
      optimizationTip: quiet ? `${quiet}요일 게시 공백이 가장 큽니다. 테스트 슬롯을 하나 배정해 보세요.` : "게시 데이터가 누적되면 최적화 팁이 표시됩니다.",
    },
  };
}

// 팔로워 성장: accountMetricsDaily.followers 를 날짜별 합산(최근 30일) + 플랫폼별 현재 + 집계 델타.
export async function getFollowerGrowth() {
  const db = getDb();
  const rows = await db
    .select({
      date: accountMetricsDaily.date,
      platform: brandAccounts.platform,
      followers: accountMetricsDaily.followers,
    })
    .from(accountMetricsDaily)
    .innerJoin(brandAccounts, eq(accountMetricsDaily.brandAccountId, brandAccounts.id))
    .where(gte(accountMetricsDaily.date, sql`current_date - 30`))
    .orderBy(accountMetricsDaily.date);

  const totalByDate = new Map<string, number>();
  for (const r of rows) {
    if (r.followers == null) continue;
    totalByDate.set(r.date, (totalByDate.get(r.date) ?? 0) + r.followers);
  }
  const series = [...totalByDate.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([date, total]) => ({ date, total }));

  // 최신 날짜의 플랫폼별 팔로워 합
  const latestDate = series.length ? series[series.length - 1].date : null;
  const byPlatformMap = new Map<Platform, number>();
  if (latestDate) {
    for (const r of rows) {
      if (r.date !== latestDate || r.followers == null) continue;
      byPlatformMap.set(r.platform as Platform, (byPlatformMap.get(r.platform as Platform) ?? 0) + r.followers);
    }
  }
  const byPlatform = [...byPlatformMap.entries()]
    .map(([platform, followers]) => ({ platform, followers }))
    .sort((a, b) => b.followers - a.followers);

  const first = series.length ? series[0].total : 0;
  const last = series.length ? series[series.length - 1].total : 0;
  const deltaPct = series.length >= 2 && first > 0 ? Math.round(((last - first) / first) * 1000) / 10 : null;

  return { series, byPlatform, deltaPct };
}

export type RecentChangeKind = "new_ad" | "ad_inactive" | "follower_spike" | "new_post";
export type RecentChange = {
  id: string;
  kind: RecentChangeKind;
  brand: string;
  platform: Platform;
  text: string | null;
  when: string; // YYYY-MM-DD
  imageUrl: string | null;
  linkTo: string;
};

// 팔로워 급증 감지 임계값(24h, %).
const FOLLOWER_SPIKE_PCT = 3;

// 최근 변경: 신규 광고 / 광고 비활성화 / 팔로워 급증 / (부족 시)신규 포스트.
export async function getRecentChanges(limit = 6): Promise<RecentChange[]> {
  const db = getDb();

  // (a) 신규 광고 — 최근 firstSeen
  const newAds = await db
    .select({
      id: adsT.id,
      brand: brandsT.name,
      platform: brandAccounts.platform,
      copy: adsT.adCopy,
      when: adsT.firstSeen,
    })
    .from(adsT)
    .innerJoin(brandAccounts, eq(adsT.brandAccountId, brandAccounts.id))
    .innerJoin(brandsT, eq(brandAccounts.brandId, brandsT.id))
    .orderBy(desc(adsT.firstSeen))
    .limit(limit);

  // (b) 광고 비활성화 — isActive=false, 최근 lastSeen
  const inactiveAds = await db
    .select({
      id: adsT.id,
      brand: brandsT.name,
      platform: brandAccounts.platform,
      copy: adsT.adCopy,
      when: adsT.lastSeen,
    })
    .from(adsT)
    .innerJoin(brandAccounts, eq(adsT.brandAccountId, brandAccounts.id))
    .innerJoin(brandsT, eq(brandAccounts.brandId, brandsT.id))
    .where(eq(adsT.isActive, false))
    .orderBy(desc(adsT.lastSeen))
    .limit(limit);

  // (c) 팔로워 급증 — 최근 7일 계정별 최소/최대 팔로워 비교
  const metricRows = await db
    .select({
      brand: brandsT.name,
      slug: brandsT.slug,
      platform: brandAccounts.platform,
      date: accountMetricsDaily.date,
      followers: accountMetricsDaily.followers,
    })
    .from(accountMetricsDaily)
    .innerJoin(brandAccounts, eq(accountMetricsDaily.brandAccountId, brandAccounts.id))
    .innerJoin(brandsT, eq(brandAccounts.brandId, brandsT.id))
    .where(gte(accountMetricsDaily.date, sql`current_date - 7`))
    .orderBy(accountMetricsDaily.date);

  type Acc = { brand: string; slug: string; platform: Platform; firstF: number; lastF: number; lastDate: string };
  const perAccount = new Map<string, Acc>();
  for (const r of metricRows) {
    if (r.followers == null) continue;
    const key = `${r.brand}|${r.platform}`;
    const cur = perAccount.get(key);
    if (!cur) {
      perAccount.set(key, {
        brand: r.brand,
        slug: r.slug,
        platform: r.platform as Platform,
        firstF: r.followers,
        lastF: r.followers,
        lastDate: r.date,
      });
    } else {
      cur.lastF = r.followers;
      cur.lastDate = r.date;
    }
  }
  const spikes: RecentChange[] = [];
  for (const a of perAccount.values()) {
    if (a.firstF > 0 && (a.lastF - a.firstF) / a.firstF >= FOLLOWER_SPIKE_PCT / 100) {
      const gain = a.lastF - a.firstF;
      spikes.push({
        id: `${a.slug}-${a.platform}`,
        kind: "follower_spike",
        brand: a.brand,
        platform: a.platform,
        text: `팔로워 +${gain.toLocaleString()} (최근 7일)`,
        when: a.lastDate,
        imageUrl: null,
        linkTo: `/brands/${a.slug}`,
      });
    }
  }

  // 이벤트 병합
  const adMedia = await firstMediaByOwner("ad", [...newAds, ...inactiveAds].map((a) => a.id));
  const events: RecentChange[] = [
    ...newAds.map((a) => ({
      id: a.id,
      kind: "new_ad" as const,
      brand: a.brand,
      platform: a.platform as Platform,
      text: a.copy,
      when: a.when,
      imageUrl: adMedia.get(a.id) ?? null,
      linkTo: `/item/ad/${a.id}`,
    })),
    ...inactiveAds.map((a) => ({
      id: a.id,
      kind: "ad_inactive" as const,
      brand: a.brand,
      platform: a.platform as Platform,
      text: a.copy,
      when: a.when,
      imageUrl: adMedia.get(a.id) ?? null,
      linkTo: `/item/ad/${a.id}`,
    })),
    ...spikes,
  ];

  // 부족하면 최신 포스트로 보충
  if (events.length < limit) {
    const posts = await db
      .select({
        id: postsT.id,
        brand: brandsT.name,
        platform: brandAccounts.platform,
        caption: postsT.caption,
        postedAt: postsT.postedAt,
      })
      .from(postsT)
      .innerJoin(brandAccounts, eq(postsT.brandAccountId, brandAccounts.id))
      .innerJoin(brandsT, eq(brandAccounts.brandId, brandsT.id))
      .orderBy(desc(postsT.postedAt))
      .limit(limit);
    const postMedia = await firstMediaByOwner("post", posts.map((p) => p.id));
    for (const p of posts) {
      events.push({
        id: p.id,
        kind: "new_post",
        brand: p.brand,
        platform: p.platform as Platform,
        text: p.caption,
        when: p.postedAt ? p.postedAt.toISOString().slice(0, 10) : "",
        imageUrl: postMedia.get(p.id) ?? null,
        linkTo: `/item/post/${p.id}`,
      });
    }
  }

  return events
    .sort((a, b) => (a.when < b.when ? 1 : a.when > b.when ? -1 : 0))
    .slice(0, limit);
}
