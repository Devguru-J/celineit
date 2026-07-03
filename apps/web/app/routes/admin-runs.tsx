import { useLoaderData } from "react-router";
import { Card, CardHeader, PlatformChip } from "~/components/ui";
import { getRuns } from "~/lib/queries.server";

export function meta() {
  return [{ title: "Celine Intelligence · 수집 실행 현황" }];
}

export async function loader() {
  const runs = await getRuns();
  const today = runs.filter((r) => true);
  const ok = runs.filter((r) => r.status === "done").length;
  const fail = runs.filter((r) => r.status === "error").length;
  const rate = runs.length ? Math.round((ok / runs.length) * 1000) / 10 : 0;
  return { runs, summary: { total: runs.length, rate, fail } };
}

const STATUS_STYLE: Record<string, { label: string; cls: string; dot: string }> = {
  done: { label: "완료", cls: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
  running: { label: "실행 중", cls: "bg-primary-container/15 text-primary", dot: "bg-primary animate-pulse" },
  error: { label: "오류", cls: "bg-error-container text-error", dot: "bg-error" },
};

export default function AdminRuns() {
  const { runs, summary } = useLoaderData<typeof loader>();
  const cards = [
    { label: "수집 실행", value: String(summary.total), icon: "sync", tone: "text-primary" },
    { label: "성공률", value: `${summary.rate}%`, icon: "check_circle", tone: "text-emerald-600" },
    { label: "확인 필요한 실패", value: String(summary.fail), icon: "error", tone: "text-error" },
  ];

  return (
    <div className="space-y-card-gap p-4 sm:p-container-padding">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-card-gap">
        {cards.map((s) => (
          <Card key={s.label} className="flex items-center justify-between p-4 sm:p-container-padding">
            <div>
              <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">{s.label}</span>
              <p className={`font-metric-lg text-metric-lg tabular-nums mt-2 ${s.tone}`}>{s.value}</p>
            </div>
            <span className={`material-symbols-outlined text-[32px] ${s.tone}`}>{s.icon}</span>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader title="최근 수집 실행" />
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface">
                {["브랜드", "플랫폼", "실행 시각", "상태", "수집 건수", "소요 시간"].map((h, i) => (
                  <th key={h} className={`px-container-padding py-3 font-label-caps text-label-caps text-on-surface-variant uppercase border-b border-outline-variant ${i >= 4 ? "text-right" : ""}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {runs.map((r) => {
                const s = STATUS_STYLE[r.status] ?? STATUS_STYLE.done;
                return (
                  <tr key={r.id} className={`hover:bg-surface-dim/30 transition-colors ${r.status === "error" ? "bg-error-container/20" : ""}`}>
                    <td className="px-container-padding py-3 font-body-md text-body-md font-semibold">{r.brand}</td>
                    <td className="px-container-padding py-3"><PlatformChip platform={r.platform} withIcon /></td>
                    <td className="px-container-padding py-3 font-body-sm text-body-sm tabular-nums text-on-surface-variant">{r.lastRun}</td>
                    <td className="px-container-padding py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded font-label-caps text-[10px] ${s.cls}`}>
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
