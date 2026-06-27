// Mock dataset for the Celine Intelligence mockup.
// Shapes mirror the planned Drizzle schema (brands / accounts / ads / posts / metrics / runs)
// so the UI can later be wired to real loaders with minimal change.

export type Platform = "meta_ads" | "instagram" | "twitter" | "tiktok";

export const PLATFORM_META: Record<
  Platform,
  { label: string; short: string; icon: string; dot: string }
> = {
  meta_ads: { label: "Meta Ads", short: "Meta", icon: "ad_units", dot: "bg-[#1877F2]" },
  instagram: { label: "Instagram", short: "IG", icon: "photo_camera", dot: "bg-[#E1306C]" },
  twitter: { label: "Twitter / X", short: "X", icon: "tag", dot: "bg-[#111111]" },
  tiktok: { label: "TikTok", short: "TikTok", icon: "music_note", dot: "bg-[#00BFA5]" },
};

export const brands = [
  { id: "b1", name: "Celine Paris", slug: "celine-paris", swatch: "from-neutral-800 to-neutral-600" },
  { id: "b2", name: "Saint Laurent", slug: "saint-laurent", swatch: "from-stone-900 to-stone-700" },
  { id: "b3", name: "Jacquemus", slug: "jacquemus", swatch: "from-amber-700 to-amber-500" },
  { id: "b4", name: "Bottega Veneta", slug: "bottega-veneta", swatch: "from-green-800 to-green-600" },
  { id: "b5", name: "Loewe", slug: "loewe", swatch: "from-rose-800 to-rose-600" },
];

export const summaryKpis = [
  { label: "Brands Tracked", value: "12", icon: "analytics", delta: "+1 this week", up: true },
  { label: "Active Ads Today", value: "1,240", icon: "ad_units", delta: "↑ 4.2%", up: true },
  { label: "New Posts this Week", value: "342", icon: "post_add", delta: "↓ 1.2%", up: false },
  { label: "Accounts Collected Today", value: "85", icon: "person_search", delta: "↑ 12.0%", up: true },
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
    title: "New Ad detected for Jacquemus",
    platform: "meta_ads",
    when: "2 hours ago",
    copy: "Discover the new modular workspace collection…",
  },
  { kind: "ad_inactive", title: "Ad went inactive for Saint Laurent", platform: "tiktok", when: "5 hours ago" },
  {
    kind: "follower_spike",
    title: "Follower spike for Loewe",
    platform: "instagram",
    when: "Yesterday",
    note: "+2,400 followers in 24h. Correlates with 'Summer Drop' campaign launch.",
  },
  {
    kind: "new_ad",
    title: "New Ad detected for Bottega Veneta",
    platform: "meta_ads",
    when: "Yesterday",
    copy: "The Intreccio, reimagined for autumn.",
  },
];

export const followerBreakdown = [
  { platform: "Instagram", value: "1.2M", dot: "bg-primary" },
  { platform: "TikTok", value: "850K", dot: "bg-secondary" },
  { platform: "Facebook", value: "420K", dot: "bg-outline" },
];

export const brandHealth = [
  { brand: "Celine Paris", sentiment: "Positive", sentimentPct: 85, spend: "112.4", bar: "bg-emerald-500" },
  { brand: "Saint Laurent", sentiment: "Neutral", sentimentPct: 60, spend: "98.1", bar: "bg-primary" },
  { brand: "Jacquemus", sentiment: "Positive", sentimentPct: 78, spend: "104.7", bar: "bg-emerald-500" },
  { brand: "Bottega Veneta", sentiment: "Neutral", sentimentPct: 55, spend: "91.2", bar: "bg-primary" },
];

// ---- Ads (with longevity) ----
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
  { id: "a1", brand: "Celine Paris", platform: "meta_ads", copy: "Triomphe canvas — timeless since 1973.", format: "image", daysActive: 142, firstSeen: "2026-02-05", lastSeen: "2026-06-27", isActive: true, landingDomain: "celine.com" },
  { id: "a2", brand: "Jacquemus", platform: "meta_ads", copy: "Le Bambino. Small bag, big summer.", format: "video", daysActive: 96, firstSeen: "2026-03-23", lastSeen: "2026-06-27", isActive: true, landingDomain: "jacquemus.com" },
  { id: "a3", brand: "Loewe", platform: "tiktok", copy: "Puzzle bag — crafted in Spain.", format: "video", daysActive: 71, firstSeen: "2026-04-17", lastSeen: "2026-06-27", isActive: true, landingDomain: "loewe.com" },
  { id: "a4", brand: "Saint Laurent", platform: "meta_ads", copy: "The new Icare maxi shopping bag.", format: "carousel", daysActive: 58, firstSeen: "2026-04-30", lastSeen: "2026-06-27", isActive: true, landingDomain: "ysl.com" },
  { id: "a5", brand: "Bottega Veneta", platform: "instagram", copy: "Andiamo. The Intreccio handle.", format: "image", daysActive: 44, firstSeen: "2026-05-14", lastSeen: "2026-06-27", isActive: true, landingDomain: "bottegaveneta.com" },
  { id: "a6", brand: "Celine Paris", platform: "tiktok", copy: "Behind the scenes — SS26 campaign.", format: "video", daysActive: 31, firstSeen: "2026-05-20", lastSeen: "2026-06-20", isActive: false, landingDomain: "celine.com" },
  { id: "a7", brand: "Jacquemus", platform: "instagram", copy: "La Montagne. The mountains call.", format: "image", daysActive: 22, firstSeen: "2026-06-05", lastSeen: "2026-06-27", isActive: true, landingDomain: "jacquemus.com" },
  { id: "a8", brand: "Loewe", platform: "meta_ads", copy: "Flamenco clutch — knotted leather.", format: "image", daysActive: 12, firstSeen: "2026-06-15", lastSeen: "2026-06-27", isActive: true, landingDomain: "loewe.com" },
];

