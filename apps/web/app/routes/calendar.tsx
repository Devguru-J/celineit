import { useLoaderData } from "react-router";
import { Card, CardHeader } from "~/components/ui";
import { PLATFORM_META, type Platform } from "~/mock/data";
import { getCalendar } from "~/lib/queries.server";

export function meta() {
  return [{ title: "Celine Intelligence · 캘린더" }];
}

export async function loader() {
  return { days: await getCalendar() };
}

export default function Calendar() {
  const { days } = useLoaderData<typeof loader>();
  const maxCount = Math.max(1, ...days.map((d) => d.count));

  // 플랫폼별 게시 빈도
  const platformCounts = new Map<Platform, number>();
  for (const d of days) for (const p of d.platforms) platformCounts.set(p, (platformCounts.get(p) ?? 0) + 1);

  return (
    <div className="p-container-padding grid grid-cols-1 lg:grid-cols-3 gap-card-gap">
      <Card className="lg:col-span-2">
        <CardHeader title="게시 활동 (날짜별)" action={<span className="font-label-muted text-label-muted text-on-surface-variant">{days.length}일</span>} />
        <div className="p-container-padding space-y-2">
          {days.length === 0 && <p className="text-on-surface-variant font-body-md text-body-md">게시 날짜 데이터가 없습니다.</p>}
          {days.map((d) => (
            <div key={d.date} className="flex items-center gap-3">
              <span className="w-24 font-label-muted text-label-muted text-on-surface-variant tabular-nums">{d.date}</span>
              <div className="flex-1 h-6 bg-surface-container rounded overflow-hidden relative">
                <div className="h-full bg-primary/70 rounded" style={{ width: `${(d.count / maxCount) * 100}%` }} />
                <span className="absolute left-2 top-1/2 -translate-y-1/2 font-label-muted text-[11px] tabular-nums text-on-surface">
                  {d.count}건
                </span>
              </div>
              <div className="flex gap-1 w-20">
                {d.platforms.map((p) => (
                  <span key={p} className={`w-2 h-2 rounded-full ${PLATFORM_META[p].dot}`} title={PLATFORM_META[p].label} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-container-padding h-fit">
        <h3 className="font-headline-sm text-headline-sm mb-4">플랫폼별 게시 일수</h3>
        <div className="space-y-4">
          {[...platformCounts.entries()].length === 0 && (
            <p className="text-on-surface-variant font-body-sm text-body-sm">데이터 없음</p>
          )}
          {[...platformCounts.entries()].map(([p, n]) => (
            <div key={p} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${PLATFORM_META[p].dot}`} />
                <span className="font-body-sm text-body-sm">{PLATFORM_META[p].label}</span>
              </div>
              <span className="font-body-md text-body-md font-semibold tabular-nums">{n}일</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
