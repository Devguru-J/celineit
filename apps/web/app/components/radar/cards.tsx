import { fmt2 } from "~/lib/radar/format";
import { imgProxy, type Reel, type TikTokPost, type Video, type XPost, type ThreadPost } from "~/lib/radar/types";

function RankBadge({ rank, round = false }: { rank: number; round?: boolean }) {
  const top = rank <= 3;
  return (
    <div
      className={`absolute left-2 top-2 z-10 px-2 py-0.5 text-[10px] font-bold shadow-lg ${round ? "rounded-full" : "rounded"} ${
        top ? "bg-primary text-on-primary" : "bg-surface-container-highest/90 text-on-surface"
      }`}
    >
      {rank}위
    </div>
  );
}

// ── 유튜브/쇼츠 그리드 (16:9 또는 9:16) ─────────────────
export function VideoGrid({
  videos,
  sort,
  vertical,
  onOpen,
}: {
  videos: Video[];
  sort: "views" | "likes";
  vertical: boolean;
  onOpen: (id: string, vertical: boolean) => void;
}) {
  const sorted = [...videos].sort((a, b) => ((b[sort] ?? 0) as number) - ((a[sort] ?? 0) as number));
  return (
    <div
      className={`grid gap-card-gap ${vertical ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"}`}
    >
      {sorted.map((v, i) => (
        <div key={v.id} className="group cursor-pointer" onClick={() => onOpen(v.id, vertical)}>
          <div
            className={`relative mb-3 overflow-hidden rounded border border-outline-variant bg-surface-container-low transition-all group-hover:border-primary ${vertical ? "aspect-[9/16]" : "aspect-video"}`}
          >
            <img
              loading="lazy"
              src={imgProxy(v.thumbnail)}
              alt=""
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <RankBadge rank={i + 1} />
            {v.length && (
              <div className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-medium text-white">
                {v.length}
              </div>
            )}
          </div>
          <h4 className="mb-1 line-clamp-2 font-body-md text-[15px] font-semibold leading-snug text-on-surface transition-colors group-hover:text-primary">
            {v.title}
          </h4>
          <p className="mb-2 text-[12px] text-on-surface-variant">{v.channel}</p>
          <div className="flex items-center gap-2 text-[11px] text-on-surface-variant/80">
            <span className={sort === "views" ? "font-semibold text-primary" : ""}>
              조회수 {fmt2(v.views)}
            </span>
            {v.likes ? (
              <>
                <span>·</span>
                <span className={`flex items-center gap-0.5 ${sort === "likes" ? "font-semibold text-primary" : ""}`}>
                  <span className="material-symbols-outlined notranslate text-[14px]">thumb_up</span>
                  {fmt2(v.likes)}
                </span>
              </>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── 릴스/틱톡 세로 그리드 (9:16) ────────────────────────
export function VerticalGrid({
  items,
  sort,
}: {
  items: (Reel | TikTokPost)[];
  sort: "views" | "likes" | "comments";
}) {
  const sorted = [...items].sort((a, b) => (b[sort] ?? 0) - (a[sort] ?? 0));
  return (
    <div className="grid grid-cols-2 gap-card-gap sm:grid-cols-3 lg:grid-cols-5">
      {sorted.map((r, i) => (
        <a
          key={`${r.account}-${i}`}
          href={r.url}
          target="_blank"
          rel="noopener noreferrer"
          className="group cursor-pointer"
        >
          <div className="relative aspect-[9/16] overflow-hidden rounded-xl border border-outline-variant transition-all group-hover:border-primary">
            <img
              loading="lazy"
              src={imgProxy(r.thumbnail)}
              alt=""
              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent" />
            <RankBadge rank={i + 1} round />
            <div className="absolute inset-x-3 bottom-3">
              <p className="mb-1 line-clamp-1 text-[12px] font-bold text-white">{r.title}</p>
              <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] font-medium text-white/85">
                <span className={sort === "views" ? "text-primary" : ""}>👁️ {fmt2(r.views)}</span>
                <span className={sort === "likes" ? "text-primary" : ""}>❤️ {fmt2(r.likes)}</span>
                <span className={sort === "comments" ? "text-primary" : ""}>💬 {fmt2(r.comments)}</span>
              </div>
            </div>
          </div>
          <p className="mt-2 text-center text-[11px] text-on-surface-variant">@{r.account}</p>
        </a>
      ))}
    </div>
  );
}

// ── X/스레드 포스트 리스트 ──────────────────────────────
type SocialPost = (XPost | ThreadPost) & { retweets?: number; reposts?: number };

export function PostList({
  posts,
  kind,
  sortField,
}: {
  posts: SocialPost[];
  kind: "x" | "threads";
  sortField: "likes" | "replies" | "retweets" | "reposts" | "views";
}) {
  const sorted = [...posts].sort(
    (a, b) => ((b as any)[sortField] ?? 0) - ((a as any)[sortField] ?? 0),
  );
  const active = sortField;
  return (
    <div className="grid grid-cols-1 gap-card-gap md:grid-cols-2 xl:grid-cols-3">
      {sorted.map((p, i) => {
        const rt = kind === "threads" ? p.reposts ?? 0 : p.retweets ?? 0;
        return (
          <a
            key={`${p.account}-${i}`}
            href={p.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex cursor-pointer flex-col rounded border border-outline-variant bg-surface-container p-4 transition-colors hover:border-primary"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-medium text-on-surface-variant">@{p.account}</span>
              <span
                className={`rounded px-2 py-0.5 text-[10px] font-bold ${i < 3 ? "bg-primary/20 text-primary" : "bg-surface-variant text-on-surface-variant"}`}
              >
                {i + 1}위
              </span>
            </div>
            <p className="mb-4 line-clamp-3 flex-1 font-body-md text-body-md leading-normal text-on-surface">
              {p.text}
            </p>
            {p.media && (
              <img
                loading="lazy"
                src={imgProxy(p.media)}
                alt=""
                className="mb-3 max-h-48 w-full rounded object-cover"
              />
            )}
            <div className="flex items-center gap-4 text-[11px] text-on-surface-variant">
              <span className={active === "likes" ? "font-semibold text-primary" : ""}>❤️ {fmt2(p.likes)}</span>
              <span className={active === "replies" ? "font-semibold text-primary" : ""}>💬 {fmt2(p.replies)}</span>
              <span
                className={active === "reposts" || active === "retweets" ? "font-semibold text-primary" : ""}
              >
                🔁 {fmt2(rt)}
              </span>
              {p.views ? (
                <span className={active === "views" ? "font-semibold text-primary" : ""}>👁️ {fmt2(p.views)}</span>
              ) : null}
            </div>
          </a>
        );
      })}
    </div>
  );
}
