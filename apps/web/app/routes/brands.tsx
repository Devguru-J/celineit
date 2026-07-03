import { Link, useLoaderData } from "react-router";
import { Card } from "~/components/ui";
import { PLATFORM_META, type Platform } from "~/mock/data";
import { getBrandsOverview } from "~/lib/queries.server";

export function meta() {
  return [{ title: "Celine Intelligence · 브랜드" }];
}

export async function loader() {
  return { brands: await getBrandsOverview() };
}

const SWATCHES = [
  "from-rose-800 to-rose-600",
  "from-indigo-800 to-indigo-600",
  "from-amber-700 to-amber-500",
  "from-emerald-800 to-emerald-600",
  "from-fuchsia-800 to-fuchsia-600",
];

export default function Brands() {
  const { brands } = useLoaderData<typeof loader>();
  return (
    <div className="space-y-card-gap p-4 sm:p-container-padding">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-body-md text-body-md text-on-surface-variant">모니터링 중인 브랜드 {brands.length}개</p>
        <button className="flex w-full items-center justify-center gap-2 rounded bg-primary px-4 py-2 font-body-sm text-body-sm font-semibold text-on-primary transition-opacity hover:opacity-90 sm:w-auto">
          <span className="material-symbols-outlined notranslate text-[18px]">add</span>
          브랜드 추가
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-card-gap">
        {brands.map((b, idx) => (
          <Link key={b.id} to={`/brands/${b.slug}`} className="block">
          <Card className="overflow-hidden hover:border-primary/40 hover:-translate-y-0.5 transition-all h-full">
            <div className={`h-20 bg-gradient-to-br ${SWATCHES[idx % SWATCHES.length]}`} />
            <div className="-mt-10 p-4 sm:p-container-padding">
              <div className="w-14 h-14 rounded-xl bg-surface-container-lowest border border-outline-variant flex items-center justify-center text-headline-sm font-bold text-primary shadow-sm">
                {b.name.replace(/[^A-Za-z가-힣ぁ-んァ-ン一-龥]/g, "").charAt(0) || "B"}
              </div>
              <h3 className="font-headline-sm text-headline-sm mt-3">{b.name}</h3>
              <div className="flex items-center gap-1.5 mt-2">
                {b.platforms.map((p: Platform) => (
                  <span key={p} className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-surface-container" title={PLATFORM_META[p].label}>
                    <span className={`w-2 h-2 rounded-full ${PLATFORM_META[p].dot}`} />
                  </span>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-outline-variant">
                <div>
                  <p className="font-metric-md text-metric-md tabular-nums">{b.adsCount}</p>
                  <p className="font-label-muted text-label-muted text-on-surface-variant">활성 광고</p>
                </div>
                <div>
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
