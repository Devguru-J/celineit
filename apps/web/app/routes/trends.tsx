import { useState } from "react";
import { Card, CardHeader, LineChart, MediaPlaceholder, PlatformChip } from "~/components/ui";
import { engagementSeries, fmt, followerSeries, topPosts, trendAccount } from "~/mock/data";

export function meta() {
  return [{ title: "Celine Intelligence · Trends" }];
}

const RANGES = ["7d", "30d", "90d"] as const;

export default function Trends() {
  const [range, setRange] = useState<(typeof RANGES)[number]>("30d");
  const slice = range === "7d" ? -7 : range === "30d" ? -30 : -30;
  const followers = followerSeries.slice(slice);
  const engagement = engagementSeries.slice(slice);

  return (
    <div className="p-container-padding space-y-card-gap">
      {/* Account header */}
      <Card className="p-container-padding flex flex-wrap items-center gap-6">
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-700 to-amber-500" />
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-headline-sm text-headline-sm">{trendAccount.brand}</h3>
            <PlatformChip platform={trendAccount.platform} withIcon />
          </div>
          <p className="font-label-muted text-label-muted text-on-surface-variant">{trendAccount.handle}</p>
        </div>
        <div className="flex gap-8 ml-auto">
          <div>
            <p className="font-label-caps text-label-caps text-on-surface-variant uppercase">Followers</p>
            <p className="font-metric-lg text-metric-lg tabular-nums">{fmt(trendAccount.followers)}</p>
            <span className="font-label-muted text-label-muted text-emerald-600">{trendAccount.followersDelta}</span>
          </div>
          <div>
            <p className="font-label-caps text-label-caps text-on-surface-variant uppercase">30d Avg Engagement</p>
            <p className="font-metric-lg text-metric-lg tabular-nums">{trendAccount.engagementRate}%</p>
            <span className="font-label-muted text-label-muted text-emerald-600">{trendAccount.engagementDelta}</span>
          </div>
        </div>
      </Card>

      {/* Range selector */}
      <div className="flex gap-2">
        {RANGES.map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`px-4 py-1.5 rounded-full font-body-sm text-body-sm transition-colors ${
              range === r ? "bg-primary text-on-primary" : "bg-surface-container hover:bg-surface-container-high text-on-surface-variant"
            }`}
          >
            {r}
          </button>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-card-gap">
        <Card className="p-container-padding">
          <h3 className="font-headline-sm text-headline-sm mb-1">Daily Followers</h3>
          <p className="font-label-muted text-label-muted text-on-surface-variant mb-4">Net follower count per day</p>
          <LineChart data={followers} stroke="#3525cd" />
        </Card>
        <Card className="p-container-padding">
          <h3 className="font-headline-sm text-headline-sm mb-1">Engagement Rate</h3>
          <p className="font-label-muted text-label-muted text-on-surface-variant mb-4">Daily engagement rate (%)</p>
          <LineChart data={engagement} stroke="#565e74" />
        </Card>
      </div>

      {/* Top posts */}
      <Card>
        <CardHeader title="Best Performing Posts" />
        <div className="divide-y divide-outline-variant">
          {topPosts.map((p) => (
            <div key={p.id} className="flex items-center gap-4 px-container-padding py-3 hover:bg-surface-dim/30 transition-colors">
              <MediaPlaceholder seed={p.id + p.caption} format={p.format} className="w-12 h-12 rounded flex-shrink-0" />
              <p className="font-body-md text-body-md flex-1 truncate">{p.caption}</p>
              <div className="flex items-center gap-4 font-label-muted text-label-muted text-on-surface-variant tabular-nums">
                <span className="flex items-center gap-0.5"><span className="material-symbols-outlined text-[16px]">favorite</span>{fmt(p.likes)}</span>
                <span className="flex items-center gap-0.5"><span className="material-symbols-outlined text-[16px]">chat_bubble</span>{fmt(p.comments)}</span>
                {!!p.views && <span className="flex items-center gap-0.5"><span className="material-symbols-outlined text-[16px]">play_arrow</span>{fmt(p.views)}</span>}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
