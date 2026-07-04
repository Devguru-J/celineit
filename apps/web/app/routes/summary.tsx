import { Link, useLoaderData } from "react-router";
import { BarChart, Card, CardHeader, KpiDelta, PlatformChip } from "~/components/ui";
import { BrandLogo } from "~/lib/brand-assets";
import { ACTIVE_PLATFORMS } from "@celine/shared";
import {
  getDashboardAlerts,
  getDataQualityStatus,
  getFollowerGrowth,
  getPlatformMatrix,
  getRecentChanges,
  getSummary,
  type RecentChangeKind,
} from "~/lib/queries.server";

export function meta() {
  return [{ title: "Celine Intelligence · 요약" }];
}

export async function loader() {
  const [summary, recent, followerGrowth, matrix, alerts, dataQuality] = await Promise.all([
    getSummary(),
    getRecentChanges(),
    getFollowerGrowth(),
    getPlatformMatrix(),
    getDashboardAlerts(),
    getDataQualityStatus(),
  ]);
  return { ...summary, recent, followerGrowth, matrix, alerts, dataQuality };
}

// 이벤트 타입별 표시.
const CHANGE_META: Record<RecentChangeKind, { icon: string; label: string; cls: string }> = {
  new_ad: { icon: "campaign", label: "신규 광고 감지", cls: "text-primary bg-primary-container/20" },
  ad_inactive: { icon: "block", label: "광고 비활성화", cls: "text-rose-600 bg-rose-50" },
  follower_spike: { icon: "trending_up", label: "팔로워 급증", cls: "text-emerald-600 bg-emerald-50" },
  new_post: { icon: "post_add", label: "신규 게시물", cls: "text-primary bg-primary-container/20" },
};

