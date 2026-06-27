// Celine Intelligence 목업용 목 데이터.
// 구조는 계획된 Drizzle 스키마(brands / accounts / ads / posts / metrics / runs)를 따르므로
// 추후 실제 loader 연결 시 최소 변경으로 교체 가능.

export type Platform = "meta_ads" | "instagram" | "twitter" | "tiktok" | "bereal";

export const PLATFORM_META: Record<
  Platform,
  { label: string; short: string; icon: string; dot: string }
> = {
  meta_ads: { label: "메타 광고", short: "Meta", icon: "ad_units", dot: "bg-[#1877F2]" },
  instagram: { label: "인스타그램", short: "IG", icon: "photo_camera", dot: "bg-[#E1306C]" },
  twitter: { label: "트위터 / X", short: "X", icon: "tag", dot: "bg-[#111111]" },
  tiktok: { label: "틱톡", short: "TikTok", icon: "music_note", dot: "bg-[#00BFA5]" },
  bereal: { label: "BeReal", short: "BeReal", icon: "photo", dot: "bg-[#000000]" },
};

export const brands = [
  { id: "b1", name: "Celine Paris", slug: "celine-paris", swatch: "from-neutral-800 to-neutral-600" },
  { id: "b2", name: "Saint Laurent", slug: "saint-laurent", swatch: "from-stone-900 to-stone-700" },
  { id: "b3", name: "Jacquemus", slug: "jacquemus", swatch: "from-amber-700 to-amber-500" },
  { id: "b4", name: "Bottega Veneta", slug: "bottega-veneta", swatch: "from-green-800 to-green-600" },
  { id: "b5", name: "Loewe", slug: "loewe", swatch: "from-rose-800 to-rose-600" },
];

export const summaryKpis = [
  { label: "추적 중인 브랜드", value: "12", icon: "analytics", delta: "이번 주 +1", up: true },
  { label: "오늘 활성 광고", value: "1,240", icon: "ad_units", delta: "↑ 4.2%", up: true },
  { label: "이번 주 신규 게시물", value: "342", icon: "post_add", delta: "↓ 1.2%", up: false },
  { label: "오늘 수집한 계정", value: "85", icon: "person_search", delta: "↑ 12.0%", up: true },
];

export type TimelineKind = "new_ad" | "ad_inactive" | "follower_spike";
export const recentChanges: {
  kind: TimelineKind;
  title: string;
  platform: Platform;
  when: string;
  note?: string;
  copy?: string;
}[] = [
  {
    kind: "new_ad",
    title: "Jacquemus 신규 광고 감지",
    platform: "meta_ads",
    when: "2시간 전",
    copy: "새로운 모듈형 워크스페이스 컬렉션을 만나보세요…",
  },
  { kind: "ad_inactive", title: "Saint Laurent 광고 비활성화", platform: "tiktok", when: "5시간 전" },
  {
    kind: "follower_spike",
    title: "Loewe 팔로워 급증",
    platform: "instagram",
    when: "어제",
    note: "24시간 만에 팔로워 +2,400명. 'Summer Drop' 캠페인 론칭과 연관됨.",
  },
  {
    kind: "new_ad",
    title: "Bottega Veneta 신규 광고 감지",
    platform: "meta_ads",
    when: "어제",
    copy: "인트레치오, 가을을 위해 다시 태어나다.",
  },
];

export const followerBreakdown = [
  { platform: "인스타그램", value: "120만", dot: "bg-primary" },
  { platform: "틱톡", value: "85만", dot: "bg-secondary" },
  { platform: "페이스북", value: "42만", dot: "bg-outline" },
];

export const brandHealth = [
  { brand: "Celine Paris", sentiment: "긍정", sentimentPct: 85, spend: "112.4", bar: "bg-emerald-500" },
  { brand: "Saint Laurent", sentiment: "중립", sentimentPct: 60, spend: "98.1", bar: "bg-primary" },
  { brand: "Jacquemus", sentiment: "긍정", sentimentPct: 78, spend: "104.7", bar: "bg-emerald-500" },
  { brand: "Bottega Veneta", sentiment: "중립", sentimentPct: 55, spend: "91.2", bar: "bg-primary" },
];

// ---- 광고 (longevity 포함) ----
export type Ad = {
  id: string;
  brand: string;
  platform: Platform;
  copy: string;
  format: "image" | "video" | "carousel";
  daysActive: number;
  firstSeen: string;
  lastSeen: string;
  isActive: boolean;
  landingDomain: string;
};

