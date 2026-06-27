import { useMemo, useState } from "react";
import { Card, MediaPlaceholder, PlatformChip } from "~/components/ui";
import { ads, fmt, PLATFORM_META, posts, type Platform } from "~/mock/data";

export function meta() {
  return [{ title: "Celine Intelligence · 통합 피드" }];
}

type FeedItem = {
  id: string;
  kind: "ad" | "post";
  brand: string;
  platform: Platform;
  text: string;
  format: "image" | "video" | "carousel";
  date: string;
  likes?: number;
  comments?: number;
  views?: number;
  daysActive?: number;
};

const FEED: FeedItem[] = [
  ...ads.map((a) => ({
    id: a.id, kind: "ad" as const, brand: a.brand, platform: a.platform, text: a.copy,
    format: a.format, date: a.lastSeen, daysActive: a.daysActive,
  })),
  ...posts.map((p) => ({
    id: p.id, kind: "post" as const, brand: p.brand, platform: p.platform, text: p.caption,
    format: p.format, date: p.postedAt, likes: p.likes, comments: p.comments, views: p.views,
  })),
].sort((a, b) => (a.date < b.date ? 1 : -1));

const PLATFORMS: ("all" | Platform)[] = ["all", "meta_ads", "instagram", "twitter", "tiktok"];
const KINDS: ("all" | "ad" | "post")[] = ["all", "ad", "post"];

export default function Feed() {
  const [platform, setPlatform] = useState<"all" | Platform>("all");
  const [kind, setKind] = useState<"all" | "ad" | "post">("all");

  const items = useMemo(
    () => FEED.filter((i) => (platform === "all" || i.platform === platform) && (kind === "all" || i.kind === kind)),
    [platform, kind],
  );

  return (
    <div className="p-container-padding space-y-card-gap">
      {/* Filter bar */}
      <Card className="p-3 flex flex-wrap items-center gap-2">
        <span className="material-symbols-outlined text-on-surface-variant text-[20px] ml-1">filter_list</span>
        {PLATFORMS.map((p) => (
          <button
            key={p}
            onClick={() => setPlatform(p)}
            className={`px-3 py-1.5 rounded-full font-body-sm text-body-sm transition-colors ${
              platform === p ? "bg-primary text-on-primary" : "bg-surface-container hover:bg-surface-container-high text-on-surface-variant"
            }`}
          >
            {p === "all" ? "전체 플랫폼" : PLATFORM_META[p].label}
          </button>
        ))}
        <div className="h-5 w-[1px] bg-outline-variant mx-2" />
        {KINDS.map((k) => (
          <button
            key={k}
            onClick={() => setKind(k)}
            className={`px-3 py-1.5 rounded-full font-body-sm text-body-sm transition-colors ${
              kind === k ? "bg-primary text-on-primary" : "bg-surface-container hover:bg-surface-container-high text-on-surface-variant"
            }`}
          >
            {k === "all" ? "전체 유형" : k === "ad" ? "광고" : "게시물"}
          </button>
        ))}
        <span className="ml-auto font-label-muted text-label-muted text-on-surface-variant pr-2">
          {items.length}개
        </span>
      </Card>

      {/* Masonry-ish grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-card-gap">
        {items.map((i) => (
          <Card key={i.id} className="overflow-hidden flex flex-col hover:border-primary/40 hover:-translate-y-0.5 transition-all">
            <MediaPlaceholder seed={i.id + i.text} format={i.format} className="h-44 w-full" />
            <div className="p-4 flex flex-col gap-2 flex-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <PlatformChip platform={i.platform} withIcon />
                  <span className="font-label-muted text-label-muted text-on-surface-variant">{i.brand}</span>
                </div>
                <span
                  className={`px-1.5 py-0.5 rounded font-label-muted text-[10px] font-bold ${
                    i.kind === "ad" ? "bg-primary-container/15 text-primary" : "bg-surface-variant text-on-surface-variant"
                  }`}
                >
                  {i.kind === "ad" ? "광고" : "게시물"}
                </span>
              </div>
              <p className="font-body-sm text-body-sm line-clamp-2 flex-1">{i.text}</p>
              <div className="flex items-center justify-between pt-2 border-t border-outline-variant mt-1">
                <span className="font-label-muted text-label-muted text-on-surface-variant">{i.date}</span>
                {i.kind === "ad" ? (
                  <span className="flex items-center gap-1 font-label-muted text-label-muted text-primary">
                    <span className="material-symbols-outlined text-[14px]">schedule</span>
                    {i.daysActive}일째
                  </span>
                ) : (
                  <div className="flex items-center gap-3 font-label-muted text-label-muted text-on-surface-variant tabular-nums">
                    <span className="flex items-center gap-0.5"><span className="material-symbols-outlined text-[14px]">favorite</span>{fmt(i.likes ?? 0)}</span>
                    <span className="flex items-center gap-0.5"><span className="material-symbols-outlined text-[14px]">chat_bubble</span>{fmt(i.comments ?? 0)}</span>
                    {!!i.views && <span className="flex items-center gap-0.5"><span className="material-symbols-outlined text-[14px]">play_arrow</span>{fmt(i.views)}</span>}
                  </div>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
