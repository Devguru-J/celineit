import { type NormalizedAd, type NormalizedResult, TARGET_COUNTRY, emptyResult, landingDomainOf } from "@celine/shared";
import { pick, str, type AccountInput, type PlatformAdapter } from "./types";

// Meta Ad Library 스크래퍼 (apify/facebook-ads-scraper).
// 입력: Ad Library 검색 URL(startUrls). 출력: adArchiveID + snapshot{body,images,videos,linkUrl,...}.
export const metaAdsAdapter: PlatformAdapter = {
  platform: "meta_ads",
  defaultActor: "apify~facebook-ads-scraper",

  buildInput(account: AccountInput, opts) {
    const extra = (account.apifyInput ?? {}) as Record<string, unknown>;
    const country = (extra.country as string) ?? TARGET_COUNTRY;
    const searchUrl =
      account.profileUrl ??
      `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=${country}` +
        `&q=${encodeURIComponent(account.handle)}&search_type=keyword_unordered&media_type=all`;
    return {
      startUrls: [{ url: searchUrl }],
      maxItems: opts.maxItems,
      count: opts.maxItems,
      ...extra,
    };
  },

  normalize(rawItems: unknown[]): NormalizedResult {
    const result = emptyResult();
    for (const item of rawItems) {
      const platformAdId = str(pick(item, "adArchiveID", "adArchiveId", "ad_archive_id", "adId"));
      if (!platformAdId) continue;

      const snapshot = pick<Record<string, unknown>>(item, "snapshot") ?? {};

      // body 는 {text} 객체이거나 문자열
      const bodyRaw = pick(snapshot, "body");
      const adCopy =
        str(pick(bodyRaw, "text")) ??
        str(bodyRaw) ??
        str(pick(snapshot, "caption", "title", "linkDescription")) ??
        null;

      const linkUrl = str(pick(snapshot, "linkUrl", "link_url")) ?? str(pick(item, "linkUrl"));

      // 미디어: images / videos / cards(carousel)
      const mediaUrls: string[] = [];
      const images = arr(pick(snapshot, "images"));
      for (const img of images) {
        const u = str(pick(img, "originalImageUrl", "resizedImageUrl", "url", "original_image_url"));
        if (u) mediaUrls.push(u);
      }
      const videos = arr(pick(snapshot, "videos"));
      for (const v of videos) {
        const poster = str(pick(v, "videoPreviewImageUrl")); // 커버(이미지) 먼저 → 썸네일용
        if (poster) mediaUrls.push(poster);
        const u = str(pick(v, "videoHdUrl", "videoSdUrl", "video_hd_url", "video_sd_url", "url"));
        if (u) mediaUrls.push(u);
      }
      const cards = arr(pick(snapshot, "cards"));
      for (const c of cards) {
        const u = str(pick(c, "resizedImageUrl", "originalImageUrl", "videoSdUrl"));
        if (u) mediaUrls.push(u);
      }

      const displayFormat = str(pick(snapshot, "displayFormat"))?.toUpperCase();
      const format =
        videos.length || displayFormat === "VIDEO"
          ? "video"
          : cards.length > 1 || displayFormat === "CAROUSEL" || images.length > 1
            ? "carousel"
            : "image";

      const isActiveRaw = pick(item, "isActive", "is_active");
      const seenActive = isActiveRaw === undefined ? true : Boolean(isActiveRaw);

      const startDate = isoDate(pick(item, "startDateFormatted")) ?? epochDate(pick(item, "startDate"));
      const endDate = isoDate(pick(item, "endDateFormatted")) ?? epochDate(pick(item, "endDate"));

      const ad: NormalizedAd = {
        platformAdId,
        adCopy,
        format,
        destinationUrl: linkUrl ?? null,
        landingDomain: landingDomainOf(linkUrl),
        mediaUrls,
        seenActive,
        startDate,
        endDate,
        raw: item,
      };
      result.ads.push(ad);
    }
    return result;
  },
};

function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function isoDate(v: unknown): string | null {
  return typeof v === "string" && v.length >= 10 ? v.slice(0, 10) : null;
}

function epochDate(v: unknown): string | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  const ms = v > 1e12 ? v : v * 1000; // 초/밀리초 모두 허용
  return new Date(ms).toISOString().slice(0, 10);
}
