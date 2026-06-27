import { useLoaderData } from "react-router";
import { Card, CardHeader, PlatformChip } from "~/components/ui";
import { getSummary } from "~/lib/queries.server";

export function meta() {
  return [{ title: "Celine Intelligence · 요약" }];
}

export async function loader() {
  return await getSummary();
}

export default function Summary() {
  const { kpis, recent, brands } = useLoaderData<typeof loader>();
  const maxPosts = Math.max(1, ...brands.map((b) => b.postsCount));

  return (
    <div className="p-container-padding space-y-card-gap">
      {/* KPI 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-card-gap">
        {kpis.map((k) => (
          <div
            key={k.label}
            className="bg-surface-container-lowest border border-outline-variant rounded p-container-padding flex flex-col justify-between hover:border-primary/50 hover:-translate-y-0.5 transition-all"
          >
            <div className="flex justify-between items-start">
              <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">{k.label}</span>
              <span className="material-symbols-outlined text-primary text-[20px]">{k.icon}</span>
            </div>
            <h3 className="font-metric-lg text-metric-lg tabular-nums mt-4">{k.value}</h3>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-card-gap">
        {/* 최근 변경 (최신 게시물) */}
        <Card className="lg:col-span-2 overflow-hidden">
          <CardHeader title="최근 변경" />
          <div className="p-container-padding relative timeline-line">
            <div className="space-y-8">
              {recent.length === 0 && <p className="text-on-surface-variant font-body-md text-body-md">아직 데이터가 없습니다.</p>}
              {recent.map((c, i) => (
                <div key={i} className="relative z-10 flex gap-6">
                  <div className="w-[40px] h-[40px] flex-shrink-0 rounded-full bg-primary-container/20 flex items-center justify-center border-2 border-surface">
                    <span className="material-symbols-outlined text-primary text-[20px]">post_add</span>
                  </div>
                  <div className="flex-1 pb-1">
                    <p className="font-body-md text-body-md font-semibold line-clamp-1">{c.brand} · 신규 게시물 감지</p>
                    <div className="flex items-center gap-2 mt-1">
                      <PlatformChip platform={c.platform} />
                      <span className="font-label-muted text-label-muted text-on-surface-variant">{c.when}</span>
                    </div>
                    {c.caption && (
                      <p className="mt-2 font-body-sm text-body-sm text-on-surface-variant line-clamp-1 italic">"{c.caption}"</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* AI 인사이트 (예시) */}
        <div className="bg-primary p-container-padding rounded text-on-primary shadow-lg shadow-primary/20 h-fit">
          <div className="flex items-center gap-2 mb-2">
            <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
            <span className="font-label-caps text-label-caps uppercase opacity-80">AI 인사이트 (예시)</span>
          </div>
          <p className="font-body-md text-body-md leading-relaxed">
            "콘텐츠 자동 분류·유사 광고 클러스터링은 2차 단계에서 추가됩니다. 현재는 실수집 데이터(게시물·지표·미디어)를
            보여줍니다."
          </p>
        </div>
      </div>

      {/* 브랜드 현황 */}
      <Card>
        <CardHeader title="모니터링 브랜드 현황" />
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface">
                {["브랜드", "수집 게시물", "활성 광고", "상태"].map((h, i) => (
                  <th key={h} className={`px-container-padding py-3 font-label-caps text-label-caps text-on-surface-variant uppercase border-b border-outline-variant ${i >= 1 && i <= 2 ? "text-right" : i === 3 ? "text-center" : ""}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {brands.map((b) => (
                <tr key={b.id} className="hover:bg-surface-dim/30 transition-colors">
                  <td className="px-container-padding py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-8 rounded-full bg-primary" style={{ opacity: 0.3 + 0.7 * (b.postsCount / maxPosts) }} />
                      <span className="font-body-md text-body-md font-semibold">{b.name}</span>
                    </div>
                  </td>
                  <td className="px-container-padding py-4 text-right tabular-nums font-body-md">{b.postsCount}</td>
                  <td className="px-container-padding py-4 text-right tabular-nums font-body-md">{b.adsCount}</td>
                  <td className="px-container-padding py-4 text-center">
                    <span className={`px-2 py-1 rounded font-label-caps text-[10px] ${b.postsCount > 0 ? "bg-emerald-50 text-emerald-700" : "bg-surface-variant text-on-surface-variant"}`}>
                      {b.postsCount > 0 ? "추적 중" : "대기"}
                    </span>
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
