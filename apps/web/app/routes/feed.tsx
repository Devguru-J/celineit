import { useMemo, useState } from "react";
import { useLoaderData } from "react-router";
import { Card } from "~/components/ui";
import { FeedGrid } from "~/components/feed-card";
import { PLATFORM_META, type Platform } from "~/mock/data";
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
    <div className="space-y-card-gap p-4 sm:p-container-padding">
      <Card className="flex items-center gap-2 overflow-x-auto p-3 sm:flex-wrap">
        <span className="material-symbols-outlined notranslate ml-1 shrink-0 text-[20px] text-on-surface-variant">filter_list</span>
        {PLATFORMS.map((p) => (
          <button
            key={p}
            onClick={() => setPlatform(p)}
            className={`shrink-0 rounded-full px-3 py-1.5 font-body-sm text-body-sm transition-colors ${
              platform === p ? "bg-primary text-on-primary" : "bg-surface-container hover:bg-surface-container-high text-on-surface-variant"
            }`}
          >
            {p === "all" ? "전체 플랫폼" : PLATFORM_META[p].label}
          </button>
        ))}
        <div className="mx-2 h-5 w-[1px] shrink-0 bg-outline-variant" />
        {KINDS.map((k) => (
          <button
            key={k}
            onClick={() => setKind(k)}
            className={`shrink-0 rounded-full px-3 py-1.5 font-body-sm text-body-sm transition-colors ${
              kind === k ? "bg-primary text-on-primary" : "bg-surface-container hover:bg-surface-container-high text-on-surface-variant"
            }`}
          >
            {k === "all" ? "전체 유형" : k === "ad" ? "광고" : "게시물"}
          </button>
        ))}
        <span className="ml-auto shrink-0 pr-2 font-label-muted text-label-muted text-on-surface-variant">{items.length}개</span>
      </Card>

      {items.length === 0 ? (
        <Card className="p-12 text-center text-on-surface-variant">
          <span className="material-symbols-outlined notranslate text-[40px] opacity-40">inbox</span>
          <p className="mt-2 font-body-md text-body-md">아직 수집된 데이터가 없습니다. 수집기를 실행해 주세요.</p>
        </Card>
      ) : (
        <FeedGrid items={items} />
      )}
    </div>
  );
}
