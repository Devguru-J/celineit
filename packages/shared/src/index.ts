// 공용 상수/타입 — web · db · collector 가 함께 사용.

export const PLATFORMS = ["meta_ads", "instagram", "twitter", "tiktok", "bereal"] as const;
export type Platform = (typeof PLATFORMS)[number];

// 1차 실수집 대상 (BeReal 제외 — 어댑터 자리만 둠)
export const ACTIVE_PLATFORMS: Platform[] = ["meta_ads", "instagram", "twitter", "tiktok"];

export type AdFormat = "image" | "video" | "carousel";

// Apify actor 기본값 — 환경변수(APIFY_ACTOR_<PLATFORM>)로 override 가능.
// 실제 actor ID/slug는 계정 연결 시점에 확정·검증한다.
export const DEFAULT_APIFY_ACTORS: Record<Platform, string | null> = {
  meta_ads: "curious_coder~facebook-ads-library-scraper",
  instagram: "apify~instagram-scraper",
  twitter: "apidojo~tweet-scraper",
  tiktok: "clockworks~tiktok-scraper",
  bereal: null, // 데이터 소스 없음
};

// 어댑터가 Apify raw item 을 정규화한 결과 — DB 적재 직전의 중립 형태.
export interface NormalizedAd {
  platformAdId: string;
  adCopy: string | null;
  format: AdFormat | null;
  destinationUrl: string | null;
  landingDomain: string | null;
  mediaUrls: string[];
  // 이 수집 시점에 광고가 활성으로 관측되었는지
  seenActive: boolean;
  raw: unknown;
}

export interface NormalizedPost {
  platformPostId: string;
  caption: string | null;
  format: AdFormat | null;
  permalink: string | null;
  postedAt: string | null; // ISO date
  mediaUrls: string[];
  metrics: {
    likes?: number;
    comments?: number;
    views?: number;
    shares?: number;
    saves?: number;
  };
  raw: unknown;
}

// 계정 단위 지표(팔로워 등) — 수집 1회당 최대 1개.
export interface NormalizedAccountMetric {
  followers?: number;
  following?: number;
  postsCount?: number;
  engagementRate30d?: number;
}

export interface NormalizedResult {
  ads: NormalizedAd[];
  posts: NormalizedPost[];
  accountMetric: NormalizedAccountMetric | null;
}

export function emptyResult(): NormalizedResult {
  return { ads: [], posts: [], accountMetric: null };
}

// URL 에서 등록 도메인 추출 (랜딩페이지 집계용)
export function landingDomainOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}