export const ads: Ad[] = [
  { id: "a1", brand: "Celine Paris", platform: "meta_ads", copy: "트리옹프 캔버스 — 1973년부터 이어진 타임리스.", format: "image", daysActive: 142, firstSeen: "2026-02-05", lastSeen: "2026-06-27", isActive: true, landingDomain: "celine.com" },
  { id: "a2", brand: "Jacquemus", platform: "meta_ads", copy: "르 밤비노. 작은 가방, 커다란 여름.", format: "video", daysActive: 96, firstSeen: "2026-03-23", lastSeen: "2026-06-27", isActive: true, landingDomain: "jacquemus.com" },
  { id: "a3", brand: "Loewe", platform: "tiktok", copy: "퍼즐 백 — 스페인에서 장인이 만들다.", format: "video", daysActive: 71, firstSeen: "2026-04-17", lastSeen: "2026-06-27", isActive: true, landingDomain: "loewe.com" },
  { id: "a4", brand: "Saint Laurent", platform: "meta_ads", copy: "새로운 이카레 맥시 쇼핑백.", format: "carousel", daysActive: 58, firstSeen: "2026-04-30", lastSeen: "2026-06-27", isActive: true, landingDomain: "ysl.com" },
  { id: "a5", brand: "Bottega Veneta", platform: "instagram", copy: "안디아모. 인트레치오 핸들.", format: "image", daysActive: 44, firstSeen: "2026-05-14", lastSeen: "2026-06-27", isActive: true, landingDomain: "bottegaveneta.com" },
  { id: "a6", brand: "Celine Paris", platform: "tiktok", copy: "비하인드 신 — SS26 캠페인.", format: "video", daysActive: 31, firstSeen: "2026-05-20", lastSeen: "2026-06-20", isActive: false, landingDomain: "celine.com" },
  { id: "a7", brand: "Jacquemus", platform: "instagram", copy: "라 몽타뉴. 산이 부른다.", format: "image", daysActive: 22, firstSeen: "2026-06-05", lastSeen: "2026-06-27", isActive: true, landingDomain: "jacquemus.com" },
  { id: "a8", brand: "Loewe", platform: "meta_ads", copy: "플라멩코 클러치 — 매듭 가죽.", format: "image", daysActive: 12, firstSeen: "2026-06-15", lastSeen: "2026-06-27", isActive: true, landingDomain: "loewe.com" },
];

// ---- 게시물 (오가닉) ----
export type Post = {
  id: string;
  brand: string;
  platform: Platform;
  caption: string;
  format: "image" | "video" | "carousel";
  postedAt: string;
  likes: number;
  comments: number;
  views: number;
};

export const posts: Post[] = [
  { id: "p1", brand: "Celine Paris", platform: "instagram", caption: "파리의 SS26.", format: "carousel", postedAt: "2026-06-27", likes: 84200, comments: 1240, views: 0 },
  { id: "p2", brand: "Jacquemus", platform: "tiktok", caption: "POV: 르 밤비노와 떠나는 바다", format: "video", postedAt: "2026-06-26", likes: 312000, comments: 4800, views: 2400000 },
  { id: "p3", brand: "Loewe", platform: "instagram", caption: "장인정신이 전부다.", format: "image", postedAt: "2026-06-26", likes: 56300, comments: 720, views: 0 },
  { id: "p4", brand: "Saint Laurent", platform: "twitter", caption: "SAINT LAURENT SUMMER 26", format: "image", postedAt: "2026-06-25", likes: 12400, comments: 310, views: 540000 },
  { id: "p5", brand: "Bottega Veneta", platform: "instagram", caption: "안디아모.", format: "video", postedAt: "2026-06-25", likes: 98700, comments: 1530, views: 1200000 },
  { id: "p6", brand: "Jacquemus", platform: "instagram", caption: "라 몽타뉴 🏔", format: "image", postedAt: "2026-06-24", likes: 142000, comments: 2100, views: 0 },
  { id: "p7", brand: "Celine Paris", platform: "tiktok", caption: "캠페인 비하인드", format: "video", postedAt: "2026-06-23", likes: 76000, comments: 980, views: 890000 },
  { id: "p8", brand: "Loewe", platform: "twitter", caption: "퍼즐, 모든 각도에서.", format: "carousel", postedAt: "2026-06-23", likes: 8900, comments: 140, views: 320000 },
];

// ---- 시계열 (팔로워 + 인게이지먼트) · Trends용 ----
export const trendAccount = {
  brand: "Jacquemus",
  platform: "instagram" as Platform,
  handle: "@jacquemus",
  followers: 1840000,
  followersDelta: "+3.2%",
  engagementRate: 4.7,
  engagementDelta: "+0.4%p",
};

