import { Card, CardHeader, MediaPlaceholder, PlatformChip } from "~/components/ui";
import { ads } from "~/mock/data";

export function meta() {
  return [{ title: "Celine Intelligence · 위닝 광고" }];
}

export default function WinningAds() {
  const ranked = [...ads].sort((a, b) => b.daysActive - a.daysActive);
  const maxDays = ranked[0]?.daysActive ?? 1;

  return (
    <div className="p-container-padding space-y-card-gap">
      <div className="p-container-padding rounded flex items-start gap-3 bg-primary text-on-primary shadow-lg shadow-primary/20">
        <span className="material-symbols-outlined">emoji_events</span>
        <div>
          <h3 className="font-headline-sm text-headline-sm">지속 기간 = 성과 신호</h3>
          <p className="font-body-sm text-body-sm opacity-90 mt-1">
            광고가 연속으로 활성 상태를 유지한 일수 기준으로 정렬했습니다. 오래 살아남은 광고일수록 경쟁사가 계속
            비용을 쓰는 크리에이티브, 즉 '먹히는' 광고일 가능성이 가장 높습니다.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader title="지속 일수 순위" action={<span className="font-label-muted text-label-muted text-on-surface-variant">광고 {ranked.length}개</span>} />
        <div className="divide-y divide-outline-variant">
          {ranked.map((a, idx) => (
            <div key={a.id} className="flex items-center gap-4 px-container-padding py-4 hover:bg-surface-dim/30 transition-colors">
              <span className="font-metric-md text-metric-md tabular-nums text-on-surface-variant w-8 text-center">{idx + 1}</span>
              <MediaPlaceholder seed={a.id + a.copy} format={a.format} className="w-16 h-16 rounded flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <PlatformChip platform={a.platform} withIcon />
                  <span className="font-label-muted text-label-muted text-on-surface-variant">{a.brand}</span>
                  <span className="font-label-muted text-label-muted text-on-surface-variant">· {a.landingDomain}</span>
                </div>
                <p className="font-body-md text-body-md font-semibold truncate">{a.copy}</p>
                {/* longevity timeline bar */}
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-1 h-2 bg-surface-variant rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${(a.daysActive / maxDays) * 100}%` }} />
                  </div>
                  <span className="font-label-muted text-label-muted text-on-surface-variant tabular-nums whitespace-nowrap">
                    {a.firstSeen} → {a.lastSeen}
                  </span>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="font-metric-md text-metric-md tabular-nums text-primary">{a.daysActive}<span className="text-body-sm text-on-surface-variant font-normal">일</span></div>
                <span className={`inline-block mt-1 px-2 py-0.5 rounded font-label-caps text-[10px] ${a.isActive ? "bg-emerald-50 text-emerald-700" : "bg-surface-variant text-on-surface-variant"}`}>
                  {a.isActive ? "활성" : "종료"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
