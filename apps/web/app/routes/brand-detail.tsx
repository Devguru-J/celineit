import { useMemo, useState } from "react";
import { Link, useLoaderData } from "react-router";
import { Card, PlatformChip } from "~/components/ui";
import { FeedGrid } from "~/components/feed-card";
import { BrandLogo } from "~/lib/brand-assets";
import type { Platform } from "~/mock/data";
import { getBrandDetail } from "~/lib/queries.server";

export function meta() {
  return [{ title: "Celine Intelligence · 브랜드 상세" }];
}

export async function loader({ params }: { params: { slug: string } }) {
  const data = await getBrandDetail(params.slug);
  if (!data) throw new Response("Not Found", { status: 404 });
  return data;
}

const KINDS: ("all" | "ad" | "post")[] = ["all", "ad", "post"];

export default function BrandDetail() {
  const { brand, items, postsCount, adsCount } = useLoaderData<typeof loader>();
  const [kind, setKind] = useState<"all" | "ad" | "post">("all");

  const filtered = useMemo(() => items.filter((i) => kind === "all" || i.kind === kind), [items, kind]);
  const platforms = useMemo(
    () => [...new Set(items.map((i) => i.platform))] as Platform[],
    [items],
  );

  return (
    <div className="space-y-card-gap p-4 sm:p-container-padding">
      <Link to="/brands" className="inline-flex items-center gap-1 text-on-surface-variant hover:text-primary font-body-sm text-body-sm">
        <span className="material-symbols-outlined notranslate text-[18px]">arrow_back</span> 브랜드 목록으로
      </Link>

      {/* 헤더 */}
      <Card className="flex flex-wrap items-center justify-between gap-4 p-4 sm:p-container-padding">
        <div className="flex items-center gap-4">
          <BrandLogo slug={brand.slug} name={brand.name} className="h-14 w-14 shadow-sm" />
          <div>
            <h2 className="font-metric-md text-metric-md">{brand.name}</h2>
            <div className="flex items-center gap-1.5 mt-1.5">
              {platforms.map((p) => (
                <PlatformChip key={p} platform={p} withIcon />
              ))}
            </div>
          </div>
        </div>
        <div className="grid w-full grid-cols-2 gap-4 pr-0 sm:w-auto sm:flex sm:items-center sm:gap-8 sm:pr-2">
          <div className="text-right">
            <p className="font-metric-md text-metric-md tabular-nums">{postsCount}</p>
            <p className="font-label-muted text-label-muted text-on-surface-variant">수집 게시물</p>
          </div>
          <div className="text-right">
            <p className="font-metric-md text-metric-md tabular-nums">{adsCount}</p>
            <p className="font-label-muted text-label-muted text-on-surface-variant">활성 광고</p>
          </div>
        </div>
      </Card>

      {/* 유형 필터 */}
      <Card className="flex items-center gap-2 overflow-x-auto p-3 sm:flex-wrap">
        <span className="material-symbols-outlined notranslate text-on-surface-variant text-[20px] ml-1">filter_list</span>
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
        <span className="ml-auto shrink-0 pr-2 font-label-muted text-label-muted text-on-surface-variant">{filtered.length}개</span>
      </Card>

      {filtered.length === 0 ? (
        <Card className="p-12 text-center text-on-surface-variant">
          <span className="material-symbols-outlined notranslate text-[40px] opacity-40">inbox</span>
          <p className="mt-2 font-body-md text-body-md">아직 수집된 데이터가 없습니다.</p>
        </Card>
      ) : (
        <FeedGrid items={filtered} />
      )}
    </div>
  );
}
