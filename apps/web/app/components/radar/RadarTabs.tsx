import type { RadarTab } from "~/lib/radar/types";

// 페이지 상단 플랫폼 탭바 (좌측 사이드바 대신 페이지 내 상단 메뉴).
export const RADAR_TABS: { key: RadarTab; icon: string; label: string }[] = [
  { key: "youtube", icon: "video_library", label: "유튜브" },
  { key: "shorts", icon: "play_circle", label: "쇼츠" },
  { key: "ai", icon: "smart_toy", label: "AI 영상" },
  { key: "reels", icon: "movie_filter", label: "릴스" },
  { key: "x", icon: "message", label: "트위터" },
  { key: "threads", icon: "alternate_email", label: "스레드" },
  { key: "tiktok", icon: "music_video", label: "틱톡" },
];

export function RadarTabs({
  active,
  onChange,
}: {
  active: RadarTab;
  onChange: (t: RadarTab) => void;
}) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-outline-variant px-4 sm:px-container-padding">
      {RADAR_TABS.map((t) => {
        const on = t.key === active;
        return (
          <button
            type="button"
            key={t.key}
            onClick={() => onChange(t.key)}
            className={`flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-4 py-3 font-body-sm text-body-sm transition-colors ${
              on
                ? "border-primary font-semibold text-primary"
                : "border-transparent text-on-surface-variant hover:text-on-surface"
            }`}
          >
            <span className="material-symbols-outlined notranslate text-[20px]">{t.icon}</span>
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
