import { type NormalizedAd, type NormalizedResult, emptyResult, landingDomainOf } from "@celine/shared";
import { pick, str, type AccountInput, type PlatformAdapter } from "./types";

// Meta Ad Library 스크래퍼 (예: curious_coder/facebook-ads-library-scraper).
// 광고지면은 "활성 광고 스냅샷" — 오늘 보이면 seenActive=true.
export const metaAdsAdapter: PlatformAdapter = {
  platform: "meta_ads",
  defaultActor: "curious_coder~facebook-ads-library-scraper",

  buildInput(account: AccountInput, opts) {
    return {
      // page_id 또는 검색어를 handle 로 받음
      urls: account.profileUrl ? [{ url: account.profileUrl }] : undefined,
      searchTerms: account.profileUrl ? undefined : [account.handle],
      country: "KR",
      activeStatus: "active",
      count: opts.maxItems,
      ...(account.apifyInput ?? {}),
    };
  },

  normalize(rawItems: unknown[]): NormalizedResult {
    const result = emptyResult();
    for (const item of rawItems) {
      const platformAdId = str(pick(item, "ad_archive_id", "adArchiveID", "adArchiveId", "id"));
      if (!platformAdId) continue;

      const snapshot = pick<Record<string, unknown>>(item, "snapshot") ?? {};
      const body =
        str(pick(snapshot, "body", "caption")) ??
        str(pick(item, "ad_creative_body", "adCreativeBody", "text"));
      const linkUrl = str(pick(snapshot, "link_url", "linkUrl")) ?? str(pick(item, "link_url"));

      // 미디어 (이미지/비디오)
      const mediaUrls: string[] = [];
      const images = pick<unknown[]>(snapshot, "images") ?? [];
      for (const img of Array.isArray(images) ? images : []) {
        const u = str(pick(img, "original_image_url", "resized_image_url", "url"));
        if (u) mediaUrls.push(u);
      }
      const videos = pick<unknown[]>(snapshot, "videos") ?? [];
      for (const v of Array.isArray(videos) ? videos : []) {
        const u = str(pick(v, "video_sd_url", "video_hd_url", "url"));
        if (u) mediaUrls.push(u);
      }

      const isActiveRaw = pick(item, "is_active", "isActive");
      const seenActive = isActiveRaw === undefined ? true : Boolean(isActiveRaw);

      const ad: NormalizedAd = {
        platformAdId,
        adCopy: body ?? null,
        format: videos.length ? "video" : mediaUrls.length > 1 ? "carousel" : "image",
        destinationUrl: linkUrl ?? null,
        landingDomain: landingDomainOf(linkUrl),
        mediaUrls,
        seenActive,
        raw: item,
      };
      result.ads.push(ad);
    }
    return result;
  },
};
