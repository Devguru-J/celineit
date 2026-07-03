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
    <div className="max-w-[1100px] space-y-card-gap p-4 sm:p-container-padding">
      <Link to="/feed" className="inline-flex items-center gap-1 text-on-surface-variant hover:text-primary font-body-sm text-body-sm">
        <span className="material-symbols-outlined notranslate text-[18px]">arrow_back</span> 피드로
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
          <Card className="p-4 sm:p-container-padding">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <PlatformChip platform={detail.platform} withIcon />
              <span className="font-body-md text-body-md font-semibold">{detail.brand}</span>
              <span className="font-label-muted text-label-muted text-on-surface-variant">{detail.handle}</span>
              <span className={`ml-auto px-2 py-0.5 rounded font-label-muted text-[10px] font-bold ${detail.kind === "ad" ? "bg-primary-container/15 text-primary" : "bg-surface-variant text-on-surface-variant"}`}>
                {detail.kind === "ad" ? "광고" : "게시물"}
              </span>
            </div>
            <p className="font-body-md text-body-md whitespace-pre-line">{detail.title}</p>
            <div className="mt-4 flex flex-col gap-2 border-t border-outline-variant pt-4 font-label-muted text-label-muted text-on-surface-variant sm:flex-row sm:items-center sm:gap-4">
              <span>게시일 {detail.date ?? "—"}</span>
              {detail.permalink && (
                <a href={detail.permalink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline ml-auto">
                  원본 보기 <span className="material-symbols-outlined notranslate text-[16px]">open_in_new</span>
                </a>
              )}
            </div>
          </Card>

          {/* 현재 지표 */}
          {latest && (
            <Card className="p-4 sm:p-container-padding">
              <h3 className="font-headline-sm text-headline-sm mb-3">현재 지표</h3>
              <div className="grid grid-cols-3 gap-2 sm:gap-4">
                <Metric icon="favorite" label="좋아요" value={latest.likes} />
                <Metric icon="chat_bubble" label="댓글" value={latest.comments} />
                <Metric icon="play_arrow" label="조회수" value={latest.views} />
              </div>
            </Card>
          )}

          {/* 댓글 키워드 (게시물만) */}
          {detail.commentKeywords && (
            <Card className="p-4 sm:p-container-padding">
              <h3 className="font-headline-sm text-headline-sm mb-1">댓글 키워드</h3>
              <p className="font-label-muted text-label-muted text-on-surface-variant mb-3">
                수집 댓글 {fmt(detail.commentKeywords.totalComments)}건 기준
              </p>

              {detail.commentKeywords.top.length > 0 && (
                <div className="mb-4">
                  <span className="font-label-muted text-label-muted text-on-surface-variant">최다 등장 Top 10</span>
                  <div className="mt-2 space-y-1.5">
                    {detail.commentKeywords.top.map((k) => {
                      const maxCount = detail.commentKeywords!.top[0].count || 1;
                      return (
                        <div key={k.keyword} className="flex items-center gap-2">
                          <span className="font-body-sm text-body-sm w-24 shrink-0 truncate">{k.keyword}</span>
                          <div className="flex-1 h-2 rounded bg-surface-variant overflow-hidden">
                            <div className="h-full bg-primary rounded" style={{ width: `${(k.count / maxCount) * 100}%` }} />
                          </div>
                          <span className="font-label-muted text-label-muted text-on-surface-variant w-8 text-right">{k.count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <span className="font-label-muted text-label-muted text-on-surface-variant">집중 키워드 언급</span>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {detail.commentKeywords.focus.map((k) => (
                    <span
                      key={k.keyword}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-label-muted text-[11px] font-medium ${
                        k.count > 0 ? "bg-primary-container/15 text-primary" : "bg-surface-variant text-on-surface-variant"
                      }`}
                    >
                      {k.keyword}
                      <b>{k.count}</b>
                    </span>
                  ))}
                </div>
              </div>
            </Card>
          )}

          {/* 광고 longevity */}
          {detail.ad && (
            <Card className="p-4 sm:p-container-padding">
              <h3 className="font-headline-sm text-headline-sm mb-3">광고 지속 현황</h3>
              <div className="grid grid-cols-1 gap-3 font-body-sm text-body-sm sm:grid-cols-2">
                <Row k="활성 일수" v={`${detail.ad.daysActive}일`} />
                <Row k="상태" v={detail.ad.isActive ? "활성" : "종료"} />
                <Row k="최초 관측" v={detail.ad.firstSeen} />
                <Row k="최근 관측" v={detail.ad.lastSeen} />
                {detail.ad.scheduledStart && <Row k="게재 시작" v={detail.ad.scheduledStart} />}
                {detail.ad.scheduledEnd && <Row k="게재 종료" v={detail.ad.scheduledEnd} />}
                {detail.ad.landingDomain && <Row k="랜딩 도메인" v={detail.ad.landingDomain} />}
              </div>
            </Card>
          )}

          {/* 광고 인텔리전스 (Ad Library raw 기반 유효 지표) */}
          {detail.ad && (
            <Card className="p-4 sm:p-container-padding">
              <h3 className="font-headline-sm text-headline-sm mb-3">광고 인텔리전스</h3>
              {detail.ad.platforms.length > 0 && (
                <div className="mb-3">
                  <span className="font-label-muted text-label-muted text-on-surface-variant">노출 지면</span>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {detail.ad.platforms.map((p) => (
                      <span key={p} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-surface-variant font-label-muted text-[11px] font-medium">
                        <span className="material-symbols-outlined notranslate text-[14px]">{platformIcon(p)}</span>
                        {platformLabel(p)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 gap-3 font-body-sm text-body-sm sm:grid-cols-2">
                {detail.ad.displayFormat && <Row k="광고 포맷" v={formatLabel(detail.ad.displayFormat)} />}
                {detail.ad.cta && <Row k="행동유도(CTA)" v={detail.ad.cta} />}
                {detail.ad.variantCount && <Row k="변형 수" v={`${detail.ad.variantCount}개`} />}
                {detail.ad.creativeCount && <Row k="크리에이티브" v={`${detail.ad.creativeCount}개`} />}
                {detail.ad.pageLikeCount && <Row k="페이지 좋아요" v={fmt(detail.ad.pageLikeCount)} />}
                {detail.ad.pageCategories.length > 0 && <Row k="카테고리" v={detail.ad.pageCategories.join(", ")} />}
              </div>
              <p className="mt-3 pt-3 border-t border-outline-variant font-label-muted text-[11px] text-on-surface-variant leading-relaxed">
                <span className="material-symbols-outlined notranslate text-[13px] align-middle mr-0.5">info</span>
                노출수·지출·CTR 은 Meta 가 상업광고에 대해 비공개합니다. 광고 <b>지속일수</b>가 성과 대리지표이며, 오래·여러 변형으로 게재될수록 효과가 좋다는 신호입니다.
              </p>
            </Card>
          )}
        </div>
      </div>

      {/* 지표 변화 추이 (시간에 따라 어떻게 바뀌었는지) */}
      {detail.metricsHistory.length >= 2 ? (
        <Card className="p-4 sm:p-container-padding">
          <h3 className="font-headline-sm text-headline-sm mb-1">지표 변화 추이</h3>
          <p className="font-label-muted text-label-muted text-on-surface-variant mb-4">일별 좋아요 추이</p>
          <LineChart data={detail.metricsHistory.map((m) => ({ value: m.likes ?? 0 }))} stroke="#3525cd" />
        </Card>
      ) : (
        <Card className="p-4 font-body-sm text-body-sm text-on-surface-variant sm:p-container-padding">
          <span className="material-symbols-outlined notranslate text-[18px] align-middle mr-1">history</span>
          변화 추이는 매일 수집이 누적되면 그려집니다 (현재 스냅샷 {detail.metricsHistory.length || 1}개).
        </Card>
      )}

      {/* 유사 콘텐츠 */}
      {similar.length > 0 && (
        <Card>
          <CardHeader title="같은 브랜드의 다른 콘텐츠" action={<span className="font-label-muted text-label-muted text-on-surface-variant">유사 광고 클러스터링은 2차 단계</span>} />
          <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 sm:p-container-padding lg:grid-cols-6">
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
        <span className="material-symbols-outlined notranslate text-[16px]">{icon}</span>
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

function platformLabel(p: string): string {
  const m: Record<string, string> = {
    FACEBOOK: "Facebook",
    INSTAGRAM: "Instagram",
    MESSENGER: "Messenger",
    AUDIENCE_NETWORK: "Audience Network",
    THREADS: "Threads",
  };
  return m[p.toUpperCase()] ?? p;
}

function platformIcon(p: string): string {
  const m: Record<string, string> = {
    FACEBOOK: "groups",
    INSTAGRAM: "photo_camera",
    MESSENGER: "chat",
    AUDIENCE_NETWORK: "ad_units",
    THREADS: "tag",
  };
  return m[p.toUpperCase()] ?? "campaign";
}

function formatLabel(f: string): string {
  const m: Record<string, string> = {
    DCO: "동적 크리에이티브(DCO)",
    DPA: "다이내믹 상품광고",
    CAROUSEL: "캐러셀",
    VIDEO: "동영상",
    IMAGE: "이미지",
  };
  return m[f.toUpperCase()] ?? f;
}
