import { useState } from "react";
import { Link, useLoaderData } from "react-router";
import { BarChart, Card, CardHeader, LineChart, MediaImage, PlatformChip } from "~/components/ui";
import { BrandLogo } from "~/lib/brand-assets";
import { fmt, PLATFORM_META, type Platform } from "~/mock/data";
import { getTrends } from "~/lib/queries.server";

export function meta() {
  return [{ title: "Celine Intelligence · 트렌드" }];
}

export async function loader({ request }: { request: Request }) {
  const url = new URL(request.url);
  const rawPlatform = url.searchParams.get("platform");
  const platform = rawPlatform && (rawPlatform === "all" || rawPlatform in PLATFORM_META) ? (rawPlatform as Platform | "all") : "all";
  return { trends: await getTrends(url.searchParams.get("brand") ?? undefined, platform), platform };
}

export default function Trends() {
  const { trends } = useLoaderData<typeof loader>();
  const [range, setRange] = useState<7 | 30 | 90>(30);

  if (!trends) {
    return (
      <div className="p-4 sm:p-container-padding">
        <Card className="p-12 text-center text-on-surface-variant">데이터가 없습니다.</Card>
      </div>
    );
  }

  const { account, followerSeries, topPosts, allAccounts, platformBreakdown, insights, contentClusters, metaAds } = trends;
  const visibleFollowerSeries = followerSeries.slice(-range);
  const hasFollowers = visibleFollowerSeries.length >= 2 && visibleFollowerSeries.some((p) => p.value > 0);
  const totalEngagement = topPosts.reduce((sum, p) => sum + (p.likes ?? 0) + (p.comments ?? 0) + (p.views ?? 0), 0);

  return (
    <div className="space-y-card-gap p-4 sm:p-container-padding">
      <Card className="overflow-hidden">
        <div className="surface-grid flex flex-wrap items-center gap-4 border-b border-outline-variant/80 bg-surface-container-low p-4 sm:gap-6 sm:p-container-padding">
          <div className="flex h-14 w-14 items-center justify-center rounded bg-primary text-on-primary shadow-[0_12px_24px_rgba(53,37,205,0.18)]">
            <span className="material-symbols-outlined notranslate text-[28px]">monitoring</span>
          </div>
          <div className="min-w-0 flex-1">
            <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">Trends dashboard</span>
            <div className="flex items-center gap-2">
              <h3 className="font-headline-sm text-headline-sm">{account.brand}</h3>
              {account.platform === "all" ? (
                <span className="rounded border border-outline-variant/70 bg-surface-container-low px-2 py-0.5 font-label-muted text-[10px] font-bold uppercase text-on-surface-variant">
                  ALL
                </span>
              ) : (
                <PlatformChip platform={account.platform} withIcon />
              )}
            </div>
            <p className="font-label-muted text-label-muted text-on-surface-variant">{account.handle}</p>
          </div>
          <div className="flex w-full gap-1 overflow-x-auto pb-1 lg:w-auto lg:max-w-[58%]">
            {allAccounts.map((a) => (
              <Link
                key={a.slug}
                to={`/trends?brand=${encodeURIComponent(a.slug)}&platform=all`}
                className={`flex min-h-10 shrink-0 items-center gap-2 rounded border px-2.5 py-1.5 font-label-muted text-[11px] transition-colors ${
                  a.brand === account.brand
                    ? "border-primary/40 bg-primary-container/10 text-primary"
                    : "border-outline-variant/70 bg-surface-container-lowest/70 text-on-surface-variant hover:border-primary/40"
                }`}
              >
                <BrandLogo slug={a.slug} name={a.brand} className="h-6 w-6 shrink-0" />
                <span className="max-w-[180px] truncate">{a.brand}</span>
              </Link>
            ))}
          </div>
        </div>
        <div className="flex gap-2 overflow-x-auto border-b border-outline-variant/80 bg-surface-container-lowest px-4 py-3 sm:px-container-padding">
          <Link
            to={`/trends?brand=${encodeURIComponent(account.slug)}&platform=all`}
            className={`flex min-h-10 shrink-0 items-center gap-2 rounded border px-3 py-2 font-body-sm text-body-sm transition-colors ${
              account.platform === "all"
                ? "border-primary/40 bg-primary-container/10 text-primary"
                : "border-outline-variant/70 bg-surface-container-low text-on-surface-variant hover:border-primary/40"
            }`}
          >
            <span className="material-symbols-outlined notranslate text-[18px]">hub</span>
            전체 매체
          </Link>
          {platformBreakdown.map((p) => (
            <Link
              key={`${p.platform}-${p.handle}`}
              to={`/trends?brand=${encodeURIComponent(account.slug)}&platform=${p.platform}`}
              className={`flex min-h-10 shrink-0 items-center gap-2 rounded border px-3 py-2 font-body-sm text-body-sm transition-colors ${
                account.platform === p.platform
                  ? "border-primary/40 bg-primary-container/10 text-primary"
                  : "border-outline-variant/70 bg-surface-container-low text-on-surface-variant hover:border-primary/40"
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${PLATFORM_META[p.platform].dot}`} />
              {PLATFORM_META[p.platform].short}
            </Link>
          ))}
        </div>
        <div className="grid grid-cols-1 divide-y divide-outline-variant/80 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <TrendMetric label="팔로워" value={account.followers ? fmt(account.followers) : "—"} icon="group" />
          <TrendMetric
            label="평균 인게이지먼트"
            value={account.engagementRate != null ? `${account.engagementRate.toFixed(2)}%` : "—"}
            icon="percent"
          />
          <TrendMetric label="상위 콘텐츠 반응" value={fmt(totalEngagement)} icon="bolt" />
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-card-gap md:grid-cols-2 xl:grid-cols-4">
        {platformBreakdown.map((p) => (
          <Link
            key={`${p.platform}-${p.handle}-card`}
            to={`/trends?brand=${encodeURIComponent(account.slug)}&platform=${p.platform}`}
            className="block"
          >
            <Card className={`p-4 transition-all hover:-translate-y-0.5 hover:border-primary/40 ${p.active ? "border-primary/50 bg-primary-container/5" : ""}`}>
              <div className="mb-4 flex items-center justify-between">
                <PlatformChip platform={p.platform} withIcon />
                <span className="font-label-muted text-[11px] text-on-surface-variant">{p.handle}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <MiniMetric label="팔로워" value={p.followers != null ? fmt(p.followers) : "—"} />
                <MiniMetric label="게시물" value={String(p.posts)} />
                <MiniMetric label="반응" value={fmt(p.engagement)} />
              </div>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-card-gap lg:grid-cols-3">
        <Card className="p-4 sm:p-container-padding lg:col-span-2">
          <div className="mb-4">
            <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">Insight summary</span>
            <h3 className="mt-1 font-headline-sm text-headline-sm">브랜드 운영 신호</h3>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {insights.map((insight, index) => (
              <div key={insight} className="rounded border border-outline-variant/70 bg-surface-container-lowest p-3">
                <span className="material-symbols-outlined notranslate text-[20px] text-primary">
                  {index === 0 ? "hub" : index === 1 ? "category" : "trending_up"}
                </span>
                <p className="mt-2 font-body-sm text-body-sm text-on-surface-variant">{insight}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-4 sm:p-container-padding">
          <div className="mb-4">
            <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">Meta Ads</span>
            <h3 className="mt-1 font-headline-sm text-headline-sm">광고 라이브러리</h3>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <MiniMetric label="활성 광고" value={String(metaAds.active)} />
            <MiniMetric label="신규 7일" value={String(metaAds.new7d)} />
            <MiniMetric label="종료 7일" value={String(metaAds.inactive7d)} />
            <MiniMetric label="평균 집행일" value={metaAds.avgDaysActive != null ? `${metaAds.avgDaysActive}일` : "—"} />
          </div>
          <div className="mt-4 rounded border border-outline-variant/70 bg-surface-container-lowest p-3">
            <p className="font-label-muted text-[11px] text-on-surface-variant">최장 집행 광고</p>
            {metaAds.longestActive ? (
              <Link to={`/item/ad/${metaAds.longestActive.id}`} className="mt-1 block font-body-sm text-body-sm font-semibold hover:text-primary">
                {metaAds.longestActive.daysActive}일 · {metaAds.longestActive.copy || "광고 문구 없음"}
              </Link>
            ) : (
              <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">활성 Meta 광고 데이터가 없습니다.</p>
            )}
          </div>
          {metaAds.ctaMix.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {metaAds.ctaMix.map((cta) => (
                <span key={cta.cta} className="rounded border border-outline-variant/70 bg-surface-container-low px-2 py-1 font-label-muted text-[10px] text-on-surface-variant">
                  {cta.cta} · {cta.count}
                </span>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-card-gap lg:grid-cols-3">
        <Card className="p-4 sm:p-container-padding lg:col-span-2">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="font-headline-sm text-headline-sm">일별 팔로워</h3>
              <p className="mt-1 font-label-muted text-label-muted text-on-surface-variant">하루 단위 순 팔로워 수</p>
            </div>
            <div className="flex rounded border border-outline-variant/70 bg-surface-container-low p-0.5">
              {[7, 30, 90].map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r as 7 | 30 | 90)}
                  className={`min-h-8 rounded px-2.5 font-label-muted text-[11px] transition-colors active:scale-[0.98] ${
                    range === r ? "bg-primary text-on-primary" : "text-on-surface-variant hover:bg-surface-container-high"
                  }`}
                >
                  {r}D
                </button>
              ))}
            </div>
          </div>
          {hasFollowers ? (
            <>
              <LineChart data={visibleFollowerSeries} stroke="#3525cd" />
              <div className="mt-3 flex justify-between font-label-muted text-[11px] text-on-surface-variant">
                <span>{visibleFollowerSeries[0]?.date ?? ""}</span>
                <span>{visibleFollowerSeries.at(-1)?.date ?? ""}</span>
              </div>
            </>
          ) : (
            <div className="flex h-40 flex-col items-center justify-center gap-2 text-on-surface-variant">
              <span className="material-symbols-outlined notranslate text-[32px] opacity-40">show_chart</span>
              <p className="font-body-sm text-body-sm">팔로워 시계열은 매일 수집이 누적되면 그려집니다.</p>
            </div>
          )}
        </Card>
        <Card className="p-4 sm:p-container-padding">
          <h3 className="font-headline-sm text-headline-sm">벤치마크 상태</h3>
          <p className="mt-1 font-label-muted text-label-muted text-on-surface-variant">모니터링 계정 분포 기준</p>
          <div className="mt-5">
            <div className="flex items-end justify-between">
              <span className="font-metric-lg text-metric-lg text-primary">{account.benchmark.band}</span>
              <span className="font-label-muted text-label-muted text-on-surface-variant">
                {account.benchmark.percentile != null ? `상위 ${100 - account.benchmark.percentile}%` : "데이터 부족"}
              </span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded bg-surface-variant">
              <div className="h-full rounded bg-primary" style={{ width: `${account.benchmark.percentile ?? 0}%` }} />
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-card-gap lg:grid-cols-3">
        <Card className="p-4 sm:p-container-padding lg:col-span-2">
          <h3 className="font-headline-sm text-headline-sm">주간 인게이지먼트</h3>
          <p className="mt-1 font-label-muted text-label-muted text-on-surface-variant">최근 4주 좋아요·댓글·조회 합계</p>
          <div className="mt-4">
            <BarChart data={trends.weeklyEngagement.map((w) => ({ value: w.value }))} height={150} />
            <div className="mt-2 grid grid-cols-4 text-center font-label-muted text-[11px] text-on-surface-variant">
              {trends.weeklyEngagement.map((w) => (
                <span key={w.week}>{w.week}</span>
              ))}
            </div>
          </div>
        </Card>
        <Card className="p-4 sm:p-container-padding">
          <h3 className="font-headline-sm text-headline-sm">콘텐츠 반응 구성</h3>
          <p className="mt-1 font-label-muted text-label-muted text-on-surface-variant">상위 게시물 기준</p>
          <div className="mt-5 space-y-4">
            <ReactionRow label="좋아요" icon="favorite" value={topPosts.reduce((sum, p) => sum + (p.likes ?? 0), 0)} total={totalEngagement} />
            <ReactionRow label="댓글" icon="chat_bubble" value={topPosts.reduce((sum, p) => sum + (p.comments ?? 0), 0)} total={totalEngagement} />
            <ReactionRow label="조회수" icon="visibility" value={topPosts.reduce((sum, p) => sum + (p.views ?? 0), 0)} total={totalEngagement} />
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="캠페인 클러스터" action={<span className="font-label-muted text-label-muted text-on-surface-variant">규칙 기반 분류</span>} />
        <div className="grid grid-cols-1 divide-y divide-outline-variant md:grid-cols-3 md:divide-x md:divide-y-0">
          {contentClusters.length === 0 && (
            <div className="p-4 text-on-surface-variant sm:p-container-padding">게시물 텍스트가 누적되면 클러스터가 표시됩니다.</div>
          )}
          {contentClusters.slice(0, 3).map((cluster) => (
            <div key={cluster.tag} className="p-4 sm:p-container-padding">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">Cluster</span>
                  <h3 className="mt-1 font-headline-sm text-headline-sm">{cluster.tag}</h3>
                </div>
                <span className="rounded bg-primary-container/10 px-2 py-1 font-label-muted text-[10px] font-semibold text-primary">
                  {cluster.posts} posts
                </span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <MiniMetric label="총 반응" value={fmt(cluster.engagement)} />
                <MiniMetric label="평균 반응" value={fmt(cluster.avgEngagement)} />
              </div>
              {cluster.examples[0] && (
                <p className="mt-3 line-clamp-2 font-body-sm text-body-sm text-on-surface-variant">"{cluster.examples[0]}"</p>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader title="성과 상위 게시물" action={<span className="font-label-muted text-label-muted text-on-surface-variant">{topPosts.length}개</span>} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] border-collapse text-left">
            <thead>
              <tr className="bg-surface">
                {["콘텐츠", "매체", "게시일", "인게이지먼트", "조회수", "상태"].map((h, i) => (
                  <th
                    key={h}
                    className={`border-b border-outline-variant/80 px-container-padding py-3 font-label-caps text-label-caps uppercase text-on-surface-variant ${i > 1 ? "text-right" : ""}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/80">
              {topPosts.map((p) => (
                <tr key={p.id} className="transition-colors hover:bg-surface-dim/30">
                  <td className="px-container-padding py-3">
                    <Link to={`/item/post/${p.id}`} className="flex items-center gap-3">
                      <MediaImage src={p.imageUrl} seed={p.id + (p.caption ?? "")} format={p.format} className="h-12 w-12 flex-shrink-0 rounded" />
                      <span className="max-w-[360px] truncate font-body-md text-body-md font-semibold">{p.caption}</span>
                    </Link>
                  </td>
                  <td className="px-container-padding py-3">
                    <PlatformChip platform={p.platform} withIcon />
                  </td>
                  <td className="px-container-padding py-3 text-right font-body-sm text-body-sm tabular-nums text-on-surface-variant">{p.postedAt ?? "—"}</td>
                  <td className="px-container-padding py-3 text-right font-body-sm text-body-sm tabular-nums">{fmt(p.engagement)}</td>
                  <td className="px-container-padding py-3 text-right font-body-sm text-body-sm tabular-nums">{p.views ? fmt(p.views) : "—"}</td>
                  <td className="px-container-padding py-3 text-right">
                    <span className={`rounded px-2 py-1 font-label-caps text-[10px] ${p.status === "VIRAL" ? "bg-primary-container/15 text-primary" : "bg-surface-variant text-on-surface-variant"}`}>
                      {p.status}
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

function TrendMetric({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="flex items-center justify-between gap-4 p-4 sm:p-container-padding">
      <div>
        <p className="font-label-caps text-label-caps uppercase text-on-surface-variant">{label}</p>
        <p className="mt-2 font-metric-lg text-metric-lg tabular-nums">{value}</p>
      </div>
      <span className="material-symbols-outlined notranslate rounded bg-primary-container/10 p-2 text-[24px] text-primary">{icon}</span>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded bg-surface-container-low p-2">
      <p className="font-label-muted text-[10px] text-on-surface-variant">{label}</p>
      <p className="mt-1 truncate font-body-sm text-body-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function ReactionRow({ label, icon, value, total }: { label: string; icon: string; value: number; total: number }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="flex items-center gap-1.5 font-body-sm text-body-sm text-on-surface-variant">
          <span className="material-symbols-outlined notranslate text-[16px]">{icon}</span>
          {label}
        </span>
        <span className="font-body-sm text-body-sm tabular-nums">{fmt(value)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded bg-surface-variant">
        <div className="h-full rounded bg-primary" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
