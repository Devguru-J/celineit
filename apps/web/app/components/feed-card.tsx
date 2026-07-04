import { Link } from "react-router";
import { MediaImage } from "~/components/ui";
import { PLATFORM_META, fmt } from "~/mock/data";
import type { FeedItem } from "~/lib/queries.server";

// 이미지 위 좌상단 오버레이 배지 (플랫폼 + 광고/게시물) — Stitch 디자인.
function OverlayBadges({ item: i }: { item: FeedItem }) {
  const m = PLATFORM_META[i.platform];
  return (
    <div className="absolute left-3 top-3 z-10 flex gap-2">
      <span className="flex items-center gap-1 rounded-full bg-[#F4F4F4]/90 px-2 py-0.5 font-label-muted text-[10px] font-bold text-black backdrop-blur-sm">
        <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
        {m.short}
      </span>
      <span
        className={`rounded-full px-2 py-0.5 font-label-muted text-[10px] font-bold text-white backdrop-blur-sm ${
          i.kind === "ad" ? "bg-primary/90" : "bg-secondary/90"
        }`}
      >
        {i.kind === "ad" ? "광고" : "게시물"}
      </span>
    </div>
  );
}

// 포맷별 이미지 비율 (masonry 높이 다양화).
function aspectClass(format: FeedItem["format"]): string {
  if (format === "video") return "aspect-video bg-black";
  if (format === "carousel") return "aspect-square";
  return "aspect-[4/5]";
}

// 게시물/광고 카드 (통합 피드·브랜드 상세 공유). masonry 아이템.
export function FeedItemCard({ item: i }: { item: FeedItem }) {
  const isVideo = i.format === "video";
  const showCarousel = i.format === "carousel" || (i.mediaCount ?? 0) > 1;

  return (
    <Link to={`/item/${i.kind}/${i.id}`} className="mb-card-gap block break-inside-avoid">
      <article className="overflow-hidden rounded-lg border border-outline-variant bg-surface shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
        {i.imageUrl ? (
          <div className="relative">
            <MediaImage src={i.imageUrl} seed={i.id + (i.text ?? "")} format={null} className={`w-full ${aspectClass(i.format)}`} />
            <OverlayBadges item={i} />
            {isVideo && (
              <span className="material-symbols-outlined notranslate pointer-events-none absolute inset-0 m-auto h-fit w-fit text-[48px] text-white drop-shadow-md">
                play_circle
              </span>
            )}
            {showCarousel && (
              <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md bg-black/50 px-2 py-1 font-label-muted text-[10px] font-medium text-white backdrop-blur-sm tabular-nums">
                <span className="material-symbols-outlined notranslate text-[12px]">view_carousel</span>
                1/{Math.max(i.mediaCount ?? 0, 2)}
              </span>
            )}
          </div>
        ) : (
          <div className="relative bg-surface-container-low px-5 pb-5 pt-11">
            <OverlayBadges item={i} />
            <span className="material-symbols-outlined notranslate text-[28px] leading-none text-outline-variant">format_quote</span>
            <p className="mt-1 line-clamp-6 whitespace-pre-line font-body-md text-body-md italic text-on-surface">{i.text || "내용 없음"}</p>
          </div>
        )}

        <div className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h4 className="truncate font-headline-sm text-[14px] font-bold">{i.brand}</h4>
              <p className="font-label-muted text-label-muted text-on-surface-variant">{i.date}</p>
            </div>
            <span className="material-symbols-outlined notranslate shrink-0 text-[20px] text-outline">more_horiz</span>
          </div>

          {i.imageUrl && <p className="line-clamp-2 whitespace-pre-line font-body-sm text-body-sm text-on-surface">{i.text}</p>}

          <div className="flex items-center justify-between border-t border-outline-variant pt-3 text-outline">
            {i.kind === "ad" ? (
              <span className="flex items-center gap-1 font-label-muted text-[12px] text-primary">
                <span className="material-symbols-outlined notranslate text-[16px]">schedule</span>
                {i.daysActive}일째 집행
              </span>
            ) : (
              <>
                <div className="flex gap-4 tabular-nums">
                  <span className="flex items-center gap-1 text-[12px]">
                    <span className="material-symbols-outlined notranslate text-[16px]">favorite</span>
                    {fmt(i.likes ?? 0)}
                  </span>
                  <span className="flex items-center gap-1 text-[12px]">
                    <span className="material-symbols-outlined notranslate text-[16px]">chat_bubble</span>
                    {fmt(i.comments ?? 0)}
                  </span>
                </div>
                {!!i.views && (
                  <span className="flex items-center gap-1 text-[12px] tabular-nums">
                    <span className="material-symbols-outlined notranslate text-[16px]">visibility</span>
                    {fmt(i.views)}
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      </article>
    </Link>
  );
}

// Masonry 그리드 (CSS columns) — Stitch 디자인의 가변 높이 레이아웃.
export function FeedGrid({ items }: { items: FeedItem[] }) {
  return (
    <div className="columns-1 gap-card-gap sm:columns-2 lg:columns-3 xl:columns-4">
      {items.map((i) => (
        <FeedItemCard key={`${i.kind}-${i.id}`} item={i} />
      ))}
    </div>
  );
}
