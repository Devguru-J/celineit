import { useMemo, useState } from "react";
import { useLoaderData } from "react-router";
import { Card } from "~/components/ui";
import { FeedGrid } from "~/components/feed-card";
import { PLATFORM_META, type Platform } from "~/mock/data";
import { getFeed } from "~/lib/queries.server";

export function meta() {
  return [{ title: "Celine Intelligence · 통합 피드" }];
}

export async function loader() {
  const items = await getFeed();
  const brands = [...new Set(items.map((i) => i.brand))].sort((a, b) => a.localeCompare(b, "ko"));
  return { items, brands };
}

const PLATFORMS: ("all" | Platform)[] = ["all", "meta_ads", "instagram", "twitter", "tiktok"];
const KINDS: ("all" | "ad" | "post")[] = ["all", "ad", "post"];
const FORMATS: { key: "image" | "video" | "carousel"; icon: string; label: string }[] = [
  { key: "image", icon: "image", label: "이미지" },
  { key: "video", icon: "videocam", label: "영상" },
  { key: "carousel", icon: "view_carousel", label: "캐러셀" },
];
const PERIODS: { key: "all" | 7 | 30 | 90; label: string }[] = [
  { key: "all", label: "전체 기간" },
  { key: 7, label: "최근 7일" },
  { key: 30, label: "최근 30일" },
  { key: 90, label: "최근 90일" },
];

// caps 라벨 (Stitch 디자인의 그룹 라벨 스타일)
function GroupLabel({ children }: { children: React.ReactNode }) {
  return <span className="shrink-0 font-label-muted text-label-muted uppercase tracking-wide text-on-surface-variant opacity-70">{children}</span>;
}

// 필터 그룹 사이 세로 구분선
function Divider() {
  return <div className="mx-1 hidden h-10 w-px self-center bg-outline-variant sm:block" />;
}

export default function Feed() {
  const { items: all, brands } = useLoaderData<typeof loader>();
  const [platform, setPlatform] = useState<"all" | Platform>("all");
  const [kind, setKind] = useState<"all" | "ad" | "post">("all");
  const [brand, setBrand] = useState<"all" | string>("all");
  const [formats, setFormats] = useState<Set<"image" | "video" | "carousel">>(new Set());
  const [period, setPeriod] = useState<"all" | 7 | 30 | 90>("all");

  const toggleFormat = (f: "image" | "video" | "carousel") =>
    setFormats((prev) => {
      const next = new Set(prev);
      next.has(f) ? next.delete(f) : next.add(f);
      return next;
    });

  const cutoff = useMemo(() => {
    if (period === "all") return null;
    return new Date(Date.now() - period * 86_400_000).toISOString().slice(0, 10);
  }, [period]);

  const items = useMemo(
    () =>
      all.filter(
        (i) =>
          (platform === "all" || i.platform === platform) &&
          (kind === "all" || i.kind === kind) &&
          (brand === "all" || i.brand === brand) &&
          (formats.size === 0 || (i.format != null && formats.has(i.format))) &&
          (cutoff === null || (i.date != null && i.date >= cutoff)),
      ),
    [all, platform, kind, brand, formats, cutoff],
  );

  return (
    <div className="space-y-card-gap p-4 sm:p-container-padding">
      <Card className="flex flex-wrap items-center gap-x-4 gap-y-3 p-3 sm:px-4">
        {/* 플랫폼 */}
        <div className="flex flex-col gap-1">
          <GroupLabel>플랫폼</GroupLabel>
          <div className="flex flex-wrap gap-2">
            {PLATFORMS.map((p) => (
              <button
                key={p}
                onClick={() => setPlatform(p)}
                className={`shrink-0 rounded-full px-3 py-1 font-body-sm text-body-sm transition-colors ${
                  platform === p ? "bg-primary text-on-primary" : "border border-outline-variant bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
                }`}
              >
                {p === "all" ? "전체" : PLATFORM_META[p].label}
              </button>
            ))}
          </div>
        </div>

        <Divider />
        {/* 유형 */}
        <div className="flex flex-col gap-1">
          <GroupLabel>유형</GroupLabel>
          <div className="flex gap-2">
            {KINDS.map((k) => (
              <button
                key={k}
                onClick={() => setKind(k)}
                className={`shrink-0 rounded-full px-3 py-1 font-body-sm text-body-sm transition-colors ${
                  kind === k ? "bg-primary text-on-primary" : "border border-outline-variant bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
                }`}
              >
                {k === "all" ? "전체" : k === "ad" ? "광고" : "게시물"}
              </button>
            ))}
          </div>
        </div>

        <Divider />
        {/* 브랜드 */}
        <div className="flex flex-col gap-1">
          <GroupLabel>브랜드</GroupLabel>
          <select
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            className="cursor-pointer border-none bg-transparent p-0 font-body-sm text-body-sm font-medium focus:outline-none focus:ring-0"
          >
            <option value="all">전체 브랜드</option>
            {brands.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>

        <Divider />
        {/* 포맷 */}
        <div className="flex flex-col gap-1">
          <GroupLabel>포맷</GroupLabel>
          <div className="flex items-center gap-2">
            {FORMATS.map((f) => (
              <button
                key={f.key}
                onClick={() => toggleFormat(f.key)}
                title={f.label}
                aria-pressed={formats.has(f.key)}
                className={`material-symbols-outlined notranslate rounded p-1 text-[20px] transition-colors ${
                  formats.has(f.key) ? "text-primary" : "text-outline hover:text-on-surface-variant"
                }`}
              >
                {f.icon}
              </button>
            ))}
          </div>
        </div>

        {/* 기간 (우측 pill) + 카운트 */}
        <div className="ml-auto flex items-center gap-3">
          <span className="shrink-0 font-label-muted text-label-muted text-on-surface-variant">{items.length}개</span>
          <div className="relative">
            <span className="material-symbols-outlined notranslate pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[18px] text-outline">calendar_today</span>
            <select
              value={String(period)}
              onChange={(e) => setPeriod(e.target.value === "all" ? "all" : (Number(e.target.value) as 7 | 30 | 90))}
              className="cursor-pointer appearance-none rounded-lg border border-outline-variant bg-surface-container-low py-2 pl-9 pr-8 font-body-sm text-body-sm font-medium hover:bg-surface-container focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {PERIODS.map((p) => (
                <option key={String(p.key)} value={String(p.key)}>
                  {p.label}
                </option>
              ))}
            </select>
            <span className="material-symbols-outlined notranslate pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[18px] text-outline">expand_more</span>
          </div>
        </div>
      </Card>

      {items.length === 0 ? (
        <Card className="p-12 text-center text-on-surface-variant">
          <span className="material-symbols-outlined notranslate text-[40px] opacity-40">inbox</span>
          <p className="mt-2 font-body-md text-body-md">조건에 맞는 데이터가 없습니다. 필터를 조정하거나 수집기를 실행해 주세요.</p>
        </Card>
      ) : (
        <FeedGrid items={items} />
      )}
    </div>
  );
}
