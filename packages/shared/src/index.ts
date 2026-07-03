// 공용 상수/타입 — web · db · collector 가 함께 사용.

export const PLATFORMS = ["meta_ads", "instagram", "twitter", "tiktok"] as const;
export type Platform = (typeof PLATFORMS)[number];

// 실수집 대상 매체 — 여기가 "원하는 매체" 단일 설정 지점.
export const ACTIVE_PLATFORMS: Platform[] = ["meta_ads", "instagram", "twitter", "tiktok"];

// 수집 대상 국가 — "원하는 국가" 단일 설정 지점. Meta Ad Library country 파라미터 등에 사용.
// 전체 지역을 원하면 "ALL" 로 변경.
export const TARGET_COUNTRY = "JP";

export type AdFormat = "image" | "video" | "carousel";

// Apify actor 기본값 — 환경변수(APIFY_ACTOR_<PLATFORM>)로 override 가능.
// 실제 actor ID/slug는 계정 연결 시점에 확정·검증한다.
export const DEFAULT_APIFY_ACTORS: Record<Platform, string | null> = {
  meta_ads: "apify~facebook-ads-scraper",
  instagram: "apify~instagram-scraper",
  twitter: "apidojo~tweet-scraper",
  tiktok: "clockworks~tiktok-scraper",
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
  // 플랫폼이 제공하는 실제 광고 시작/종료일 (Meta Ad Library). 있으면 longevity 계산에 사용.
  startDate?: string | null;
  endDate?: string | null;
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

// 댓글에서 주시할 집중 키워드 — 단일 설정 지점. 부분일치(substring)로 카운트.
export const FOCUS_KEYWORDS: string[] = [
  "韓国コスメ",
  "スキンケア",
  "うるおい",
  "水分ケア",
  "毛穴",
  "化粧水",
  "化粧ノリ",
];

// 어댑터가 Apify 댓글 raw 를 정규화한 결과.
export interface NormalizedComment {
  platformCommentId: string;
  text: string | null;
  likeCount?: number;
  authorHandle?: string | null;
  postedAt?: string | null; // ISO
  raw: unknown;
}
