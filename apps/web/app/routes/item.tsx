import { Link, useLoaderData } from "react-router";
import { Card, CardHeader, LineChart, MediaImage, MediaVideo, PlatformChip } from "~/components/ui";
import { fmt } from "~/mock/data";
import { getItemDetail, getSimilarPosts } from "~/lib/queries.server";

export function meta() {
  return [{ title: "Celine Intelligence · 상세" }];
}

export async function loader({ params }: { params: { kind: string; id: string } }) {
  const kind = params.kind === "ad" ? "ad" : "post";
  const detail = await getItemDetail(kind, params.id);
  if (!detail) throw new Response("Not Found", { status: 404 });
  const similar = kind === "post" ? await getSimilarPosts(params.id) : [];
  return { detail, similar };
}

export default function ItemDetail() {
  const { detail, similar } = useLoaderData<typeof loader>();
  const latest = detail.metricsHistory.at(-1);

  return (
    <div className="p-container-padding space-y-card-gap max-w-[1100px]">
      <Link to="/feed" className="inline-flex items-center gap-1 text-on-surface-variant hover:text-primary font-body-sm text-body-sm">
        <span className="material-symbols-outlined text-[18px]">arrow_back</span> 피드로
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-card-gap">
        {/* 미디어 갤러리 */}
        <Card className="overflow-hidden">
          {(() => {
            const cover = detail.media.find((m) => m.kind !== "video")?.url ?? null;
            const videos = detail.media.filter((m) => m.kind === "video");
            const images = detail.media.filter((m) => m.kind !== "video");
            if (detail.media.length === 0) {
              return <MediaImage src={null} seed={detail.title ?? "x"} format={detail.format} className="w-full aspect-square" />;
            }
            return (
              <div className="grid grid-cols-1 gap-1">
                {videos.map((m, i) => (
                  <MediaVideo key={`v${i}`} src={m.url} poster={cover} className="w-full aspect-square" />
                ))}
                {/* 영상이 있으면 커버는 영상 poster 로 쓰이므로 이미지 갤러리는 영상 없을 때만 */}
                {videos.length === 0 &&
                  images.slice(0, 4).map((m, i) => (
                    <MediaImage key={`i${i}`} src={m.url} seed={detail.title ?? String(i)} format="image" className="w-full aspect-square" />
                  ))}
              </div>
            );
          })()}
        </Card>

        {/* 정보 */}
        <div className="space-y-card-gap">
          <Card className="p-container-padding">
            <div className="flex items-center gap-2 mb-3">
              <PlatformChip platform={detail.platform} withIcon />
              <span className="font-body-md text-body-md font-semibold">{detail.brand}</span>
              <span className="font-label-muted text-label-muted text-on-surface-variant">{detail.handle}</span>
              <span className={`ml-auto px-2 py-0.5 rounded font-label-muted text-[10px] font-bold ${detail.kind === "ad" ? "bg-primary-container/15 text-primary" : "bg-surface-variant text-on-surface-variant"}`}>
                {detail.kind === "ad" ? "광고" : "게시물"}
              </span>
            </div>
            <p className="font-body-md text-body-md whitespace-pre-line">{detail.title}</p>
            <div className="flex items-center gap-4 mt-4 pt-4 border-t border-outline-variant font-label-muted text-label-muted text-on-surface-variant">
              <span>게시일 {detail.date ?? "—"}</span>
              {detail.permalink && (
                <a href={detail.permalink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline ml-auto">
                  원본 보기 <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                </a>
              )}
            </div>
          </Card>

          {/* 현재 지표 */}
          {latest && (
            <Card className="p-container-padding">
              <h3 className="font-headline-sm text-headline-sm mb-3">현재 지표</h3>
              <div className="grid grid-cols-3 gap-4">
                <Metric icon="favorite" label="좋아요" value={latest.likes} />
                <Metric icon="chat_bubble" label="댓글" value={latest.comments} />
                <Metric icon="play_arrow" label="조회수" value={latest.views} />
              </div>
            </Card>
          )}

          {/* 광고 longevity */}
          {detail.ad && (
            <Card className="p-container-padding">
              <h3 className="font-headline-sm text-headline-sm mb-3">광고 지속 현황</h3>
              <div className="grid grid-cols-2 gap-3 font-body-sm text-body-sm">
                <Row k="활성 일수" v={`${detail.ad.daysActive}일`} />
                <Row k="상태" v={detail.ad.isActive ? "활성" : "종료"} />
                <Row k="최초 관측" v={detail.ad.firstSeen} />
                <Row k="최근 관측" v={detail.ad.lastSeen} />
                {detail.ad.landingDomain && <Row k="랜딩 도메인" v={detail.ad.landingDomain} />}
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* 지표 변화 추이 (시간에 따라 어떻게 바뀌었는지) */}
      {detail.metricsHistory.length >= 2 ? (
        <Card className="p-container-padding">
          <h3 className="font-headline-sm text-headline-sm mb-1">지표 변화 추이</h3>
          <p className="font-label-muted text-label-muted text-on-surface-variant mb-4">일별 좋아요 추이</p>
          <LineChart data={detail.metricsHistory.map((m) => ({ value: m.likes ?? 0 }))} stroke="#3525cd" />
        </Card>
      ) : (
        <Card className="p-container-padding text-on-surface-variant font-body-sm text-body-sm">
          <span className="material-symbols-outlined text-[18px] align-middle mr-1">history</span>
          변화 추이는 매일 수집이 누적되면 그려집니다 (현재 스냅샷 {detail.metricsHistory.length || 1}개).
        </Card>
      )}

      {/* 유사 콘텐츠 */}
      {similar.length > 0 && (
        <Card>
          <CardHeader title="같은 브랜드의 다른 콘텐츠" action={<span className="font-label-muted text-label-muted text-on-surface-variant">유사 광고 클러스터링은 2차 단계</span>} />
          <div className="p-container-padding grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {similar.map((s) => (
              <Link key={s.id} to={`/item/post/${s.id}`} className="block group">
                <MediaImage src={s.imageUrl} seed={s.id + (s.caption ?? "")} format={s.format} className="w-full aspect-square rounded group-hover:opacity-80 transition-opacity" />
                <p className="mt-1 font-label-muted text-[11px] line-clamp-1 text-on-surface-variant">{s.caption}</p>
              </Link>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function Metric({ icon, label, value }: { icon: string; label: string; value: number | null | undefined }) {
  return (
    <div>
      <div className="flex items-center gap-1 text-on-surface-variant">
        <span className="material-symbols-outlined text-[16px]">{icon}</span>
        <span className="font-label-muted text-label-muted">{label}</span>
      </div>
      <p className="font-metric-md text-metric-md tabular-nums mt-1">{value != null ? fmt(value) : "—"}</p>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string | null }) {
  return (
    <div className="flex justify-between border-b border-outline-variant py-1">
      <span className="text-on-surface-variant">{k}</span>
      <span className="font-medium tabular-nums">{v ?? "—"}</span>
    </div>
  );
}
