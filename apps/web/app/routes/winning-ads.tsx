import { Card, CardHeader, MediaPlaceholder, PlatformChip } from "~/components/ui";
import { ads } from "~/mock/data";

export function meta() {
  return [{ title: "Celine Intelligence · Winning Ads" }];
}

export default function WinningAds() {
  const ranked = [...ads].sort((a, b) => b.daysActive - a.daysActive);
  const maxDays = ranked[0]?.daysActive ?? 1;

  return (
    <div className="p-container-padding space-y-card-gap">
      <div className="p-container-padding rounded flex items-start gap-3 bg-primary text-on-primary shadow-lg shadow-primary/20">
        <span className="material-symbols-outlined">emoji_events</span>
        <div>
          <h3 className="font-headline-sm text-headline-sm">Longevity = performance signal</h3>
          <p className="font-body-sm text-body-sm opacity-90 mt-1">
            Ads ranked by how many days they have stayed continuously active. Long-runners are the creatives
            competitors keep paying for — the strongest proxy for what's working.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader title="Ranked by Days Active" action={<span className="font-label-muted text-label-muted text-on-surface-variant">{ranked.length} ads</span>} />
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
                <div className="font-metric-md text-metric-md tabular-nums text-primary">{a.daysActive}<span className="text-body-sm text-on-surface-variant font-normal">d</span></div>
                <span className={`inline-block mt-1 px-2 py-0.5 rounded font-label-caps text-[10px] ${a.isActive ? "bg-emerald-50 text-emerald-700" : "bg-surface-variant text-on-surface-variant"}`}>
                  {a.isActive ? "Active" : "Ended"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
