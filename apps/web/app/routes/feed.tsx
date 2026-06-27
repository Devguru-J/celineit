import { useMemo, useState } from "react";
import { Link, useLoaderData } from "react-router";
import { Card, MediaImage, PlatformChip } from "~/components/ui";
import { fmt, PLATFORM_META, type Platform } from "~/mock/data";
import { getFeed } from "~/lib/queries.server";

export function meta() {
  return [{ title: "Celine Intelligence · 통합 피드" }];
}

export async function loader() {
  const items = await getFeed();
  return { items };
}

const PLATFORMS: ("all" | Platform)[] = ["all", "meta_ads", "instagram", "twitter", "tiktok"];
const KINDS: ("all" | "ad" | "post")[] = ["all", "ad", "post"];

export default function Feed() {
  const { items: all } = useLoaderData<typeof loader>();
  const [platform, setPlatform] = useState<"all" | Platform>("all");
  const [kind, setKind] = useState<"all" | "ad" | "post">("all");

  const items = useMemo(
    () => all.filter((i) => (platform === "all" || i.platform === platform) && (kind === "all" || i.kind === kind)),
    [all, platform, kind],
  );

  return (
    <div className="p-container-padding space-y-card-gap">
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
        <span className="ml-auto font-label-muted text-label-muted text-on-surface-variant pr-2">{items.length}개</span>
      </Card>

      {items.length === 0 ? (
        <Card className="p-12 text-center text-on-surface-variant">
          <span className="material-symbols-outlined text-[40px] opacity-40">inbox</span>
          <p className="mt-2 font-body-md text-body-md">아직 수집된 데이터가 없습니다. 수집기를 실행해 주세요.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-card-gap">
          {items.map((i) => (
            <Link key={i.id} to={`/item/${i.kind}/${i.id}`} className="block">
            <Card className="overflow-hidden flex flex-col hover:border-primary/40 hover:-translate-y-0.5 transition-all h-full">
              <MediaImage src={i.imageUrl} seed={i.id + (i.text ?? "")} format={i.format} className="h-44 w-full" />
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
                <p className="font-body-sm text-body-sm line-clamp-2 flex-1 whitespace-pre-line">{i.text}</p>
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
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