// 일별 30개 포인트
export const followerSeries = [
  1772, 1775, 1778, 1781, 1779, 1784, 1788, 1790, 1793, 1797, 1801, 1804, 1802,
  1808, 1812, 1815, 1819, 1822, 1820, 1826, 1829, 1831, 1828, 1834, 1836, 1833,
  1838, 1840, 1839, 1840,
].map((k, i) => ({ day: i + 1, value: k * 1000 }));

export const engagementSeries = [
  3.9, 4.0, 4.1, 4.0, 4.2, 4.3, 4.2, 4.1, 4.4, 4.5, 4.3, 4.6, 4.4, 4.7, 4.6,
  4.5, 4.8, 4.7, 4.6, 4.9, 4.8, 4.7, 4.6, 4.8, 4.9, 4.7, 4.8, 4.9, 4.7, 4.7,
].map((v, i) => ({ day: i + 1, value: v }));

export const topPosts = posts.filter((p) => p.brand === "Jacquemus").slice(0, 4);

// ---- 포스팅 캘린더 ----
// 월 그리드 셀: 0 = 게시물 없음, 값이 클수록 진하게.
export const calendarMonth = "2026년 6월";
export const calendarCells: { day: number | null; volume: number; platforms: Platform[] }[] = (() => {
  const counts = [0, 1, 0, 3, 2, 0, 1, 4, 2, 1, 0, 0, 3, 5, 2, 1, 0, 2, 3, 1, 0, 4, 6, 2, 1, 0, 1, 3, 2, 5];
  const cells: { day: number | null; volume: number; platforms: Platform[] }[] = [];
  cells.push({ day: null, volume: 0, platforms: [] }); // 앞쪽 빈칸 1개
  const plats: Platform[] = ["meta_ads", "instagram", "twitter", "tiktok"];
  for (let d = 1; d <= 30; d++) {
    const v = counts[d - 1];
    const platforms = v === 0 ? [] : plats.slice(0, Math.min(plats.length, Math.max(1, Math.ceil(v / 2))));
    cells.push({ day: d, volume: v, platforms });
  }
  return cells;
})();

export const cadenceStats = [
  { platform: "instagram" as Platform, perWeek: 5.2 },
  { platform: "tiktok" as Platform, perWeek: 7.8 },
  { platform: "twitter" as Platform, perWeek: 12.4 },
  { platform: "meta_ads" as Platform, perWeek: 3.1 },
];

export const formatMix = [
  { label: "이미지", pct: 42, color: "bg-primary" },
  { label: "동영상", pct: 38, color: "bg-secondary" },
  { label: "캐러셀", pct: 20, color: "bg-tertiary-fixed-dim" },
];

// ---- 수집 실행 (관리자) ----
export type RunStatus = "done" | "running" | "error";
export type Run = {
  id: string;
  brand: string;
  platform: Platform;
  lastRun: string;
  status: RunStatus;
  items: number;
  duration: string;
};

export const runs: Run[] = [
  { id: "r1", brand: "Celine Paris", platform: "meta_ads", lastRun: "03:02", status: "done", items: 184, duration: "4분 12초" },
  { id: "r2", brand: "Celine Paris", platform: "instagram", lastRun: "03:06", status: "done", items: 52, duration: "2분 41초" },
  { id: "r3", brand: "Jacquemus", platform: "tiktok", lastRun: "03:09", status: "running", items: 0, duration: "—" },
  { id: "r4", brand: "Saint Laurent", platform: "twitter", lastRun: "03:01", status: "error", items: 0, duration: "0분 38초" },
  { id: "r5", brand: "Loewe", platform: "meta_ads", lastRun: "03:04", status: "done", items: 97, duration: "3분 02초" },
  { id: "r6", brand: "Bottega Veneta", platform: "instagram", lastRun: "03:07", status: "done", items: 41, duration: "2분 18초" },
  { id: "r7", brand: "Jacquemus", platform: "instagram", lastRun: "03:08", status: "done", items: 63, duration: "2분 55초" },
  { id: "r8", brand: "Loewe", platform: "tiktok", lastRun: "03:05", status: "error", items: 0, duration: "1분 12초" },
];

export const runSummary = [
  { label: "오늘 실행", value: "80", icon: "sync", tone: "primary" },
  { label: "성공률", value: "92.5%", icon: "check_circle", tone: "emerald" },
  { label: "확인 필요한 실패", value: "6", icon: "error", tone: "error" },
];

export function fmt(n: number): string {
  if (n >= 10_000) return (n / 10_000).toFixed(1).replace(/\.0$/, "") + "만";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "천";
  return String(n);
}
