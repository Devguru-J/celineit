import { Card } from "~/components/ui";
import { ads, brands, PLATFORM_META, posts, type Platform } from "~/mock/data";

export function meta() {
  return [{ title: "Celine Intelligence · 브랜드" }];
}

const ALL_PLATFORMS: Platform[] = ["meta_ads", "instagram", "twitter", "tiktok"];

export default function Brands() {
  return (
    <div className="p-container-padding space-y-card-gap">
      <div className="flex items-center justify-between">
        <p className="font-body-md text-body-md text-on-surface-variant">모니터링 중인 브랜드 {brands.length}개</p>
        <button className="flex items-center gap-2 px-4 py-2 rounded bg-primary text-on-primary font-body-sm text-body-sm font-semibold hover:opacity-90 transition-opacity">
          <span className="material-symbols-outlined text-[18px]">add</span>
          브랜드 추가
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-card-gap">
        {brands.map((b) => {
          const brandAds = ads.filter((a) => a.brand === b.name);
          const brandPosts = posts.filter((p) => p.brand === b.name);
          return (
            <Card key={b.id} className="overflow-hidden hover:border-primary/40 hover:-translate-y-0.5 transition-all">
              <div className={`h-20 bg-gradient-to-br ${b.swatch}`} />
              <div className="p-container-padding -mt-10">
                <div className="w-14 h-14 rounded-xl bg-surface-container-lowest border border-outline-variant flex items-center justify-center text-headline-sm font-bold text-primary shadow-sm">
                  {b.name.charAt(0)}
                </div>
                <h3 className="font-headline-sm text-headline-sm mt-3">{b.name}</h3>
                <div className="flex items-center gap-1.5 mt-2">
                  {ALL_PLATFORMS.map((p) => (
                    <span key={p} className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-surface-container" title={PLATFORM_META[p].label}>
                      <span className={`w-2 h-2 rounded-full ${PLATFORM_META[p].dot}`} />
                    </span>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-outline-variant">
                  <div>
                    <p className="font-metric-md text-metric-md tabular-nums">{brandAds.length}</p>
                    <p className="font-label-muted text-label-muted text-on-surface-variant">활성 광고</p>
                  </div>
                  <div>
                    <p className="font-metric-md text-metric-md tabular-nums">{brandPosts.length}</p>
                    <p className="font-label-muted text-label-muted text-on-surface-variant">최근 게시물</p>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
