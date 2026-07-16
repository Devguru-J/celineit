import { useEffect, useMemo, useState } from "react";
import { Form, useActionData, useLoaderData, useNavigation, useRevalidator } from "react-router";
import { ACTIVE_PLATFORMS } from "@celine/shared";
import { KpiDelta, Panel, PanelHeader, PlatformChip } from "~/components/ui";
import { getCollector } from "~/lib/collector.server";
import { getCollectableAccounts, getRuns, getRunStats } from "~/lib/queries.server";
import type { Platform } from "~/lib/platform";

export function meta() {
  return [{ title: "Celine Intelligence · 수집 실행 현황" }];
}

export async function loader() {
  const [runs, summary, collectable] = await Promise.all([getRuns(), getRunStats(), getCollectableAccounts()]);
  return { runs, summary, collectable };
}

type ActionData =
  | { ok: true; queued: number; skipped: number; requested: number; date: string; maxItems: number }
  | { ok: false; error: string };

function envFromContext(context: unknown) {
  const c = context as { cloudflare?: { env?: Partial<Env> }; env?: Partial<Env> } | undefined;
  const runtimeProcess = globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  };
  return {
    ...(c?.cloudflare?.env ?? c?.env ?? {}),
    COLLECTOR_URL: c?.cloudflare?.env?.COLLECTOR_URL ?? c?.env?.COLLECTOR_URL ?? runtimeProcess.process?.env?.COLLECTOR_URL,
    COLLECTOR_SECRET: c?.cloudflare?.env?.COLLECTOR_SECRET ?? c?.env?.COLLECTOR_SECRET ?? runtimeProcess.process?.env?.COLLECTOR_SECRET,
  };
}

export async function action({ request, context }: { request: Request; context?: unknown }): Promise<ActionData> {
  const formData = await request.formData();
  const accountIds = [...new Set(formData.getAll("accountId").filter((v): v is string => typeof v === "string" && v.length > 0))];
  const maxItemsRaw = Number(formData.get("maxItems") ?? 50);
  const maxItems = Number.isFinite(maxItemsRaw) ? Math.max(1, Math.min(200, Math.floor(maxItemsRaw))) : 50;
  if (accountIds.length === 0) return { ok: false, error: "수집할 브랜드/매체 조합을 선택해 주세요." };

  const env = envFromContext(context);
  const collector = getCollector();
  if (!env.COLLECTOR_SECRET) {
    return { ok: false, error: "COLLECTOR_SECRET 설정이 없습니다." };
  }
  if (!collector && !env.COLLECTOR_URL) {
    return { ok: false, error: "COLLECTOR_URL 설정이 없습니다." };
  }

  const init: RequestInit = {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-celine-collect-secret": String(env.COLLECTOR_SECRET),
    },
    body: JSON.stringify({ accountIds, maxItems }),
  };
  // 프로덕션: 같은 계정 Worker 간 public URL fetch 는 loopback 되므로 Service Binding(COLLECTOR) 사용.
  // 로컬 dev: 바인딩이 없으면 COLLECTOR_URL(예: http://localhost:8788) 로 직접 호출.
  const res = collector
    ? await collector.fetch(new Request("https://collector/manual-collect", init))
    : await fetch(`${String(env.COLLECTOR_URL).replace(/\/$/, "")}/manual-collect`, init);
  const data = (await res.json().catch(() => null)) as Partial<ActionData> | null;
  if (!res.ok || !data?.ok) {
    return { ok: false, error: data && "error" in data && data.error ? data.error : `collector 요청 실패 (${res.status})` };
  }
  return {
    ok: true,
    queued: Number(data.queued ?? 0),
    skipped: Number(data.skipped ?? 0),
    requested: accountIds.length,
    date: String(data.date ?? ""),
    maxItems: Number(data.maxItems ?? maxItems),
  };
}

// 상태 시맨틱: 완료=에메랄드, 진행=앰버(pulse), 중단/오류=로즈 — 저채도 상태 컬러 체계.
const STATUS_STYLE: Record<string, { label: string; cls: string; dot: string }> = {
  done: { label: "완료", cls: "bg-success/10 text-success", dot: "bg-success" },
  running: { label: "실행 중", cls: "bg-warning/10 text-warning", dot: "bg-warning animate-pulse" },
  stale: { label: "중단됨", cls: "bg-danger/10 text-danger", dot: "bg-danger" },
  error: { label: "오류", cls: "bg-danger/15 text-danger", dot: "bg-danger" },
};

