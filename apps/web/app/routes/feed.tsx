import { useLoaderData, useNavigation, useSearchParams } from "react-router";
import { Card } from "~/components/ui";
import { FeedGrid } from "~/components/feed-card";
import { PLATFORM_META, type Platform } from "~/lib/platform";
import { getBrandOptions, getFeed } from "~/lib/queries.server";

export function meta() {
  return [{ title: "Celine Intelligence · 통합 피드" }];
}

const PAGE_SIZE = 120;
const PLATFORMS: ("all" | Platform)[] = ["all", "meta_ads", "instagram", "twitter", "tiktok"];
const KINDS: ("all" | "ad" | "post")[] = ["all", "ad", "post"];
const FORMAT_KEYS = ["image", "video", "carousel"] as const;
type FormatKey = (typeof FORMAT_KEYS)[number];

// 필터는 URL 검색 파라미터가 단일 소스 — 서버 loader 가 같은 값으로 쿼리해
// "상위 N건을 자른 뒤 클라이언트에서 거르기" 문제를 없애고, URL 공유도 가능해진다.
function parseFilters(qs: URLSearchParams) {
  const platformRaw = qs.get("platform") ?? "all";
  const kindRaw = qs.get("kind") ?? "all";
  const periodRaw = Number(qs.get("period"));
  const limitRaw = Number(qs.get("limit"));
  return {
    platform: (PLATFORMS as string[]).includes(platformRaw) ? (platformRaw as "all" | Platform) : "all",
    kind: (KINDS as string[]).includes(kindRaw) ? (kindRaw as "all" | "ad" | "post") : "all",
    brandSlug: qs.get("brand") ?? "all",
    formats: (qs.get("formats") ?? "")
      .split(",")
      .filter((f): f is FormatKey => (FORMAT_KEYS as readonly string[]).includes(f)),
    sinceDays: [7, 30, 90].includes(periodRaw) ? periodRaw : null,
    limit: Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(600, Math.floor(limitRaw)) : PAGE_SIZE,
  };
}

export async function loader({ request }: { request: Request }) {
  const filters = parseFilters(new URL(request.url).searchParams);
  const [{ items, hasMore }, brandOptions] = await Promise.all([
    getFeed(filters),
    getBrandOptions(),
  ]);
  return { items, hasMore, brandOptions, limit: filters.limit };
}

const FORMATS: { key: FormatKey; icon: string; label: string }[] = [
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
  const { items, hasMore, brandOptions, limit } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigation = useNavigation();
  const loading = navigation.state !== "idle";
  const { platform, kind, brandSlug, formats, sinceDays } = parseFilters(searchParams);
  const formatSet = new Set<FormatKey>(formats);

  // 필터 변경 시 limit(페이지) 리셋. "all"/빈 값은 파라미터 삭제로 URL 을 깨끗하게 유지.
  const setParam = (key: string, value: string | null) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value === null || value === "all" || value === "") next.delete(key);
        else next.set(key, value);
        next.delete("limit");
        return next;
      },
      { preventScrollReset: true },
    );
  };

  const toggleFormat = (f: FormatKey) => {
    const next = new Set(formatSet);
    next.has(f) ? next.delete(f) : next.add(f);
    setParam("formats", next.size ? [...next].join(",") : null);
  };

  const loadMore = () => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("limit", String(limit + PAGE_SIZE));
        return next;
      },
      { preventScrollReset: true },
    );
  };

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
                onClick={() => setParam("platform", p)}
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
                onClick={() => setParam("kind", k)}
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
            value={brandSlug}
            onChange={(e) => setParam("brand", e.target.value)}
            className="cursor-pointer border-none bg-transparent p-0 font-body-sm text-body-sm font-medium focus:outline-none focus:ring-0"
          >
            <option value="all">전체 브랜드</option>
            {brandOptions.map((b) => (
              <option key={b.slug} value={b.slug}>
                {b.name}
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
                aria-pressed={formatSet.has(f.key)}
                className={`material-symbols-outlined notranslate rounded p-1 text-[20px] transition-colors ${
                  formatSet.has(f.key) ? "text-primary" : "text-outline hover:text-on-surface-variant"
                }`}
              >
                {f.icon}
              </button>
            ))}
          </div>
        </div>

        {/* 기간 (우측 pill) + 카운트 */}
        <div className="ml-auto flex items-center gap-3">
          <span className="shrink-0 font-label-muted text-label-muted text-on-surface-variant">
            {items.length}
            {hasMore ? "+" : ""}개
          </span>
          <div className="relative">
            <span className="material-symbols-outlined notranslate pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[18px] text-outline">calendar_today</span>
            <select
              value={String(sinceDays ?? "all")}
              onChange={(e) => setParam("period", e.target.value === "all" ? null : e.target.value)}
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
        <>
          <FeedGrid items={items} />
          {hasMore && (
            <div className="flex justify-center pt-2">
              <button
                onClick={loadMore}
                disabled={loading}
                className="rounded-full border border-outline-variant bg-surface-container px-6 py-2 font-body-sm text-body-sm font-medium text-on-surface-variant transition-colors hover:bg-surface-container-high disabled:opacity-50"
              >
                {loading ? "불러오는 중…" : "더 보기"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
