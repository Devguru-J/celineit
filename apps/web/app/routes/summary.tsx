import { Card, CardHeader, MediaPlaceholder, PlatformChip } from "~/components/ui";
import {
  brandHealth,
  followerBreakdown,
  recentChanges,
  summaryKpis,
} from "~/mock/data";

export function meta() {
  return [{ title: "Celine Intelligence · Summary" }];
}

const TIMELINE_ICON: Record<string, { icon: string; bg: string; fg: string }> = {
  new_ad: { icon: "rocket_launch", bg: "bg-primary-container/20", fg: "text-primary" },
  ad_inactive: { icon: "pause_circle", bg: "bg-error-container/20", fg: "text-error" },
  follower_spike: { icon: "trending_up", bg: "bg-emerald-50", fg: "text-emerald-600" },
};

export default function Summary() {
  return (
    <div className="p-container-padding space-y-card-gap">
      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-card-gap">
        {summaryKpis.map((k) => (
          <div
            key={k.label}
            className="bg-surface-container-lowest border border-outline-variant rounded p-container-padding flex flex-col justify-between hover:border-primary/50 hover:-translate-y-0.5 transition-all"
          >
            <div className="flex justify-between items-start">
              <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">{k.label}</span>
              <span className="material-symbols-outlined text-primary text-[20px]">{k.icon}</span>
            </div>
            <div className="mt-4">
              <h3 className="font-metric-lg text-metric-lg tabular-nums">{k.value}</h3>
              <div className="flex items-center gap-1 mt-1">
                <span
                  className={`font-label-muted text-label-muted px-1.5 rounded ${
                    k.up ? "bg-emerald-50 text-emerald-700" : "bg-error-container text-error"
                  }`}
                >
                  {k.delta}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-card-gap">
        {/* Recent changes timeline */}
        <Card className="lg:col-span-2 overflow-hidden">
          <CardHeader
            title="Recent Changes"
            action={<button className="text-primary font-label-caps text-label-caps hover:underline">View All</button>}
          />
          <div className="p-container-padding relative timeline-line">
            <div className="space-y-8">
              {recentChanges.map((c, i) => {
                const t = TIMELINE_ICON[c.kind];
                return (
                  <div key={i} className="relative z-10 flex gap-6">
                    <div className={`w-[40px] h-[40px] flex-shrink-0 rounded-full ${t.bg} flex items-center justify-center border-2 border-surface`}>
                      <span className={`material-symbols-outlined ${t.fg} text-[20px]`}>{t.icon}</span>
                    </div>
                    <div className="flex-1 pb-1">
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <p className="font-body-md text-body-md font-semibold">{c.title}</p>
                          <div className="flex items-center gap-2">
                            <PlatformChip platform={c.platform} />
                            <span className="font-label-muted text-label-muted text-on-surface-variant">{c.when}</span>
                          </div>
                        </div>
                        <button className="material-symbols-outlined text-on-surface-variant hover:text-primary">more_vert</button>
                      </div>
                      {c.copy && (
                        <div className="mt-3 p-3 bg-surface border border-outline-variant rounded-lg flex items-center gap-3">
                          <MediaPlaceholder seed={c.title} format="image" className="w-12 h-12 rounded flex-shrink-0" />
                          <p className="font-body-sm text-body-sm text-on-surface-variant line-clamp-1 italic">"{c.copy}"</p>
                        </div>
                      )}
                      {c.note && <p className="mt-2 font-body-sm text-body-sm text-on-surface-variant">{c.note}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>

        {/* Right column */}
        <div className="lg:col-span-1 space-y-card-gap">
          <Card className="p-container-padding">
            <div className="mb-6">
              <h3 className="font-headline-sm text-headline-sm">Total Follower Growth</h3>
              <p className="font-label-muted text-label-muted text-on-surface-variant">Consolidated cross-platform trend</p>
            </div>
            <div className="relative h-48 w-full flex items-end justify-between gap-1 group">
              {[60, 65, 75, 80, 85, 90, 70, 95].map((hP, i) => (
                <div key={i} className="w-full bg-primary/10 rounded-t-sm relative" style={{ height: `${hP}%` }}>
                  <div className="absolute bottom-0 w-full bg-primary rounded-t-sm" style={{ height: `${65 + ((i * 7) % 30)}%` }} />
                </div>
              ))}
            </div>
            <div className="mt-8 space-y-4">
              {followerBreakdown.map((f) => (
                <div key={f.platform} className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${f.dot}`} />
                    <span className="font-body-sm text-body-sm">{f.platform}</span>
                  </div>
                  <span className="font-body-md text-body-md font-semibold tabular-nums">{f.value}</span>
                </div>
              ))}
            </div>
            <div className="mt-6 pt-6 border-t border-outline-variant">
              <div className="p-3 bg-surface rounded-lg flex items-center justify-between">
                <div>
                  <p className="font-label-muted text-label-muted">Aggregated Delta</p>
                  <p className="font-metric-md text-metric-md text-emerald-600 font-bold">+18.4%</p>
                </div>
                <span className="material-symbols-outlined text-emerald-600 text-[32px]">show_chart</span>
              </div>
            </div>
          </Card>

          <div className="bg-primary p-container-padding rounded text-on-primary shadow-lg shadow-primary/20">
            <div className="flex items-center gap-2 mb-2">
              <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
              <span className="font-label-caps text-label-caps uppercase opacity-80">AI Insight</span>
            </div>
            <p className="font-body-md text-body-md leading-relaxed">
              "Competitors are shifting 15% more budget into short-form video formats this week. Consider prioritizing
              TikTok creative assets."
            </p>
            <button className="mt-4 w-full py-2 bg-white/10 hover:bg-white/20 transition-colors rounded font-body-sm text-body-sm font-semibold border border-white/20">
              Apply Strategy
            </button>
          </div>
        </div>
      </div>

      {/* Brand health table */}
      <Card>
        <CardHeader title="Monitored Brand Health" />
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface">
                {["Brand", "Sentiment", "Ad Spend Index", "Status"].map((h, i) => (
                  <th
                    key={h}
                    className={`px-container-padding py-3 font-label-caps text-label-caps text-on-surface-variant uppercase border-b border-outline-variant ${
                      i === 2 ? "text-right" : i === 3 ? "text-center" : ""
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {brandHealth.map((b) => (
                <tr key={b.brand} className="hover:bg-surface-dim/30 transition-colors">
                  <td className="px-container-padding py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-surface-variant border border-outline-variant" />
                      <span className="font-body-md text-body-md font-semibold">{b.brand}</span>
                    </div>
                  </td>
                  <td className="px-container-padding py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-surface-variant rounded-full overflow-hidden">
                        <div className={`h-full ${b.bar}`} style={{ width: `${b.sentimentPct}%` }} />
                      </div>
                      <span className="font-label-muted text-label-muted">{b.sentiment}</span>
                    </div>
                  </td>
                  <td className="px-container-padding py-4 text-right tabular-nums font-body-md">{b.spend}</td>
                  <td className="px-container-padding py-4 text-center">
                    <span className="px-2 py-1 rounded bg-emerald-50 text-emerald-700 font-label-caps text-[10px]">Active Tracking</span>
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
