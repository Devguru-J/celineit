// 공용 상수/타입 — web · db · collector 가 함께 사용.

export const PLATFORMS = ["meta_ads", "instagram", "twitter", "tiktok", "tiktok_ads"] as const;
export type Platform = (typeof PLATFORMS)[number];

// 실수집 대상 매체 — 여기가 "원하는 매체" 단일 설정 지점.
// tiktok_ads 는 제외: TikTok Ad Library 는 EEA 한정이라 일본 광고가 없음(2026-07-04 실측).
//   → 일본 TikTok 경쟁정보는 오가닉 tiktok(게시글)로 수집. tiktok_ads 키/어댑터는 EEA 확장 대비 dormant.
//   근거: docs/superpowers/specs/2026-07-04-x-ads-feasibility.md
export const ACTIVE_PLATFORMS: Platform[] = ["meta_ads", "instagram", "twitter", "tiktok"];

// 수집 대상 국가 — "원하는 국가" 단일 설정 지점. Meta Ad Library country 파라미터 등에 사용.
// 전체 지역을 원하면 "ALL" 로 변경.
export const TARGET_COUNTRY = "JP";

// 일본 시장 대상 — 수집 "기준일"과 웹의 "하루" 경계는 모두 JST(UTC+9, DST 없음).
// Workers/Node 런타임은 UTC 라 toISOString().slice(0,10) 을 그대로 쓰면 00:00~08:59 JST 에
// 어제 날짜로 스냅샷이 기록/덮어써진다.
export const JST_OFFSET_MS = 9 * 3_600_000;
export function jstDate(d: Date = new Date()): string {
  return new Date(d.getTime() + JST_OFFSET_MS).toISOString().slice(0, 10);
}

// Meta Ads 는 run 당 비용이 압도적으로 높아(전체 비용의 ~70%) 별도의 낮은 기본 상한을 둔다.
// 워커(META_ADS_MAX_ITEMS)와 로컬 러너가 같은 기본값을 공유한다.
export const META_ADS_DEFAULT_MAX_ITEMS = 15;

export type AdFormat = "image" | "video" | "carousel";

// Apify actor 기본값 — 환경변수(APIFY_ACTOR_<PLATFORM>)로 override 가능.
// 실제 actor ID/slug는 계정 연결 시점에 확정·검증한다.
export const DEFAULT_APIFY_ACTORS: Record<Platform, string | null> = {
  meta_ads: "apify~facebook-ads-scraper",
  instagram: "apify~instagram-scraper",
  twitter: "apidojo~tweet-scraper",
  tiktok: "clockworks~tiktok-scraper",
  tiktok_ads: "ivanvs~tiktok-ad-library-scraper",
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
