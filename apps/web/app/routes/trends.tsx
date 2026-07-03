import { Link, useLoaderData } from "react-router";
import { Card, CardHeader, LineChart, MediaImage, PlatformChip } from "~/components/ui";
import { fmt } from "~/mock/data";
import { getTrends } from "~/lib/queries.server";

export function meta() {
  return [{ title: "Celine Intelligence · 트렌드" }];
}

export async function loader() {
  return { trends: await getTrends() };
}

export default function Trends() {
  const { trends } = useLoaderData<typeof loader>();

  if (!trends) {
    return (
      <div className="p-4 sm:p-container-padding">
        <Card className="p-12 text-center text-on-surface-variant">데이터가 없습니다.</Card>
      </div>
    );
  }

  const { account, followerSeries, topPosts } = trends;
  const hasFollowers = followerSeries.length >= 2 && followerSeries.some((p) => p.value > 0);

  return (
    <div className="space-y-card-gap p-4 sm:p-container-padding">
      <Card className="flex flex-wrap items-center gap-4 p-4 sm:gap-6 sm:p-container-padding">
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-700 to-fuchsia-500" />
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-headline-sm text-headline-sm">{account.brand}</h3>
            <PlatformChip platform={account.platform} withIcon />
          </div>
          <p className="font-label-muted text-label-muted text-on-surface-variant">{account.handle}</p>
        </div>
        <div className="grid w-full grid-cols-2 gap-4 sm:ml-auto sm:w-auto sm:flex sm:gap-8">
          <div>
            <p className="font-label-caps text-label-caps text-on-surface-variant uppercase">팔로워</p>
            <p className="font-metric-lg text-metric-lg tabular-nums">{account.followers ? fmt(account.followers) : "—"}</p>
          </div>
          <div>
            <p className="font-label-caps text-label-caps text-on-surface-variant uppercase">수집 게시물</p>
            <p className="font-metric-lg text-metric-lg tabular-nums">{topPosts.length}</p>
          </div>
        </div>
      </Card>

      <Card className="p-4 sm:p-container-padding">
        <h3 className="font-headline-sm text-headline-sm mb-1">일별 팔로워</h3>
        <p className="font-label-muted text-label-muted text-on-surface-variant mb-4">하루 단위 순 팔로워 수</p>
        {hasFollowers ? (
          <LineChart data={followerSeries} stroke="#3525cd" />
        ) : (
          <div className="h-40 flex flex-col items-center justify-center text-on-surface-variant gap-2">
            <span className="material-symbols-outlined notranslate text-[32px] opacity-40">show_chart</span>
            <p className="font-body-sm text-body-sm">팔로워 시계열은 매일 수집이 누적되면 그려집니다.</p>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title="성과 상위 게시물" />
        <div className="divide-y divide-outline-variant">
          {topPosts.map((p) => (
            <Link key={p.id} to={`/item/post/${p.id}`} className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-surface-dim/30 sm:items-center sm:gap-4 sm:px-container-padding">
              <MediaImage src={p.imageUrl} seed={p.id + (p.caption ?? "")} format={p.format} className="w-12 h-12 rounded flex-shrink-0" />
              <p className="font-body-md text-body-md flex-1 truncate">{p.caption}</p>
              <div className="hidden items-center gap-4 font-label-muted text-label-muted tabular-nums text-on-surface-variant sm:flex">
                <span className="flex items-center gap-0.5"><span className="material-symbols-outlined notranslate text-[16px]">favorite</span>{fmt(p.likes ?? 0)}</span>
                <span className="flex items-center gap-0.5"><span className="material-symbols-outlined notranslate text-[16px]">chat_bubble</span>{fmt(p.comments ?? 0)}</span>
                {!!p.views && <span className="flex items-center gap-0.5"><span className="material-symbols-outlined notranslate text-[16px]">play_arrow</span>{fmt(p.views)}</span>}
              </div>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
