import { Link } from "react-router";
import { Card, MediaImage, PlatformChip } from "~/components/ui";
import { fmt } from "~/mock/data";
import type { FeedItem } from "~/lib/queries.server";

// 게시물/광고 카드 (통합 피드·브랜드 상세에서 공유). 클릭 시 항목 상세로 이동.
export function FeedItemCard({ item: i }: { item: FeedItem }) {
  return (
    <Link to={`/item/${i.kind}/${i.id}`} className="block">
      <Card className="overflow-hidden flex flex-col hover:border-primary/40 hover:-translate-y-0.5 transition-all h-full">
        {i.imageUrl ? (
          <div className="relative">
            <MediaImage src={i.imageUrl} seed={i.id + (i.text ?? "")} format={i.format} className="h-48 w-full sm:h-44" />
            {(i.format === "carousel" || (i.mediaCount ?? 0) > 1) && (
              <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md bg-black/50 px-2 py-1 font-label-muted text-[10px] font-medium text-white backdrop-blur-sm tabular-nums">
                <span className="material-symbols-outlined notranslate text-[12px]">view_carousel</span>
                1/{Math.max(i.mediaCount ?? 0, 2)}
              </span>
            )}
          </div>
        ) : (
          <div className="relative flex h-48 w-full items-center bg-surface-container-low p-5 sm:h-44">
            <span className="material-symbols-outlined notranslate absolute left-3 top-2 text-[32px] text-outline-variant">format_quote</span>
            <p className="relative z-10 line-clamp-4 font-body-md text-body-md italic text-on-surface whitespace-pre-line">{i.text || "내용 없음"}</p>
          </div>
        )}
        <div className="p-4 flex flex-col gap-2 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <PlatformChip platform={i.platform} withIcon />
              <span className="truncate font-label-muted text-label-muted text-on-surface-variant">{i.brand}</span>
            </div>
            <span
              className={`px-1.5 py-0.5 rounded font-label-muted text-[10px] font-bold ${
                i.kind === "ad" ? "bg-primary-container/15 text-primary" : "bg-surface-variant text-on-surface-variant"
              }`}
            >
              {i.kind === "ad" ? "광고" : "게시물"}
            </span>
          </div>
          {i.imageUrl ? (
            <p className="font-body-sm text-body-sm line-clamp-2 flex-1 whitespace-pre-line">{i.text}</p>
          ) : (
            <div className="flex-1" />
          )}
          <div className="mt-1 flex items-center justify-between gap-3 border-t border-outline-variant pt-2">
            <span className="font-label-muted text-label-muted text-on-surface-variant">{i.date}</span>
            {i.kind === "ad" ? (
              <span className="flex items-center gap-1 font-label-muted text-label-muted text-primary">
                <span className="material-symbols-outlined notranslate text-[14px]">schedule</span>
                {i.daysActive}일째
              </span>
            ) : (
              <div className="flex items-center gap-3 font-label-muted text-label-muted text-on-surface-variant tabular-nums">
                <span className="flex items-center gap-0.5"><span className="material-symbols-outlined notranslate text-[14px]">favorite</span>{fmt(i.likes ?? 0)}</span>
                <span className="flex items-center gap-0.5"><span className="material-symbols-outlined notranslate text-[14px]">chat_bubble</span>{fmt(i.comments ?? 0)}</span>
                {!!i.views && <span className="flex items-center gap-0.5"><span className="material-symbols-outlined notranslate text-[14px]">play_arrow</span>{fmt(i.views)}</span>}
              </div>
            )}
          </div>
        </div>
      </Card>
    </Link>
  );
}

export function FeedGrid({ items }: { items: FeedItem[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-card-gap">
      {items.map((i) => (
        <FeedItemCard key={`${i.kind}-${i.id}`} item={i} />
      ))}
    </div>
  );
}
