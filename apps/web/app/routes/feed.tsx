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
        <FeedGrid items={items} />
      )}
    </div>
  );
}