export default function Summary() {
  const { kpis, recent, brands, followerGrowth, matrix, alerts, dataQuality } = useLoaderData<typeof loader>();
  const maxPosts = Math.max(1, ...brands.map((b) => b.postsCount));
  const totalFollowers = followerGrowth.byPlatform.reduce((sum, p) => sum + p.followers, 0);
  const topFollowerPlatform = followerGrowth.byPlatform[0] ?? null;
  const hasFollowerTrend = followerGrowth.series.length >= 2;
  const followersByPlatform = new Map(followerGrowth.byPlatform.map((p) => [p.platform, p.followers]));
  const followerPlatforms = ACTIVE_PLATFORMS.map((platform) => ({
    platform,
    followers: followersByPlatform.get(platform) ?? null,
  }));

  return (
    <div className="space-y-card-gap p-4 sm:p-container-padding">
      <Card className="surface-grid overflow-hidden">
        <div className="flex flex-col gap-5 p-4 sm:p-container-padding lg:flex-row lg:items-end lg:justify-between">
          <div>
            <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">Summary dashboard</span>
            <h2 className="mt-2 font-metric-lg text-metric-lg text-on-surface">경쟁 브랜드 활동 현황</h2>
            <p className="mt-2 max-w-[58ch] font-body-md text-body-md text-on-surface-variant">
              게시물, 광고, 수집 실행 상태를 한 화면에서 확인합니다. 데이터가 없는 감성·광고비 지표는 표시하지 않습니다.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 lg:min-w-[360px]">
            {kpis.slice(0, 3).map((k) => (
              <div key={k.label} className="rounded border border-outline-variant/70 bg-surface-container-lowest/80 p-3">
                <p className="truncate font-label-muted text-[11px] text-on-surface-variant">{k.label}</p>
                <p className="mt-1 font-metric-md text-metric-md tabular-nums">{k.value}</p>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* KPI 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-card-gap">
        {kpis.map((k) => (
          <div
            key={k.label}
            className="surface-grid flex min-h-[140px] flex-col justify-between rounded border border-outline-variant/80 bg-surface-container-lowest p-4 shadow-[0_12px_32px_rgba(53,37,205,0.05),inset_0_1px_0_rgba(255,255,255,0.86)] transition-all hover:-translate-y-0.5 hover:border-primary/50 sm:p-container-padding"
          >
            <div className="flex justify-between items-start">
              <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">{k.label}</span>
              <span className="material-symbols-outlined notranslate rounded bg-primary-container/10 p-1.5 text-primary text-[20px]">{k.icon}</span>
            </div>
            <div>
              <div className="mt-4 flex items-end justify-between gap-2">
                <h3 className="font-metric-lg text-metric-lg tabular-nums">{k.value}</h3>
                {k.delta && <KpiDelta dir={k.delta.dir} text={k.delta.text} />}
              </div>
              <div className="mt-4 h-1.5 overflow-hidden rounded bg-surface-variant">
                <div className="h-full rounded bg-primary" style={{ width: `${metricWidth(k.value)}%` }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-card-gap xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="브랜드 / 플랫폼 비교"
            action={<span className="font-label-muted text-label-muted text-on-surface-variant">followers · posts · ads</span>}
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left">
              <thead>
                <tr className="bg-surface">
                  <th className="border-b border-outline-variant px-container-padding py-3 font-label-caps text-label-caps uppercase text-on-surface-variant">
                    브랜드
                  </th>
                  {ACTIVE_PLATFORMS.map((platform) => (
                    <th key={platform} className="border-b border-outline-variant px-container-padding py-3 text-center">
                      <PlatformChip platform={platform} withIcon />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {matrix.slice(0, 8).map((row) => (
                  <tr key={row.slug} className="transition-colors hover:bg-surface-dim/30">
                    <td className="px-container-padding py-3">
                      <Link to={`/trends?brand=${row.slug}&platform=all`} className="flex items-center gap-3">
                        <BrandLogo slug={row.slug} name={row.brand} className="h-8 w-8 shrink-0" />
                        <span className="font-body-sm text-body-sm font-semibold">{row.brand}</span>
                      </Link>
                    </td>
                    {row.platforms.map((cell) => (
                      <td key={cell.platform} className="px-container-padding py-3">
                        <div className="mx-auto max-w-[132px] rounded border border-outline-variant/70 bg-surface-container-lowest p-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-label-muted text-[10px] text-on-surface-variant">팔로워</span>
                            <span className="font-body-sm text-body-sm tabular-nums">{cell.followers != null ? shortNumber(cell.followers) : "—"}</span>
                          </div>
                          <div className="mt-1 flex items-center justify-between gap-2">
                            <span className="font-label-muted text-[10px] text-on-surface-variant">게시/광고</span>
                            <span className="font-body-sm text-body-sm tabular-nums">{cell.posts}/{cell.activeAds}</span>
                          </div>
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-4 sm:p-container-padding">
          <div className="mb-4">
            <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">Priority alerts</span>
            <h3 className="mt-1 font-headline-sm text-headline-sm">오늘 볼 변화</h3>
          </div>
          <div className="space-y-3">
            {alerts.length === 0 && <p className="font-body-sm text-body-sm text-on-surface-variant">현재 우선 확인할 알림이 없습니다.</p>}
            {alerts.map((alert) => (
              <Link key={alert.id} to={alert.linkTo} className="flex gap-3 rounded border border-outline-variant/70 bg-surface-container-lowest p-3 transition-colors hover:border-primary/40">
                <span className={`material-symbols-outlined notranslate text-[20px] ${alert.severity === "high" ? "text-rose-600" : alert.severity === "medium" ? "text-primary" : "text-on-surface-variant"}`}>
                  {alert.icon}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-body-sm text-body-sm font-semibold">{alert.title}</span>
                  <span className="mt-0.5 block line-clamp-2 font-label-muted text-label-muted text-on-surface-variant">{alert.detail}</span>
                </span>
              </Link>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="데이터 품질 상태" />
        <div className="grid grid-cols-1 divide-y divide-outline-variant md:grid-cols-4 md:divide-x md:divide-y-0">
          {dataQuality.map((q) => (
            <div key={q.platform} className="p-4 sm:p-container-padding">
              <div className="mb-3 flex items-center justify-between">
                <PlatformChip platform={q.platform} withIcon />
                <span className={`rounded px-2 py-1 font-label-caps text-[10px] ${
                  q.status === "fresh"
                    ? "bg-emerald-50 text-emerald-700"
                    : q.status === "stale"
                      ? "bg-amber-50 text-amber-700"
                      : "bg-rose-50 text-rose-700"
                }`}>
                  {q.status}
                </span>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant">{q.message}</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <MiniQuality label="계정" value={String(q.accounts)} />
                <MiniQuality label="최근 수집" value={q.lastRun ?? "—"} />
              </div>
            </div>
          ))}
        </div>
      </Card>

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
            <>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded bg-surface-container-low p-3">
                  <p className="font-label-muted text-[11px] text-on-surface-variant">총 팔로워</p>
                  <p className="mt-1 font-metric-md text-metric-md tabular-nums">{totalFollowers ? totalFollowers.toLocaleString() : "—"}</p>
                </div>
                <div className="rounded bg-surface-container-low p-3">
                  <p className="font-label-muted text-[11px] text-on-surface-variant">최대 채널</p>
                  <p className="mt-1 truncate font-body-md text-body-md font-semibold">
                    {topFollowerPlatform ? topFollowerPlatform.followers.toLocaleString() : "—"}
                  </p>
                </div>
              </div>
              {hasFollowerTrend ? (
                <div className="mt-4">
                  <BarChart data={followerGrowth.series.map((s) => ({ value: s.total }))} height={112} />
                  <div className="mt-2 flex justify-between font-label-muted text-[11px] text-on-surface-variant">
                    <span>{followerGrowth.series[0]?.date}</span>
                    <span>{followerGrowth.series.at(-1)?.date}</span>
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded border border-outline-variant/70 bg-surface-container-lowest p-3">
                  <div className="flex items-start gap-2">
                    <span className="material-symbols-outlined notranslate text-[18px] text-primary">info</span>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">
                      현재는 최신 스냅샷 기준입니다. 2일 이상 수집되면 성장률과 추세 차트가 표시됩니다.
                    </p>
                  </div>
                </div>
              )}
              <div className="mt-4 space-y-3">
                {followerPlatforms.map((p) => (
                  <div key={p.platform}>
                    <div className="mb-1.5 flex items-center justify-between">
                      <PlatformChip platform={p.platform} withIcon />
                      <span className={`font-body-sm text-body-sm tabular-nums ${p.followers == null ? "text-on-surface-variant" : ""}`}>
                        {p.followers != null ? p.followers.toLocaleString() : "—"}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded bg-surface-variant">
                      <div
                        className={`h-full rounded ${p.followers == null ? "bg-outline-variant" : "bg-primary"}`}
                        style={{ width: `${totalFollowers > 0 && p.followers != null ? (p.followers / totalFollowers) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </>
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
                      <BrandLogo slug={b.slug} name={b.name} className="h-8 w-8 shrink-0" />
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

function metricWidth(value: string) {
  const n = Number(value.replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return 8;
  return Math.max(12, Math.min(100, n * 12));
}

function shortNumber(value: number) {
  if (value >= 1_000_000) return `${Math.round(value / 100_000) / 10}M`;
  if (value >= 1_000) return `${Math.round(value / 100) / 10}K`;
  return value.toLocaleString();
}

function MiniQuality({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded bg-surface-container-low p-2">
      <p className="font-label-muted text-[10px] text-on-surface-variant">{label}</p>
      <p className="mt-1 truncate font-body-sm text-body-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}
