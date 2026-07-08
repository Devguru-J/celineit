// 트렌드 뷰어 상수 — 레퍼런스(reference/trend-viewer/server.py)와 값 1:1 대응.
// 클라이언트/서버 공용(순수 데이터). .server 아님.

export type RadarSource = "reels" | "x" | "threads" | "tiktok";

// 카테고리 → 유튜브 검색어 매핑
export const CATEGORIES: Record<string, string> = {
  먹방: "먹방",
  "뷰티/패션": "뷰티 메이크업 패션",
  브이로그: "브이로그",
  "예능/코미디": "예능 웃긴 영상",
  "영화/드라마": "영화 드라마 리뷰",
  "테크/IT": "테크 리뷰",
  "지식/교육": "지식 교양",
  여행: "여행",
  동물: "강아지 고양이",
};

// "전체" 탭은 아래 카테고리들을 합쳐 조회수순으로 재정렬
export const ALL_MERGE = ["먹방", "브이로그", "예능/코미디", "뷰티/패션", "영화/드라마", "여행"];

// AI 카테고리 전용 유튜브 쿼리
export const AI_YT_QUERIES = ["AI 영상 제작", "AI 영상 생성", "sora ai video", "runway kling veo"];

// UI에 노출할 카테고리 목록 (레퍼런스 /api/categories)
export const CATEGORY_LIST = ["전체", "AI", ...Object.keys(CATEGORIES)];

// 검색 필터 protobuf: 업로드 날짜 (2=오늘, 3=이번 주, 4=이번 달)
export const PERIOD_CODE: Record<string, number> = { day: 2, week: 3, month: 4 };

// 기간별 제외 문구(추천 섹션이 기간 필터를 우회하는 경우 게시일 텍스트로 걸러냄)
export const PERIOD_EXCLUDE: Record<string, string[]> = {
  day: ["일 전", "주 전", "개월 전", "년 전"],
  week: ["주 전", "개월 전", "년 전"],
  month: ["개월 전", "년 전"],
};

// 소스별 기본 구독 계정 (테이블에 행이 없을 때 시드)
export const DEFAULT_ACCOUNTS: Record<RadarSource, string[]> = {
  reels: [
    "openai",
    "runwayapp",
    "pika_labs",
    "lumalabsai",
    "midjourney",
    "klingai_official",
    "heygen_official",
    "higgsfield.ai",
    "googledeepmind",
  ],
  x: [
    "OpenAI",
    "runwayml",
    "Kling_ai",
    "GoogleDeepMind",
    "midjourney",
    "LumaLabsAI",
    "pika_labs",
    "heygen_com",
    "elevenlabsio",
    "AIatMeta",
  ],
  threads: ["openai", "runway", "google", "meta.ai", "zuck"],
  tiktok: ["openai", "runwayapp", "krea.ai", "elevenlabs", "sora", "zachking", "khaby.lame", "google"],
};

// instagram.com / threads.com 웹이 쓰는 공개 앱 ID
export const IG_APP_ID = "936619743392459";
export const IG_APP_ID_THREADS = "238260118697367";

export const TIKWM_BASE = "https://www.tikwm.com/api";
export const TIKTOK_REGION = "KR";

export const HF_PIPELINES = ["text-to-video", "image-to-video"];

export const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

export const CACHE_TTL = 3600; // 1시간
