import {
  type NormalizedAd,
  type NormalizedResult,
  TARGET_COUNTRY,
  emptyResult,
  landingDomainOf,
} from "@celine/shared";
import { pick, str, type AccountInput, type PlatformAdapter } from "./types";

// TikTok Ad Library 스크래퍼.
// 입력: region + 광고주/키워드 검색. 출력: 광고별 텍스트/영상/커버/랜딩/게재일.
// 실제 actor 출력 필드명은 실수집 검증 단계(Task 4)에서 대조·보정한다(방어적 파싱).
export const tiktokAdsAdapter: PlatformAdapter = {
  platform: "tiktok_ads",
  defaultActor: "ivanvs~tiktok-ad-library-scraper",

  buildInput(account: AccountInput, opts) {
    const extra = (account.apifyInput ?? {}) as Record<string, unknown>;
    const region = (extra.region as string) ?? (extra.country as string) ?? TARGET_COUNTRY;
    return {
      // 광고주/브랜드명 검색. actor 마다 키가 다를 수 있어 흔한 후보를 함께 채운다.
      searchTerms: [account.handle],
      query: account.handle,
      region,
      countryCode: region,
      maxItems: opts.maxItems,
      count: opts.maxItems,
      ...extra,
    };
  },

  normalize(rawItems: unknown[]): NormalizedResult {
    const result = emptyResult();
    for (const item of rawItems) {
      const platformAdId = str(pick(item, "id", "ad_id", "adId", "adArchiveID"));
      if (!platformAdId) continue;

      const adCopy =
        str(pick(item, "ad_text", "adText", "caption", "text", "description")) ?? null;

      const linkUrl = str(pick(item, "landing_page_url", "landingPageUrl", "link", "url"));

      const mediaUrls: string[] = [];
      const cover = str(pick(item, "cover_image_url", "coverImageUrl", "cover", "image_url", "imageUrl"));
      if (cover) mediaUrls.push(cover);
      const video = str(pick(item, "video_url", "videoUrl"));
      if (video) mediaUrls.push(video);

      const format = video ? "video" : "image";

      const isActiveRaw = pick(item, "is_active", "isActive", "active");
      const seenActive = isActiveRaw === undefined ? true : Boolean(isActiveRaw);

      const startDate = isoDate(pick(item, "first_shown_date", "firstShownDate", "start_date", "startDate"));
      const endDate = isoDate(pick(item, "last_shown_date", "lastShownDate", "end_date", "endDate"));

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

function isoDate(v: unknown): string | null {
  return typeof v === "string" && v.length >= 10 ? v.slice(0, 10) : null;
}
