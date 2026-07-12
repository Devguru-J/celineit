// 플랫폼 표시 메타 + 숫자 포맷 헬퍼 (전 화면 공용).
// (구 ~/mock/data 에서 실사용 심볼만 추출 — 목 데이터는 실데이터 loader 전환으로 삭제됨)

// DB(@celine/shared) platform enum 과 일치. tiktok_ads 는 dormant(수집·필터 제외)지만
// enum 값이라 타입 완전성 위해 유지. 근거: docs/superpowers/specs/2026-07-04-x-ads-feasibility.md
export type Platform = "meta_ads" | "instagram" | "twitter" | "tiktok" | "tiktok_ads";

export const PLATFORM_META: Record<
  Platform,
  { label: string; short: string; icon: string; dot: string }
> = {
  meta_ads: { label: "메타 광고", short: "Meta", icon: "ad_units", dot: "bg-[#1877F2]" },
  instagram: { label: "인스타그램", short: "IG", icon: "photo_camera", dot: "bg-[#E1306C]" },
  twitter: { label: "트위터 / X", short: "X", icon: "tag", dot: "bg-[#F4F4F4]" },
  tiktok: { label: "틱톡", short: "TikTok", icon: "music_note", dot: "bg-[#00BFA5]" },
  tiktok_ads: { label: "틱톡 광고", short: "TikTok Ads", icon: "ad_units", dot: "bg-[#000000]" }, // dormant(EEA 전용)
};

export function fmt(n: number): string {
  if (n >= 10_000) return (n / 10_000).toFixed(1).replace(/\.0$/, "") + "만";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "천";
  return String(n);
}
