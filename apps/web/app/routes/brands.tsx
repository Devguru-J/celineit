import { useEffect, useMemo, useState } from "react";
import { Link, useLoaderData } from "react-router";
import { Card, CardHeader, PlatformChip } from "~/components/ui";
import { BrandBanner, BrandLogo } from "~/lib/brand-assets";
import type { Platform } from "~/mock/data";
import { getBrandsOverview } from "~/lib/queries.server";

export function meta() {
  return [{ title: "Celine Intelligence · 브랜드" }];
}

export async function loader() {
  return { brands: await getBrandsOverview() };
}

export default function Brands() {
  const { brands } = useLoaderData<typeof loader>();
  const [watchlist, setWatchlist] = useState<string[]>([]);

  useEffect(() => {
    try {
      setWatchlist(JSON.parse(localStorage.getItem("celine:brand-watchlist") ?? "[]"));
    } catch {
      setWatchlist([]);
    }
  }, []);

  const watchedBrands = useMemo(() => brands.filter((b) => watchlist.includes(b.slug)), [brands, watchlist]);

  function toggleWatch(slug: string) {
    setWatchlist((cur) => {
      const next = cur.includes(slug) ? cur.filter((s) => s !== slug) : [...cur, slug];
      localStorage.setItem("celine:brand-watchlist", JSON.stringify(next));
      return next;
    });
  }

  return (
    <div className="space-y-card-gap p-4 sm:p-container-padding">
      <Card className="surface-grid flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-container-padding">
        <div>
          <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">Brand registry</span>
          <p className="mt-1 font-body-md text-body-md text-on-surface-variant">모니터링 중인 브랜드 {brands.length}개</p>
        </div>
        <button className="flex min-h-11 w-full items-center justify-center gap-2 rounded bg-primary px-4 py-2 font-body-sm text-body-sm font-semibold text-on-primary shadow-[0_10px_20px_rgba(53,37,205,0.16)] transition-all hover:-translate-y-0.5 hover:bg-primary/90 active:translate-y-0 sm:w-auto">
          <span className="material-symbols-outlined notranslate text-[18px]">add</span>
          브랜드 추가
        </button>
      </Card>

      <Card>
        <CardHeader
          title="Watchlist"
          action={<span className="font-label-muted text-label-muted text-on-surface-variant">{watchedBrands.length}개 고정</span>}
        />
        <div className="flex gap-2 overflow-x-auto p-4 sm:p-container-padding">
          {watchedBrands.length === 0 ? (
            <p className="font-body-sm text-body-sm text-on-surface-variant">브랜드 카드의 별 아이콘을 눌러 자주 보는 브랜드를 고정하세요.</p>
          ) : (
            watchedBrands.map((b) => (
              <Link
                key={b.slug}
                to={`/trends?brand=${b.slug}&platform=all`}
                className="flex min-h-12 shrink-0 items-center gap-2 rounded border border-outline-variant/70 bg-surface-container-lowest px-3 py-2 transition-colors hover:border-primary/40"
              >
                <BrandLogo slug={b.slug} name={b.name} className="h-8 w-8" />
                <span className="max-w-[180px] truncate font-body-sm text-body-sm font-semibold">{b.name}</span>
              </Link>
            ))
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-card-gap md:grid-cols-2 lg:grid-cols-3">
        {brands.map((b) => (
          <Card key={b.id} className="relative h-full overflow-hidden transition-all hover:-translate-y-0.5 hover:border-primary/40">
            <button
              type="button"
              onClick={() => toggleWatch(b.slug)}
              className={`absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded border border-white/70 bg-white/90 shadow-[0_10px_24px_rgba(20,18,48,0.18)] backdrop-blur transition-colors hover:border-primary/50 ${
                watchlist.includes(b.slug) ? "text-primary" : "text-on-surface-variant"
              }`}
              aria-label={`${b.name} watchlist`}
            >
              <span className="material-symbols-outlined notranslate text-[20px]">
                {watchlist.includes(b.slug) ? "star" : "star_outline"}
              </span>
            </button>
            <Link to={`/brands/${b.slug}`} className="block h-full">
            <div className="relative">
              <BrandBanner slug={b.slug} name={b.name} className="h-28 sm:h-32" />
              <BrandLogo
                slug={b.slug}
                name={b.name}
                className="absolute bottom-3 left-4 z-10 h-14 w-14 border-white/80 bg-white/90 shadow-[0_16px_32px_rgba(20,18,48,0.18)] backdrop-blur sm:left-5"
              />
            </div>
            <div className="p-4 sm:p-container-padding">
              <h3 className="font-headline-sm text-headline-sm mt-3">{b.name}</h3>
              <div className="flex items-center gap-1.5 mt-2">
                {b.platforms.map((p: Platform) => (
                  <PlatformChip key={p} platform={p} withIcon />
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-outline-variant">
                <div className="rounded bg-surface-container-low p-3">
                  <p className="font-metric-md text-metric-md tabular-nums">{b.adsCount}</p>
                  <p className="font-label-muted text-label-muted text-on-surface-variant">활성 광고</p>
                </div>
                <div className="rounded bg-surface-container-low p-3">
                  <p className="font-metric-md text-metric-md tabular-nums">{b.postsCount}</p>
                  <p className="font-label-muted text-label-muted text-on-surface-variant">수집 게시물</p>
                </div>
              </div>
            </div>
            </Link>
          </Card>
        ))}
      </div>
    </div>
  );
}
