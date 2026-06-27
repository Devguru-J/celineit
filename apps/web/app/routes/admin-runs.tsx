import { Card, CardHeader, PlatformChip } from "~/components/ui";
import { runs, runSummary, type RunStatus } from "~/mock/data";

export function meta() {
  return [{ title: "Celine Intelligence · Collection Runs" }];
}

const STATUS_STYLE: Record<RunStatus, { label: string; cls: string; dot: string }> = {
  done: { label: "Done", cls: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
  running: { label: "Running", cls: "bg-primary-container/15 text-primary", dot: "bg-primary animate-pulse" },
  error: { label: "Error", cls: "bg-error-container text-error", dot: "bg-error" },
};

const TONE: Record<string, string> = {
  primary: "text-primary",
  emerald: "text-emerald-600",
  error: "text-error",
};

export default function AdminRuns() {
  return (
    <div className="p-container-padding space-y-card-gap">
      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-card-gap">
        {runSummary.map((s) => (
          <Card key={s.label} className="p-container-padding flex items-center justify-between">
            <div>
              <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">{s.label}</span>
              <p className={`font-metric-lg text-metric-lg tabular-nums mt-2 ${TONE[s.tone]}`}>{s.value}</p>
            </div>
            <span className={`material-symbols-outlined text-[32px] ${TONE[s.tone]}`}>{s.icon}</span>
          </Card>
        ))}
      </div>

      {/* Runs table */}
      <Card>
        <CardHeader
          title="Today's Collection Runs"
          action={<button className="text-primary font-label-caps text-label-caps hover:underline flex items-center gap-1"><span className="material-symbols-outlined text-[16px]">refresh</span>Refresh</button>}
        />
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface">
                {["Brand", "Platform", "Last Run", "Status", "Items", "Duration"].map((h, i) => (
                  <th key={h} className={`px-container-padding py-3 font-label-caps text-label-caps text-on-surface-variant uppercase border-b border-outline-variant ${i >= 4 ? "text-right" : ""}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {runs.map((r) => {
                const s = STATUS_STYLE[r.status];
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
