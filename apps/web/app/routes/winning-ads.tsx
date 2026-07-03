import { Link, useLoaderData } from "react-router";
import { Card, CardHeader, MediaImage, PlatformChip } from "~/components/ui";
import { getWinningAds } from "~/lib/queries.server";

export function meta() {
  return [{ title: "Celine Intelligence · 위닝 광고" }];
}

export async function loader() {
  return { ads: await getWinningAds() };
}

export default function WinningAds() {
  const { ads } = useLoaderData<typeof loader>();
  const maxDays = Math.max(1, ...ads.map((a) => a.daysActive));

  return (
    <div className="space-y-card-gap p-4 sm:p-container-padding">
      <div className="flex items-start gap-3 rounded bg-primary p-4 text-on-primary shadow-lg shadow-primary/20 sm:p-container-padding">
        <span className="material-symbols-outlined">emoji_events</span>
        <div>
          <h3 className="font-headline-sm text-headline-sm">지속 기간 = 성과 신호</h3>
          <p className="font-body-sm text-body-sm opacity-90 mt-1">
            광고가 연속으로 활성 상태를 유지한 일수 기준 정렬. 오래 살아남은 광고일수록 경쟁사가 계속 비용을 쓰는 '먹히는'
            광고입니다. 광고 데이터는 Meta 광고지면 수집 시 채워집니다.
          </p>
        </div>
      </div>

      {ads.length === 0 ? (
        <Card className="p-12 text-center text-on-surface-variant">
          <span className="material-symbols-outlined text-[40px] opacity-40">ad_units</span>
          <p className="mt-2 font-body-md text-body-md">아직 광고지면 데이터가 없습니다. Meta 광고 계정을 추가해 수집하면 표시됩니다.</p>
        </Card>
      ) : (
        <Card>
          <CardHeader title="지속 일수 순위" action={<span className="font-label-muted text-label-muted text-on-surface-variant">광고 {ads.length}개</span>} />
          <div className="divide-y divide-outline-variant">
            {ads.map((a, idx) => (
              <Link key={a.id} to={`/item/ad/${a.id}`} className="flex items-start gap-3 px-4 py-4 transition-colors hover:bg-surface-dim/30 sm:items-center sm:gap-4 sm:px-container-padding">
                <span className="w-6 shrink-0 text-center font-metric-md text-metric-md tabular-nums text-on-surface-variant sm:w-8">{idx + 1}</span>
                <MediaImage src={a.imageUrl} seed={a.id + (a.copy ?? "")} format={a.format} className="h-14 w-14 flex-shrink-0 rounded sm:h-16 sm:w-16" />
                <div className="flex-1 min-w-0">
                  <div className="mb-1 flex min-w-0 flex-wrap items-center gap-2">
                    <PlatformChip platform={a.platform} withIcon />
                    <span className="font-label-muted text-label-muted text-on-surface-variant">{a.brand}</span>
                    {a.landingDomain && <span className="font-label-muted text-label-muted text-on-surface-variant">· {a.landingDomain}</span>}
                  </div>
                  <p className="font-body-md text-body-md font-semibold truncate">{a.copy}</p>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                    <div className="flex-1 h-2 bg-surface-variant rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${(a.daysActive / maxDays) * 100}%` }} />
                    </div>
                    <span className="font-label-muted text-label-muted text-on-surface-variant tabular-nums whitespace-nowrap">
                      {a.firstSeen} → {a.lastSeen}
                    </span>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-metric-md text-metric-md tabular-nums text-primary">{a.daysActive}<span className="text-body-sm text-on-surface-variant font-normal">일</span></div>
                  <span className={`inline-block mt-1 px-2 py-0.5 rounded font-label-caps text-[10px] ${a.isActive ? "bg-emerald-50 text-emerald-700" : "bg-surface-variant text-on-surface-variant"}`}>
                    {a.isActive ? "활성" : "종료"}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
