import { Link, useLoaderData } from "react-router";
import { Card, PlatformChip } from "~/components/ui";
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

      <div className="grid grid-cols-1 gap-card-gap md:grid-cols-2 lg:grid-cols-3">
        {brands.map((b) => (
          <Link key={b.id} to={`/brands/${b.slug}`} className="block">
          <Card className="h-full overflow-hidden transition-all hover:-translate-y-0.5 hover:border-primary/40">
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
          </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
