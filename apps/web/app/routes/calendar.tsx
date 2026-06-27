import { Card, CardHeader } from "~/components/ui";
import { cadenceStats, calendarCells, calendarMonth, formatMix, PLATFORM_META } from "~/mock/data";

export function meta() {
  return [{ title: "Celine Intelligence · Calendar" }];
}

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function intensity(v: number): string {
  if (v === 0) return "bg-surface-container";
  if (v <= 1) return "bg-primary/20";
  if (v <= 2) return "bg-primary/40";
  if (v <= 4) return "bg-primary/70";
  return "bg-primary";
}

export default function Calendar() {
  return (
    <div className="p-container-padding grid grid-cols-1 lg:grid-cols-3 gap-card-gap">
      {/* Calendar heatmap */}
      <Card className="lg:col-span-2">
        <CardHeader
          title={`Posting Volume · ${calendarMonth}`}
          action={
            <div className="flex items-center gap-1 font-label-muted text-label-muted text-on-surface-variant">
              Less
              <span className="w-3 h-3 rounded-sm bg-surface-container inline-block" />
              <span className="w-3 h-3 rounded-sm bg-primary/40 inline-block" />
              <span className="w-3 h-3 rounded-sm bg-primary/70 inline-block" />
              <span className="w-3 h-3 rounded-sm bg-primary inline-block" />
              More
            </div>
          }
        />
        <div className="p-container-padding">
          <div className="grid grid-cols-7 gap-2 mb-2">
            {DOW.map((d) => (
              <div key={d} className="text-center font-label-caps text-label-caps text-on-surface-variant uppercase">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {calendarCells.map((c, i) => (
              <div
                key={i}
                className={`aspect-square rounded-lg p-1.5 flex flex-col justify-between ${c.day === null ? "bg-transparent" : intensity(c.volume)} ${c.volume > 2 ? "text-on-primary" : "text-on-surface"}`}
                title={c.day ? `${c.volume} posts` : ""}
              >
                {c.day !== null && (
                  <>
                    <span className="font-label-muted text-[11px] tabular-nums">{c.day}</span>
                    <div className="flex gap-0.5 flex-wrap">
                      {c.platforms.map((p) => (
                        <span key={p} className={`w-1.5 h-1.5 rounded-full ${PLATFORM_META[p].dot}`} />
                      ))}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Side stats */}
      <div className="space-y-card-gap">
        <Card className="p-container-padding">
          <h3 className="font-headline-sm text-headline-sm mb-4">Posting Frequency</h3>
          <div className="space-y-4">
            {cadenceStats.map((s) => (
              <div key={s.platform} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${PLATFORM_META[s.platform].dot}`} />
                  <span className="font-body-sm text-body-sm">{PLATFORM_META[s.platform].label}</span>
                </div>
                <span className="font-body-md text-body-md font-semibold tabular-nums">{s.perWeek} <span className="text-on-surface-variant font-normal text-label-muted">/wk</span></span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-container-padding">
          <h3 className="font-headline-sm text-headline-sm mb-4">Format Mix</h3>
          <div className="flex h-3 rounded-full overflow-hidden mb-4">
            {formatMix.map((f) => (
              <div key={f.label} className={f.color} style={{ width: `${f.pct}%` }} />
            ))}
          </div>
          <div className="space-y-2">
            {formatMix.map((f) => (
              <div key={f.label} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${f.color}`} />
                  <span className="font-body-sm text-body-sm">{f.label}</span>
                </div>
                <span className="font-body-sm text-body-sm tabular-nums text-on-surface-variant">{f.pct}%</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