type SortKey = "brand" | "startedAt" | "status" | "items";
type SortState = { key: SortKey; dir: "asc" | "desc" };

export default function AdminRuns() {
  const { runs, summary, collectable } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const revalidator = useRevalidator();
  const [query, setQuery] = useState("");
  const [seconds, setSeconds] = useState(45);
  const [sort, setSort] = useState<SortState>({ key: "startedAt", dir: "desc" });
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const selectedSet = useMemo(() => new Set(selectedAccounts), [selectedAccounts]);
  const platformList = ACTIVE_PLATFORMS as Platform[];
  const allAccountIds = useMemo(
    () => collectable.flatMap((brand) => brand.accounts.map((account) => account.id)),
    [collectable],
  );
  const selectedPreview = useMemo(
    () =>
      collectable.flatMap((brand) =>
        brand.accounts
          .filter((account) => selectedSet.has(account.id))
          .map((account) => ({ brand: brand.name, ...account })),
      ),
    [collectable, selectedSet],
  );
  const isSubmitting = navigation.state === "submitting";
  const cards = [
    { label: "오늘 수집 실행", value: String(summary.total), icon: "sync", tone: "text-on-surface", bar: "bg-primary", delta: summary.totalDelta, progress: Math.min(100, summary.total * 10) },
    { label: "성공률", value: `${summary.rate}%`, icon: "check_circle", tone: "text-primary", bar: "bg-success", delta: summary.rateDelta, progress: summary.rate },
    { label: "확인 필요한 실패", value: String(summary.fail), icon: "error", tone: "text-danger", bar: "bg-danger", delta: summary.failDelta, progress: Math.min(100, summary.fail * 20) },
  ];
  const filteredRuns = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return runs;
    return runs.filter((r) =>
      [r.brand, r.platform, r.status, r.error ?? ""].some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [query, runs]);
  const sortedRuns = useMemo(() => {
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...filteredRuns].sort((a, b) => {
      switch (sort.key) {
        case "brand":
          return dir * a.brand.localeCompare(b.brand, "ko");
        case "status":
          return dir * a.status.localeCompare(b.status);
        case "items":
          return dir * ((a.items ?? -1) - (b.items ?? -1));
        case "startedAt":
        default:
          return dir * ((a.startedAtISO ? Date.parse(a.startedAtISO) : 0) - (b.startedAtISO ? Date.parse(b.startedAtISO) : 0));
      }
    });
  }, [filteredRuns, sort]);
  // 한 배치의 run 들은 started_at 이 거의 동일해, 상위 몇 개만 자르면 특정 플랫폼(삽입이 늦은
  // meta_ads)만 보이는 착시가 생긴다. 카운트는 전체 running 으로, 목록은 전 플랫폼이 보이도록
  // 넉넉히 노출하고 스크롤로 처리한다.
  const runningAll = useMemo(() => runs.filter((r) => r.status === "running"), [runs]);
  const runningRuns = useMemo(() => runningAll.slice(0, 24), [runningAll]);
  const recentProgressRuns = useMemo(() => runs.slice(0, 12), [runs]);
  const latestRun = recentProgressRuns[0];

  useEffect(() => {
    const id = window.setInterval(() => {
      setSeconds((prev) => {
        if (prev <= 1) {
          revalidator.revalidate();
          return 45;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [revalidator]);

  useEffect(() => {
    if (actionData?.ok) revalidator.revalidate();
  }, [actionData, revalidator]);

  function setAccountIds(ids: string[]) {
    setSelectedAccounts([...new Set(ids)]);
  }

  function toggleAll() {
    setAccountIds(selectedAccounts.length === allAccountIds.length ? [] : allAccountIds);
  }

  function toggleBrand(accountIds: string[]) {
    const everySelected = accountIds.every((id) => selectedSet.has(id));
    setAccountIds(
      everySelected
        ? selectedAccounts.filter((id) => !accountIds.includes(id))
        : [...selectedAccounts, ...accountIds],
    );
  }

  function togglePlatform(platform: Platform) {
    const ids = collectable.flatMap((brand) =>
      brand.accounts.filter((account) => account.platform === platform).map((account) => account.id),
    );
    const everySelected = ids.length > 0 && ids.every((id) => selectedSet.has(id));
    setAccountIds(
      everySelected
        ? selectedAccounts.filter((id) => !ids.includes(id))
        : [...selectedAccounts, ...ids],
    );
  }

  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === "desc" ? "asc" : "desc" } : { key, dir: "desc" },
    );
  }

  return (
    <div className="mx-auto max-w-[1440px] space-y-6 p-4 sm:p-8">
      <header>
        <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">Operations</span>
        <h1 className="mt-1.5 text-xl font-semibold tracking-tight text-on-surface">수집 실행 현황</h1>
        <p className="mt-1.5 font-body-sm text-body-sm text-on-surface-variant">
          Apify 수집 파이프라인의 실행 상태를 모니터링하고, 브랜드·매체 조합을 골라 수동 수집을 시작합니다.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {cards.map((s) => (
          <Panel key={s.label} className="surface-grid p-6 sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">{s.label}</span>
              <span className={`material-symbols-outlined notranslate rounded-lg bg-surface-container-lowest p-2 text-[24px] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] ${s.tone}`}>
                {s.icon}
              </span>
            </div>
            <div className="mt-3 flex items-end gap-2.5">
              <p className={`font-metric-lg text-metric-lg tabular-nums ${s.tone}`}>{s.value}</p>
              <KpiDelta
                dir={s.delta > 0 ? "up" : s.delta < 0 ? "down" : "flat"}
                text={`${s.delta > 0 ? "+" : ""}${s.delta}${s.label === "성공률" ? "%p" : ""}`}
              />
            </div>
            <div className="mt-5 h-1 overflow-hidden rounded-full bg-white/5">
              <div className={`h-full rounded-full ${s.bar} transition-[width] duration-500`} style={{ width: `${s.progress}%` }} />
            </div>
          </Panel>
        ))}
      </div>

      <Panel>
        <PanelHeader
          title="수동 수집 시작"
          caption="선택한 브랜드 × 매체 조합만 Queue 에 등록됩니다."
          action={
            <button
              type="button"
              onClick={toggleAll}
              className="rounded-lg bg-surface-container-lowest px-3.5 py-2 font-label-muted text-label-muted text-on-surface-variant transition-colors duration-200 hover:bg-surface-container hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 active:scale-[0.98]"
            >
              {selectedAccounts.length === allAccountIds.length ? "전체 해제" : "전체 선택"}
            </button>
          }
        />
        <Form method="post" className="space-y-6 p-5 sm:p-7">
          {selectedAccounts.map((id) => (
            <input key={id} type="hidden" name="accountId" value={id} />
          ))}

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-5">
              <div className="rounded-xl bg-surface-container-low p-4 sm:p-5">
                <div className="mb-4 flex items-center justify-between">
                  <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">매체 빠른 선택</span>
                  <span className="font-label-muted text-label-muted text-on-surface-variant">Meta, Instagram, X, TikTok</span>
                </div>
                <div className="flex flex-wrap gap-2.5">
                  {platformList.map((platform) => {
                    const ids = collectable.flatMap((brand) =>
                      brand.accounts.filter((account) => account.platform === platform).map((account) => account.id),
                    );
                    const checked = ids.length > 0 && ids.every((id) => selectedSet.has(id));
                    return (
                      <button
                        key={platform}
                        type="button"
                        disabled={ids.length === 0}
                        onClick={() => togglePlatform(platform)}
                        className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2.5 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 active:scale-[0.98] ${
                          checked
                            ? "bg-primary text-on-primary shadow-[0_2px_8px_rgba(200,164,93,0.35)]"
                            : "bg-surface-container-lowest text-on-surface hover:bg-surface-container"
                        } disabled:cursor-not-allowed disabled:opacity-40`}
                      >
                        <span className={`material-symbols-outlined notranslate text-[18px] ${checked ? "text-on-primary" : "text-primary"}`}>
                          {checked ? "check_box" : "check_box_outline_blank"}
                        </span>
                        <PlatformChip platform={platform} />
                        <span className="font-label-muted text-[11px] tabular-nums opacity-80">{ids.length}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                {collectable.map((brand) => {
                  const accountIds = brand.accounts.map((account) => account.id);
                  const checked = accountIds.length > 0 && accountIds.every((id) => selectedSet.has(id));
                  return (
                    <div key={brand.id} className="rounded-xl bg-surface-container-lowest p-4">
                      <button
                        type="button"
                        onClick={() => toggleBrand(accountIds)}
                        className="flex w-full items-center justify-between gap-3 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-body-md text-body-md font-semibold">{brand.name}</span>
                          <span className="font-label-muted text-label-muted text-on-surface-variant">{brand.accounts.length}개 계정</span>
                        </span>
                        <span className={`material-symbols-outlined notranslate text-[22px] transition-colors duration-200 ${checked ? "text-primary" : "text-on-surface-variant"}`}>
                          {checked ? "check_box" : "check_box_outline_blank"}
                        </span>
                      </button>
                      <div className="mt-3.5 flex flex-wrap gap-2">
                        {brand.accounts.map((account) => {
                          const accountChecked = selectedSet.has(account.id);
                          return (
                            <button
                              key={account.id}
                              type="button"
                              onClick={() =>
                                setAccountIds(
                                  accountChecked
                                    ? selectedAccounts.filter((id) => id !== account.id)
                                    : [...selectedAccounts, account.id],
                                )
                              }
                              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 active:scale-[0.98] ${
                                accountChecked
                                  ? "bg-primary/10 text-primary ring-1 ring-inset ring-primary/40"
                                  : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
                              }`}
                            >
                              <PlatformChip platform={account.platform} />
                              <span className="max-w-[140px] truncate font-label-muted text-[11px]">{account.handle}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl bg-surface-container-low p-5">
              <div className="flex items-center justify-between gap-3">
                <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">실행 준비</span>
                <button
                  type="button"
                  onClick={() => revalidator.revalidate()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-surface-container-lowest px-2.5 py-1.5 font-label-muted text-[11px] text-on-surface-variant transition-colors duration-200 hover:bg-surface-container hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 active:scale-[0.98]"
                >
                  <span className="material-symbols-outlined notranslate text-[15px]">refresh</span>
                  상태 갱신
                </button>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-surface-container-lowest p-4">
                  <p className="font-label-muted text-[11px] text-on-surface-variant">선택 조합</p>
                  <p className="mt-1.5 font-metric-md text-metric-md tabular-nums">{selectedAccounts.length}</p>
                </div>
                <label className="rounded-lg bg-surface-container-lowest p-4">
                  <span className="font-label-muted text-[11px] text-on-surface-variant">계정당 최대</span>
                  <input
                    name="maxItems"
                    type="number"
                    min={1}
                    max={200}
                    defaultValue={50}
                    className="mt-1.5 w-full rounded-lg border border-transparent bg-surface-container-low px-2.5 py-1.5 font-body-md text-body-md tabular-nums transition-colors duration-200 focus:border-primary/50 focus:outline-none"
                  />
                </label>
              </div>
              <div className="mt-5 max-h-56 space-y-2 overflow-y-auto pr-1">
                {selectedPreview.length === 0 ? (
                  <p className="rounded-lg bg-surface-container-lowest/60 p-4 font-body-sm text-body-sm text-on-surface-variant">
                    브랜드와 매체를 선택하면 여기서 실행 조합을 확인할 수 있습니다.
                  </p>
                ) : (
                  selectedPreview.map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-2 rounded-lg bg-surface-container-lowest p-2.5">
                      <span className="min-w-0 truncate font-body-sm text-body-sm font-semibold">{item.brand}</span>
                      <PlatformChip platform={item.platform} />
                    </div>
                  ))
                )}
              </div>
              {actionData && (
                <div className={`mt-5 flex items-start gap-2.5 rounded-lg p-4 font-body-sm text-body-sm ${
                  actionData.ok ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
                }`}>
                  <span className="material-symbols-outlined notranslate text-[18px]">
                    {actionData.ok ? "check_circle" : "error"}
                  </span>
                  <span className={actionData.ok ? "text-on-surface" : undefined}>
                    {actionData.ok
                      ? `${actionData.queued}개 수집 작업을 Queue에 넣었습니다. 요청 ${actionData.requested}개, 실패/제외 ${actionData.skipped}개.`
                      : actionData.error}
                  </span>
                </div>
              )}
              <div className="mt-5 rounded-lg bg-surface-container-lowest p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">수집 진행상황</span>
                  <span className="font-label-muted text-[11px] tabular-nums text-on-surface-variant">{seconds}초 후 자동 갱신</span>
                </div>
                <div className="mt-3.5 grid grid-cols-3 gap-2.5">
                  <div className="rounded-lg bg-surface-container-low p-3">
                    <p className="font-label-muted text-[10px] text-on-surface-variant">Queue</p>
                    <p className="mt-1.5 font-body-md text-body-md font-semibold tabular-nums">
                      {actionData?.ok ? actionData.queued : "—"}
                    </p>
                  </div>
                  <div className="rounded-lg bg-surface-container-low p-3">
                    <p className="font-label-muted text-[10px] text-on-surface-variant">진행 중</p>
                    <p className="mt-1.5 font-body-md text-body-md font-semibold tabular-nums">{runningAll.length}</p>
                  </div>
                  <div className="rounded-lg bg-surface-container-low p-3">
                    <p className="font-label-muted text-[10px] text-on-surface-variant">최근 상태</p>
                    <p className="mt-1.5 truncate font-body-md text-body-md font-semibold">
                      {latestRun ? STATUS_STYLE[latestRun.status]?.label ?? latestRun.status : "—"}
                    </p>
                  </div>
                </div>
                {runningRuns.length > 0 ? (
                  <div className="mt-3.5 max-h-64 space-y-2 overflow-y-auto pr-1">
                    {runningRuns.map((run) => (
                      <RunStatusRow key={run.id} run={run} emphasize />
                    ))}
                  </div>
                ) : (
                  <div className="mt-3.5 rounded-lg bg-surface-container-low/60 p-4 font-body-sm text-body-sm text-on-surface-variant">
                    {actionData?.ok
                      ? "Queue 등록 직후입니다. Collector가 실행을 시작하면 진행 중 항목이 여기에 표시됩니다."
                      : "수집을 시작하면 Queue 등록 수와 실행 상태가 여기에 표시됩니다."}
                  </div>
                )}
                {recentProgressRuns.length > 0 && (
                  <div className="mt-4 space-y-2.5 border-t border-white/5 pt-4">
                    <span className="font-label-muted text-[11px] text-on-surface-variant">최근 실행</span>
                    <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                      {recentProgressRuns.map((run) => (
                        <RunStatusRow key={run.id} run={run} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <button
                type="submit"
                disabled={selectedAccounts.length === 0 || isSubmitting}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 font-body-md text-body-md font-semibold text-on-primary shadow-[0_2px_12px_rgba(200,164,93,0.3)] transition-all duration-200 hover:bg-primary-fixed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
              >
                <span className="material-symbols-outlined notranslate text-[20px]">{isSubmitting ? "hourglass_top" : "play_arrow"}</span>
                {isSubmitting ? "수집 요청 중" : "Apify 수집 시작"}
              </button>
            </div>
          </div>
        </Form>
      </Panel>

      <Panel>
        <PanelHeader
          title="최근 수집 실행"
          caption="열 제목을 눌러 정렬할 수 있습니다."
          action={<span className="font-label-muted text-label-muted tabular-nums text-on-surface-variant">{seconds}초 후 새로고침</span>}
        />
        <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
          <div className="relative w-full sm:max-w-sm">
            <span className="material-symbols-outlined notranslate absolute left-3.5 top-1/2 -translate-y-1/2 text-[20px] text-on-surface-variant">
              search
            </span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-lg border border-transparent bg-surface-container-lowest py-2.5 pl-11 pr-3.5 font-body-sm text-body-sm transition-colors duration-200 placeholder:text-on-surface-variant/70 focus:border-primary/40 focus:outline-none"
              placeholder="브랜드, 플랫폼, 오류 검색"
            />
          </div>
          <span className="font-label-muted text-label-muted tabular-nums text-on-surface-variant">
            표시 {sortedRuns.length}건 / 전체 {runs.length}건
          </span>
        </div>
        <div className="overflow-x-auto pb-2">
          <table className="w-full min-w-[760px] border-collapse text-left">
            <thead>
              <tr className="bg-white/[0.02]">
                <SortableTh label="브랜드" sortKey="brand" sort={sort} onSort={toggleSort} />
                <th className="px-6 py-3.5 text-left font-label-caps text-label-caps uppercase text-on-surface-variant sm:px-7">플랫폼</th>
                <SortableTh label="실행 시각" sortKey="startedAt" sort={sort} onSort={toggleSort} />
                <SortableTh label="상태" sortKey="status" sort={sort} onSort={toggleSort} />
                <SortableTh label="수집 건수" sortKey="items" sort={sort} onSort={toggleSort} align="right" />
                <th className="px-6 py-3.5 text-right font-label-caps text-label-caps uppercase text-on-surface-variant sm:px-7">소요 시간</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {sortedRuns.map((r) => {
                const s = STATUS_STYLE[r.status] ?? STATUS_STYLE.done;
                return (
                  <tr key={r.id} className={`transition-colors duration-200 hover:bg-surface-container-low/50 ${r.status === "error" ? "bg-danger/5" : ""}`}>
                    <td className="px-6 py-4 font-body-md text-body-md font-semibold sm:px-7">{r.brand}</td>
                    <td className="px-6 py-4 sm:px-7"><PlatformChip platform={r.platform} withIcon /></td>
                    <td className="px-6 py-4 font-body-sm text-body-sm tabular-nums text-on-surface-variant sm:px-7"><LocalTime iso={r.startedAtISO} fallback={r.lastRun} /></td>
                    <td className="px-6 py-4 sm:px-7">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-label-caps text-[10px] ${s.cls}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                        {s.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-body-md text-body-md tabular-nums sm:px-7">{r.items || "—"}</td>
                    <td className="px-6 py-4 text-right font-body-sm text-body-sm tabular-nums text-on-surface-variant sm:px-7">{r.duration}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

// 정렬 가능한 테이블 헤더 — 활성 컬럼은 골드, 방향은 expand_more 회전으로 표시(아이콘 서브셋 내에서 해결).
function SortableTh({
  label,
  sortKey,
  sort,
  onSort,
  align = "left",
}: {
  label: string;
  sortKey: SortKey;
  sort: SortState;
  onSort: (key: SortKey) => void;
  align?: "left" | "right";
}) {
  const active = sort.key === sortKey;
  return (
    <th className={`px-6 py-3.5 sm:px-7 ${align === "right" ? "text-right" : "text-left"}`}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`group inline-flex items-center gap-1 font-label-caps text-label-caps uppercase transition-colors duration-200 focus-visible:outline-none focus-visible:rounded focus-visible:ring-2 focus-visible:ring-primary/60 ${
          active ? "text-primary" : "text-on-surface-variant hover:text-on-surface"
        }`}
      >
        {label}
        <span
          className={`material-symbols-outlined notranslate text-[16px] transition-all duration-200 ${
            active ? `text-primary ${sort.dir === "asc" ? "rotate-180" : ""}` : "opacity-0 group-hover:opacity-50"
          }`}
        >
          expand_more
        </span>
      </button>
    </th>
  );
}

// 서버가 넘긴 ISO 타임스탬프를 사용자의 로컬 타임존 시각(HH:MM)으로 표시.
// SSR/첫 렌더는 UTC 폴백을 그대로 써서 하이드레이션 mismatch 를 피하고, 마운트 후 로컬 시각으로 교체.
function LocalTime({ iso, fallback }: { iso: string | null; fallback: string }) {
  const [local, setLocal] = useState<string | null>(null);
  useEffect(() => {
    if (iso) setLocal(new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
  }, [iso]);
  return <>{local ?? fallback}</>;
}

function RunStatusRow({
  run,
  emphasize = false,
}: {
  run: {
    id: string;
    brand: string;
    platform: Platform;
    status: string;
    items: number | null;
    lastRun: string;
    startedAtISO: string | null;
    duration: string;
  };
  emphasize?: boolean;
}) {
  const style = STATUS_STYLE[run.status] ?? STATUS_STYLE.done;
  return (
    <div
      className={`flex items-center justify-between gap-2 rounded-lg bg-surface-container-low p-3 ${
        emphasize ? "shadow-[inset_3px_0_0_rgba(200,164,93,0.75)]" : ""
      }`}
    >
      <span className="min-w-0">
        <span className="block truncate font-body-sm text-body-sm font-semibold">{run.brand}</span>
        <span className="mt-1 flex items-center gap-2">
          <PlatformChip platform={run.platform} />
          <span className="font-label-muted text-[11px] text-on-surface-variant"><LocalTime iso={run.startedAtISO} fallback={run.lastRun} /></span>
        </span>
      </span>
      <span className="shrink-0 text-right">
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-label-caps text-[10px] ${style.cls}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
          {style.label}
        </span>
        <span className="mt-1 block font-label-muted text-[11px] tabular-nums text-on-surface-variant">
          {run.items ? `${run.items}건` : run.duration}
        </span>
      </span>
    </div>
  );
}
