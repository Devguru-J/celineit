import { Link, useLoaderData } from "react-router";
import { BarChart, Card, CardHeader, KpiDelta, PlatformChip } from "~/components/ui";
import { getFollowerGrowth, getRecentChanges, getSummary, type RecentChangeKind } from "~/lib/queries.server";

export function meta() {
  return [{ title: "Celine Intelligence · 요약" }];
}

export async function loader() {
  const [summary, recent, followerGrowth] = await Promise.all([getSummary(), getRecentChanges(), getFollowerGrowth()]);
  return { ...summary, recent, followerGrowth };
}

// 이벤트 타입별 표시.
const CHANGE_META: Record<RecentChangeKind, { icon: string; label: string; cls: string }> = {
  new_ad: { icon: "campaign", label: "신규 광고 감지", cls: "text-primary bg-primary-container/20" },
  ad_inactive: { icon: "block", label: "광고 비활성화", cls: "text-rose-600 bg-rose-50" },
  follower_spike: { icon: "trending_up", label: "팔로워 급증", cls: "text-emerald-600 bg-emerald-50" },
  new_post: { icon: "post_add", label: "신규 게시물", cls: "text-primary bg-primary-container/20" },
};

export default function Summary() {
  const { kpis, recent, brands, followerGrowth } = useLoaderData<typeof loader>();
  const maxPosts = Math.max(1, ...brands.map((b) => b.postsCount));

  return (
    <div className="space-y-card-gap p-4 sm:p-container-padding">
      {/* KPI 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-card-gap">
        {kpis.map((k) => (
          <div
            key={k.label}
            className="flex min-h-[132px] flex-col justify-between rounded border border-outline-variant bg-surface-container-lowest p-4 transition-all hover:-translate-y-0.5 hover:border-primary/50 sm:p-container-padding"
          >
            <div className="flex justify-between items-start">
              <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">{k.label}</span>
              <span className="material-symbols-outlined notranslate text-primary text-[20px]">{k.icon}</span>
            </div>
            <div className="mt-4 flex items-end justify-between gap-2">
              <h3 className="font-metric-lg text-metric-lg tabular-nums">{k.value}</h3>
              {k.delta && <KpiDelta dir={k.delta.dir} text={k.delta.text} />}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-card-gap">
        {/* 최근 변경 (타입별 이벤트) */}
        <Card className="lg:col-span-2 overflow-hidden">
          <CardHeader title="최근 변경" />
          <div className="timeline-line relative p-4 sm:p-container-padding">
            <div className="space-y-8">
              {recent.length === 0 && <p className="text-on-surface-variant font-body-md text-body-md">아직 데이터가 없습니다.</p>}
              {recent.map((c) => {
                const m = CHANGE_META[c.kind];
                return (
                  <Link
                    key={`${c.kind}-${c.id}`}
                    to={c.linkTo}
                    className="group relative z-10 -m-2 flex gap-4 rounded-lg p-2 transition-colors hover:bg-surface-dim/30 sm:gap-6"
                  >
                    {c.imageUrl ? (
                      <img
                        src={c.imageUrl}
                        alt=""
                        className="h-[40px] w-[40px] flex-shrink-0 rounded-lg border-2 border-surface object-cover"
                      />
                    ) : (
                      <div className={`flex h-[40px] w-[40px] flex-shrink-0 items-center justify-center rounded-full border-2 border-surface ${m.cls}`}>
                        <span className="material-symbols-outlined notranslate text-[20px]">{m.icon}</span>
                      </div>
                    )}
                    <div className="flex-1 pb-1">
                      <p className="font-body-md text-body-md font-semibold line-clamp-1 group-hover:text-primary transition-colors">
                        {c.brand} · {m.label}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <PlatformChip platform={c.platform} />
                        <span className="font-label-muted text-label-muted text-on-surface-variant">{c.when}</span>
                      </div>
                      {c.text && (
                        <p className="mt-2 font-body-sm text-body-sm text-on-surface-variant line-clamp-1 italic">"{c.text}"</p>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </Card>

        {/* 인사이트 패널 */}
        <div className="grid gap-card-gap lg:auto-rows-min">
          {/* 팔로워 성장 */}
          <Card className="p-4 sm:p-container-padding">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">크로스 플랫폼</span>
                <h3 className="mt-1 font-headline-sm text-headline-sm">팔로워 성장</h3>
              </div>
              {followerGrowth.deltaPct != null && (
                <KpiDelta dir={followerGrowth.deltaPct >= 0 ? "up" : "down"} text={`${followerGrowth.deltaPct > 0 ? "+" : ""}${followerGrowth.deltaPct}%`} />
              )}
            </div>
            {followerGrowth.series.length === 0 ? (
              <p className="font-body-sm text-body-sm text-on-surface-variant">아직 팔로워 시계열이 없습니다.</p>
            ) : (
              <>
                <BarChart data={followerGrowth.series.map((s) => ({ value: s.total }))} height={120} />
                <div className="mt-4 space-y-2">
                  {followerGrowth.byPlatform.map((p) => (
                    <div key={p.platform} className="flex items-center justify-between">
                      <PlatformChip platform={p.platform} withIcon />
                      <span className="font-body-sm text-body-sm tabular-nums">{p.followers.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Card>
        </div>
      </div>

      {/* 브랜드 현황 */}
      <Card>
        <CardHeader title="모니터링 브랜드 현황" />
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface">
                {["브랜드", "수집 게시물", "활성 광고", "상태"].map((h, i) => (
                  <th key={h} className={`px-container-padding py-3 font-label-caps text-label-caps text-on-surface-variant uppercase border-b border-outline-variant ${i >= 1 && i <= 2 ? "text-right" : i === 3 ? "text-center" : ""}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {brands.map((b) => (
                <tr key={b.id} className="hover:bg-surface-dim/30 transition-colors">
                  <td className="px-container-padding py-4">
                    <Link to={`/brands/${b.slug}`} className="flex items-center gap-3 group">
                      <div className="w-2 h-8 rounded-full bg-primary" style={{ opacity: 0.3 + 0.7 * (b.postsCount / maxPosts) }} />
                      <span className="font-body-md text-body-md font-semibold group-hover:text-primary transition-colors">{b.name}</span>
                    </Link>
                  </td>
                  <td className="px-container-padding py-4 text-right tabular-nums font-body-md">{b.postsCount}</td>
                  <td className="px-container-padding py-4 text-right tabular-nums font-body-md">{b.adsCount}</td>
                  <td className="px-container-padding py-4 text-center">
                    <span className={`px-2 py-1 rounded font-label-caps text-[10px] ${b.postsCount > 0 ? "bg-emerald-50 text-emerald-700" : "bg-surface-variant text-on-surface-variant"}`}>
                      {b.postsCount > 0 ? "추적 중" : "대기"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
