import {
  type NormalizedAd,
  type NormalizedResult,
  TARGET_COUNTRY,
  emptyResult,
  landingDomainOf,
} from "@celine/shared";
import { pick, str, type AccountInput, type PlatformAdapter } from "./types";

// TikTok Ad Library 스크래퍼.
// ⚠️ DORMANT (ACTIVE_PLATFORMS 에서 제외됨). TikTok Ad Library 는 EEA 한정이라 일본 광고가 없음(2026-07-04 실측).
//    일본 TikTok 은 오가닉 tiktok 어댑터로 수집한다. 이 어댑터는 EEA 확장 시에만 사용.
// ⚠️ 아래 buildInput/normalize 는 합성 fixture 기준이며 실제 actor(ivanvs~tiktok-ad-library-scraper) 출력과
//    미대조 상태. 실제 입력은 {maxRecords, urls:[{url:"https://library.tiktok.com/ads?region=..&adv_name=.."}]},
//    출력은 {id, firstShownDate/lastShownDate, videos[].videoUrl, imageUrls[], advertiser{...}} 형태.
//    EEA 착수 시 이 매핑부터 보정할 것. 근거: docs/superpowers/specs/2026-07-04-x-ads-feasibility.md
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
