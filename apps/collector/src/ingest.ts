// 적재 로직 (스펙 §4 "적재 로직"): upsert + 스냅샷 append + longevity 재계산.
// 멱등성: 모든 쓰기가 upsert/PK 기반이라 같은 날 재실행해도 중복/오염 없음.

import {
  accountMetricsDaily,
  adPresenceDaily,
  ads as adsTable,
  type Database,
  mediaAssets,
  postMetricsDaily,
  posts as postsTable,
} from "@celine/db";
import type { NormalizedResult, Platform } from "@celine/shared";
import { and, eq, notInArray, sql } from "drizzle-orm";

export interface IngestParams {
  brandAccountId: string;
  platform: Platform;
  date: string; // YYYY-MM-DD (수집 기준일)
  result: NormalizedResult;
}

export interface IngestStats {
  adsUpserted: number;
  adsInactivated: number;
  postsUpserted: number;
  metricsWritten: number;
  mediaLinked: number;
}

export async function ingestResult(db: Database, params: IngestParams): Promise<IngestStats> {
  const { brandAccountId, platform, date, result } = params;
  const stats: IngestStats = {
    adsUpserted: 0,
    adsInactivated: 0,
    postsUpserted: 0,
    metricsWritten: 0,
    mediaLinked: 0,
  };

  const seenAdIds: string[] = [];

  // ── 광고 upsert + presence + longevity ──
  for (const ad of result.ads) {
    // Meta Ad Library 처럼 실제 광고 기간이 있으면 그걸 사용, 없으면 관측일 기준
    const firstSeen = ad.startDate ?? date;
    const lastSeen = ad.endDate ?? date;

    const [row] = await db
      .insert(adsTable)
      .values({
        brandAccountId,
        platformAdId: ad.platformAdId,
        adCopy: ad.adCopy,
        format: ad.format,
        destinationUrl: ad.destinationUrl,
        landingDomain: ad.landingDomain,
        firstSeen,
        lastSeen,
        isActive: ad.seenActive,
        daysActive: 0,
        raw: ad.raw,
      })
      .onConflictDoUpdate({
        target: [adsTable.brandAccountId, adsTable.platformAdId],
        set: {
          // 실제 시작일이 있을 때만 firstSeen 갱신 (스냅샷 모델에선 최초 관측일 유지)
          ...(ad.startDate ? { firstSeen } : {}),
          lastSeen,
          isActive: ad.seenActive,
          adCopy: ad.adCopy,
          format: ad.format,
          destinationUrl: ad.destinationUrl,
          landingDomain: ad.landingDomain,
          raw: ad.raw,
        },
      })
      .returning({ id: adsTable.id });

    seenAdIds.push(row.id);
    stats.adsUpserted++;

    // presence 스냅샷 (PK: ad_id + date)
    await db
      .insert(adPresenceDaily)
      .values({ adId: row.id, date, wasActive: ad.seenActive })
      .onConflictDoUpdate({
        target: [adPresenceDaily.adId, adPresenceDaily.date],
        set: { wasActive: ad.seenActive },
      });

    if (ad.startDate) {
      // 실제 기간 기반 longevity (시작~종료 일수)
      await db
        .update(adsTable)
        .set({ daysActive: daysBetween(firstSeen, lastSeen) + 1 })
        .where(eq(adsTable.id, row.id));
    } else {
      await recomputeDaysActive(db, row.id);
    }
    stats.mediaLinked += await linkMedia(db, "ad", row.id, ad.mediaUrls);
  }

  // ── 오늘 안 보인 활성 광고 → 비활성 처리 (longevity 종료) ──
  // 실패/빈 스크래이프로 전체를 비활성화하는 사고를 막기 위해, 광고가 1건 이상 관측된 경우에만 수행.
  if (result.ads.length > 0) {
    const stale = await db
      .update(adsTable)
      .set({ isActive: false })
      .where(
        and(
          eq(adsTable.brandAccountId, brandAccountId),
          eq(adsTable.isActive, true),
          notInArray(adsTable.id, seenAdIds),
        ),
      )
      .returning({ id: adsTable.id });
    for (const s of stale) {
      await db
        .insert(adPresenceDaily)
        .values({ adId: s.id, date, wasActive: false })
        .onConflictDoUpdate({
          target: [adPresenceDaily.adId, adPresenceDaily.date],
          set: { wasActive: false },
        });
    }
    stats.adsInactivated = stale.length;
  }

  // ── 포스트 upsert + 일별 지표 ──
  for (const post of result.posts) {
    const [row] = await db
      .insert(postsTable)
      .values({
        brandAccountId,
        platformPostId: post.platformPostId,
        caption: post.caption,
        format: post.format,
        permalink: post.permalink,
        postedAt: post.postedAt ? new Date(post.postedAt) : null,
        raw: post.raw,
      })
      .onConflictDoUpdate({
        target: [postsTable.brandAccountId, postsTable.platformPostId],
        set: {
          caption: post.caption,
          format: post.format,
          permalink: post.permalink,
          postedAt: post.postedAt ? new Date(post.postedAt) : null,
          raw: post.raw,
        },
      })
      .returning({ id: postsTable.id });

    stats.postsUpserted++;

    const m = post.metrics;
    if (m.likes !== undefined || m.comments !== undefined || m.views !== undefined) {
      await db
        .insert(postMetricsDaily)
        .values({
          postId: row.id,
          date,
          likes: m.likes,
          comments: m.comments,
          views: m.views,
          shares: m.shares,
          saves: m.saves,
        })
        .onConflictDoUpdate({
          target: [postMetricsDaily.postId, postMetricsDaily.date],
          set: { likes: m.likes, comments: m.comments, views: m.views, shares: m.shares, saves: m.saves },
        });
    }

    stats.mediaLinked += await linkMedia(db, "post", row.id, post.mediaUrls);
  }

  // ── 계정 단위 지표 (팔로워 등) ──
  if (result.accountMetric) {
    const a = result.accountMetric;
    await db
      .insert(accountMetricsDaily)
      .values({
        brandAccountId,
        date,
        followers: a.followers,
        following: a.following,
        postsCount: a.postsCount,
        engagementRate30d: a.engagementRate30d,
      })
      .onConflictDoUpdate({
        target: [accountMetricsDaily.brandAccountId, accountMetricsDaily.date],
        set: {
          followers: a.followers,
          following: a.following,
          postsCount: a.postsCount,
          engagementRate30d: a.engagementRate30d,
        },
      });
    stats.metricsWritten++;
  }

  return stats;
}

// days_active = 활성으로 관측된 날의 수 (pause/resume 정확 반영).
async function recomputeDaysActive(db: Database, adId: string): Promise<void> {
  await db
    .update(adsTable)
    .set({
      daysActive: sql`(select count(*)::int from ${adPresenceDaily} where ${adPresenceDaily.adId} = ${adId} and ${adPresenceDaily.wasActive} = true)`,
    })
    .where(eq(adsTable.id, adId));
}

function daysBetween(a: string, b: string): number {
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return Math.max(0, Math.round(ms / 86_400_000));
}

async function linkMedia(
  db: Database,
  ownerType: "ad" | "post",
  ownerId: string,
  urls: string[],
): Promise<number> {
  let n = 0;
  for (const url of urls) {
    if (!url) continue;
    const kind = /\.mp4|\/video|video_/i.test(url) ? "video" : "image";
    const res = await db
      .insert(mediaAssets)
      .values({ ownerType, ownerId, originalUrl: url, kind, r2Key: null })
      .onConflictDoNothing({ target: [mediaAssets.ownerType, mediaAssets.ownerId, mediaAssets.originalUrl] })
      .returning({ id: mediaAssets.id });
    n += res.length;
  }
  return n;
}