// ---- Posts (organic) ----
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
  { id: "p1", brand: "Celine Paris", platform: "instagram", caption: "SS26 in Paris.", format: "carousel", postedAt: "2026-06-27", likes: 84200, comments: 1240, views: 0 },
  { id: "p2", brand: "Jacquemus", platform: "tiktok", caption: "POV: le Bambino goes to the beach", format: "video", postedAt: "2026-06-26", likes: 312000, comments: 4800, views: 2400000 },
  { id: "p3", brand: "Loewe", platform: "instagram", caption: "Craft is everything.", format: "image", postedAt: "2026-06-26", likes: 56300, comments: 720, views: 0 },
  { id: "p4", brand: "Saint Laurent", platform: "twitter", caption: "SAINT LAURENT SUMMER 26", format: "image", postedAt: "2026-06-25", likes: 12400, comments: 310, views: 540000 },
  { id: "p5", brand: "Bottega Veneta", platform: "instagram", caption: "Andiamo.", format: "video", postedAt: "2026-06-25", likes: 98700, comments: 1530, views: 1200000 },
  { id: "p6", brand: "Jacquemus", platform: "instagram", caption: "La Montagne 🏔", format: "image", postedAt: "2026-06-24", likes: 142000, comments: 2100, views: 0 },
  { id: "p7", brand: "Celine Paris", platform: "tiktok", caption: "Behind the campaign", format: "video", postedAt: "2026-06-23", likes: 76000, comments: 980, views: 890000 },
  { id: "p8", brand: "Loewe", platform: "twitter", caption: "Puzzle, every angle.", format: "carousel", postedAt: "2026-06-23", likes: 8900, comments: 140, views: 320000 },
];

// ---- Time series (followers + engagement) for Trends ----
export const trendAccount = {
  brand: "Jacquemus",
  platform: "instagram" as Platform,
  handle: "@jacquemus",
  followers: 1840000,
  followersDelta: "+3.2%",
  engagementRate: 4.7,
  engagementDelta: "+0.4pp",
};

// 30 daily points
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

// ---- Posting calendar ----
// 35-cell month grid: 0 = no posts, intensity grows with volume.
export const calendarMonth = "June 2026";
export const calendarCells: { day: number | null; volume: number; platforms: Platform[] }[] = (() => {
  // June 2026 starts on a Monday; pad 0 leading blanks (week starts Sun -> 1 blank)
  const counts = [0, 1, 0, 3, 2, 0, 1, 4, 2, 1, 0, 0, 3, 5, 2, 1, 0, 2, 3, 1, 0, 4, 6, 2, 1, 0, 1, 3, 2, 5];
  const cells: { day: number | null; volume: number; platforms: Platform[] }[] = [];
  cells.push({ day: null, volume: 0, platforms: [] }); // 1 leading blank
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
  { label: "Image", pct: 42, color: "bg-primary" },
  { label: "Video", pct: 38, color: "bg-secondary" },
  { label: "Carousel", pct: 20, color: "bg-tertiary-fixed-dim" },
];

// ---- Collection runs (admin) ----
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
  { id: "r1", brand: "Celine Paris", platform: "meta_ads", lastRun: "03:02", status: "done", items: 184, duration: "4m 12s" },
  { id: "r2", brand: "Celine Paris", platform: "instagram", lastRun: "03:06", status: "done", items: 52, duration: "2m 41s" },
  { id: "r3", brand: "Jacquemus", platform: "tiktok", lastRun: "03:09", status: "running", items: 0, duration: "—" },
  { id: "r4", brand: "Saint Laurent", platform: "twitter", lastRun: "03:01", status: "error", items: 0, duration: "0m 38s" },
  { id: "r5", brand: "Loewe", platform: "meta_ads", lastRun: "03:04", status: "done", items: 97, duration: "3m 02s" },
  { id: "r6", brand: "Bottega Veneta", platform: "instagram", lastRun: "03:07", status: "done", items: 41, duration: "2m 18s" },
  { id: "r7", brand: "Jacquemus", platform: "instagram", lastRun: "03:08", status: "done", items: 63, duration: "2m 55s" },
  { id: "r8", brand: "Loewe", platform: "tiktok", lastRun: "03:05", status: "error", items: 0, duration: "1m 12s" },
];

export const runSummary = [
  { label: "Runs Today", value: "80", icon: "sync", tone: "primary" },
  { label: "Success Rate", value: "92.5%", icon: "check_circle", tone: "emerald" },
  { label: "Failures Needing Attention", value: "6", icon: "error", tone: "error" },
];

export function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return String(n);
}
