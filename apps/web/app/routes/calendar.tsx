import { useLoaderData } from "react-router";
import { Card, CardHeader } from "~/components/ui";
import { PLATFORM_META } from "~/mock/data";
import { getCalendar } from "~/lib/queries.server";

export function meta() {
  return [{ title: "Celine Intelligence · 캘린더" }];
}

export async function loader() {
  return { calendar: await getCalendar() };
}

export default function Calendar() {
  const { calendar } = useLoaderData<typeof loader>();
  const { days, formatMix, weeklyFrequency, kpis } = calendar;
  const maxCount = Math.max(1, ...days.map((d) => d.count));
  const monthKey = calendar.monthKey;
  const monthDays = days.filter((d) => d.date.startsWith(monthKey));
  const monthCount = monthDays.reduce((sum, d) => sum + d.count, 0);
  const daysByDate = new Map(days.map((d) => [d.date, d]));
  const cells = buildMonthCells(monthKey);

  return (
    <div className="grid grid-cols-1 gap-card-gap p-4 sm:p-container-padding lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader
          title="게시 활동 캘린더"
          action={<span className="font-label-muted text-label-muted text-on-surface-variant">{monthKey} · {monthCount}건</span>}
        />
        <div className="p-4 sm:p-container-padding">
          {days.length === 0 && <p className="text-on-surface-variant font-body-md text-body-md">게시 날짜 데이터가 없습니다.</p>}
          {days.length > 0 && (
            <>
              <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                {["월", "화", "수", "목", "금", "토", "일"].map((w) => (
                  <div key={w} className="pb-1 text-center font-label-muted text-[11px] text-on-surface-variant">
                    {w}
                  </div>
                ))}
                {cells.map((c) => {
                  const d = c.date ? daysByDate.get(c.date) : undefined;
                  const intensity = d ? Math.max(0.16, d.count / maxCount) : 0;
                  return (
                    <div
                      key={c.key}
                      className={`min-h-[68px] rounded border p-2 transition-colors sm:min-h-[86px] ${
                        c.inMonth
                          ? "border-outline-variant/70 bg-surface-container-lowest hover:border-primary/50"
                          : "border-transparent bg-transparent"
                      }`}
                    >
                      {c.date && (
                        <>
                          <div className="flex items-center justify-between">
                            <span className={`font-label-muted text-[11px] tabular-nums ${d ? "text-on-surface" : "text-on-surface-variant/50"}`}>
                              {Number(c.date.slice(8))}
                            </span>
                            {!!d && <span className="font-label-muted text-[10px] text-primary tabular-nums">{d.count}</span>}
                          </div>
                          <div
                            className="mt-2 h-7 rounded bg-primary"
                            style={{ opacity: d ? 0.08 + intensity * 0.58 : 0.04 }}
                          />
                          {!!d && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {d.platforms.slice(0, 4).map((p) => (
                                <span key={p} className={`h-1.5 w-1.5 rounded-full ${PLATFORM_META[p].dot}`} title={PLATFORM_META[p].label} />
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 flex items-center justify-end gap-2">
                <span className="font-label-muted text-[11px] text-on-surface-variant">Less</span>
                {[0.12, 0.28, 0.44, 0.6].map((opacity) => (
                  <span key={opacity} className="h-3 w-5 rounded bg-primary" style={{ opacity }} />
                ))}
                <span className="font-label-muted text-[11px] text-on-surface-variant">More</span>
              </div>
            </>
          )}
        </div>
      </Card>

      <div className="space-y-card-gap">
        <Card className="h-fit p-4 sm:p-container-padding">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">Format mix</span>
              <h3 className="mt-1 font-headline-sm text-headline-sm">콘텐츠 포맷 믹스</h3>
            </div>
          </div>
          <div className="space-y-4">
            {formatMix.length === 0 && <p className="font-body-sm text-body-sm text-on-surface-variant">데이터 없음</p>}
            {formatMix.map((f) => (
              <div key={f.format}>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="font-body-sm text-body-sm">{formatLabel(f.format)}</span>
                  <span className="font-body-sm text-body-sm tabular-nums text-on-surface-variant">{f.pct}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded bg-surface-variant">
                  <div className="h-full rounded bg-primary" style={{ width: `${f.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="h-fit p-4 sm:p-container-padding">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">Activity mix</span>
            <h3 className="mt-1 font-headline-sm text-headline-sm">주간 게시 빈도</h3>
          </div>
          <span className="rounded bg-primary-container/10 px-2 py-1 font-label-muted text-[11px] text-primary">{days.length}일</span>
        </div>
        <div className="space-y-4">
          {weeklyFrequency.length === 0 && (
            <p className="text-on-surface-variant font-body-sm text-body-sm">데이터 없음</p>
          )}
          {weeklyFrequency.map((f) => (
            <div key={f.platform}>
              <div className="mb-1.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${PLATFORM_META[f.platform].dot}`} />
                  <span className="font-body-sm text-body-sm">{PLATFORM_META[f.platform].label}</span>
                </div>
                <span className="font-body-md text-body-md font-semibold tabular-nums">{f.postsPerWeek}/wk</span>
              </div>
              <div className="h-2 overflow-hidden rounded bg-surface-variant">
                <div className="h-full rounded bg-primary" style={{ width: `${(f.postsPerWeek / Math.max(1, weeklyFrequency[0]?.postsPerWeek ?? 1)) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </Card>
      </div>

      <div className="grid grid-cols-1 gap-card-gap lg:col-span-3 sm:grid-cols-3">
        <CalendarKpi label="이번 달 게시" value={`${kpis.totalMTD}건`} icon="calendar_today" />
        <CalendarKpi label="일평균 케이던스" value={`${kpis.avgDailyCadence}/day`} icon="speed" />
        <CalendarKpi label="피크 시간" value={kpis.peakHour ?? "—"} icon="schedule" />
      </div>

      <Card className="lg:col-span-3 p-4 sm:p-container-padding">
        <div className="flex items-start gap-3">
          <span className="material-symbols-outlined notranslate rounded bg-primary-container/10 p-2 text-primary">lightbulb</span>
          <div>
            <h3 className="font-headline-sm text-headline-sm">최적화 팁</h3>
            <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">{kpis.optimizationTip}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}

function buildMonthCells(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  const first = new Date(Date.UTC(year, month - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const leading = (first.getUTCDay() + 6) % 7;
  const total = Math.ceil((leading + daysInMonth) / 7) * 7;

  return Array.from({ length: total }, (_, idx) => {
    const day = idx - leading + 1;
    const inMonth = day >= 1 && day <= daysInMonth;
    const date = inMonth ? `${monthKey}-${String(day).padStart(2, "0")}` : null;
    return { key: `${monthKey}-${idx}`, date, inMonth };
  });
}

function formatLabel(format: string) {
  const labels: Record<string, string> = {
    image: "이미지",
    video: "영상",
    carousel: "캐러셀",
    unknown: "미분류",
  };
  return labels[format] ?? format;
}

function CalendarKpi({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <Card className="flex items-center justify-between p-4 sm:p-container-padding">
      <div>
        <p className="font-label-caps text-label-caps uppercase text-on-surface-variant">{label}</p>
        <p className="mt-2 font-metric-md text-metric-md tabular-nums">{value}</p>
      </div>
      <span className="material-symbols-outlined notranslate rounded bg-primary-container/10 p-2 text-[24px] text-primary">{icon}</span>
    </Card>
  );
}
