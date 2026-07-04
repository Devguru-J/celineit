import { useEffect, useMemo, useState } from "react";
import { useLoaderData, useRevalidator } from "react-router";
import { Card, CardHeader, KpiDelta, PlatformChip } from "~/components/ui";
import { getRuns, getRunStats } from "~/lib/queries.server";

export function meta() {
  return [{ title: "Celine Intelligence · 수집 실행 현황" }];
}

export async function loader() {
  const [runs, summary] = await Promise.all([getRuns(), getRunStats()]);
  return { runs, summary };
}

const STATUS_STYLE: Record<string, { label: string; cls: string; dot: string }> = {
  done: { label: "완료", cls: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
  running: { label: "실행 중", cls: "bg-primary-container/15 text-primary", dot: "bg-primary animate-pulse" },
  error: { label: "오류", cls: "bg-error-container text-error", dot: "bg-error" },
};

export default function AdminRuns() {
  const { runs, summary } = useLoaderData<typeof loader>();
  const revalidator = useRevalidator();
  const [query, setQuery] = useState("");
  const [seconds, setSeconds] = useState(45);
  const cards = [
    { label: "오늘 수집 실행", value: String(summary.total), icon: "sync", tone: "text-primary", delta: summary.totalDelta, progress: Math.min(100, summary.total * 10) },
    { label: "성공률", value: `${summary.rate}%`, icon: "check_circle", tone: "text-emerald-600", delta: summary.rateDelta, progress: summary.rate },
    { label: "확인 필요한 실패", value: String(summary.fail), icon: "error", tone: "text-error", delta: summary.failDelta, progress: Math.min(100, summary.fail * 20) },
  ];
  const filteredRuns = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return runs;
    return runs.filter((r) =>
      [r.brand, r.platform, r.status, r.error ?? ""].some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [query, runs]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setSeconds((prev) => {
        if (prev <= 1) {
          revalidator.revalidate();
          return 45;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [revalidator]);

  return (
    <div className="space-y-card-gap p-4 sm:p-container-padding">
      <div className="grid grid-cols-1 gap-card-gap md:grid-cols-3">
        {cards.map((s) => (
          <Card key={s.label} className="surface-grid flex min-h-[132px] items-center justify-between p-4 sm:p-container-padding">
            <div className="min-w-0 flex-1">
              <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">{s.label}</span>
              <div className="mt-2 flex items-end gap-2">
                <p className={`font-metric-lg text-metric-lg tabular-nums ${s.tone}`}>{s.value}</p>
                <KpiDelta
                  dir={s.delta > 0 ? "up" : s.delta < 0 ? "down" : "flat"}
                  text={`${s.delta > 0 ? "+" : ""}${s.delta}${s.label === "성공률" ? "%p" : ""}`}
                />
              </div>
              <div className="mt-4 h-1.5 overflow-hidden rounded bg-surface-variant">
                <div className="h-full rounded bg-primary" style={{ width: `${s.progress}%` }} />
              </div>
            </div>
            <span className={`material-symbols-outlined notranslate rounded bg-surface-container-lowest/80 p-2 text-[32px] shadow-[inset_0_1px_0_rgba(255,255,255,0.82)] ${s.tone}`}>{s.icon}</span>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader
          title="최근 수집 실행"
          action={<span className="font-label-muted text-label-muted text-on-surface-variant">{seconds}초 후 새로고침</span>}
        />
        <div className="flex flex-col gap-3 border-b border-outline-variant/80 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-container-padding">
          <div className="relative w-full sm:max-w-sm">
            <span className="material-symbols-outlined notranslate absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-on-surface-variant">
              search
            </span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded border border-outline-variant/70 bg-surface-container-lowest py-2 pl-10 pr-3 font-body-sm text-body-sm focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="브랜드, 플랫폼, 오류 검색"
            />
          </div>
          <span className="font-label-muted text-label-muted text-on-surface-variant">표시 {filteredRuns.length}건 / 전체 {runs.length}건</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left">
            <thead>
              <tr className="bg-surface">
                {["브랜드", "플랫폼", "실행 시각", "상태", "수집 건수", "소요 시간"].map((h, i) => (
                  <th key={h} className={`border-b border-outline-variant/80 px-container-padding py-3 font-label-caps text-label-caps uppercase text-on-surface-variant ${i >= 4 ? "text-right" : ""}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/80">
              {filteredRuns.map((r) => {
                const s = STATUS_STYLE[r.status] ?? STATUS_STYLE.done;
                return (
                  <tr key={r.id} className={`hover:bg-surface-dim/30 transition-colors ${r.status === "error" ? "bg-error-container/20" : ""}`}>
                    <td className="px-container-padding py-3 font-body-md text-body-md font-semibold">{r.brand}</td>
                    <td className="px-container-padding py-3"><PlatformChip platform={r.platform} withIcon /></td>
                    <td className="px-container-padding py-3 font-body-sm text-body-sm tabular-nums text-on-surface-variant">{r.lastRun}</td>
                    <td className="px-container-padding py-3">
                      <span className={`inline-flex items-center gap-1.5 rounded px-2 py-1 font-label-caps text-[10px] ${s.cls}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                        {s.label}
                      </span>
                    </td>
                    <td className="px-container-padding py-3 text-right font-body-md text-body-md tabular-nums">{r.items || "—"}</td>
                    <td className="px-container-padding py-3 text-right font-body-sm text-body-sm tabular-nums text-on-surface-variant">{r.duration}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
