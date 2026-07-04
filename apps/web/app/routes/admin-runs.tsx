import { useEffect, useMemo, useState } from "react";
import { Form, useActionData, useLoaderData, useNavigation, useRevalidator } from "react-router";
import { ACTIVE_PLATFORMS } from "@celine/shared";
import { Card, CardHeader, KpiDelta, PlatformChip } from "~/components/ui";
import { getCollectableAccounts, getRuns, getRunStats } from "~/lib/queries.server";
import type { Platform } from "~/mock/data";

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
  if (!env.COLLECTOR_URL || !env.COLLECTOR_SECRET) {
    return { ok: false, error: "COLLECTOR_URL 또는 COLLECTOR_SECRET 설정이 없습니다." };
  }

  const res = await fetch(`${String(env.COLLECTOR_URL).replace(/\/$/, "")}/manual-collect`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-celine-collect-secret": String(env.COLLECTOR_SECRET),
    },
    body: JSON.stringify({ accountIds, maxItems }),
  });
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

const STATUS_STYLE: Record<string, { label: string; cls: string; dot: string }> = {
  done: { label: "완료", cls: "bg-[#D8C28A]/15 text-[#D8C28A]", dot: "bg-[#C8A45D]" },
  running: { label: "실행 중", cls: "bg-primary-container/15 text-primary", dot: "bg-primary animate-pulse" },
  stale: { label: "중단됨", cls: "bg-error-container/70 text-error", dot: "bg-error" },
  error: { label: "오류", cls: "bg-error-container text-error", dot: "bg-error" },
};

export default function AdminRuns() {
  const { runs, summary, collectable } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const revalidator = useRevalidator();
  const [query, setQuery] = useState("");
  const [seconds, setSeconds] = useState(45);
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
    { label: "오늘 수집 실행", value: String(summary.total), icon: "sync", tone: "text-primary", delta: summary.totalDelta, progress: Math.min(100, summary.total * 10) },
    { label: "성공률", value: `${summary.rate}%`, icon: "check_circle", tone: "text-[#C8A45D]", delta: summary.rateDelta, progress: summary.rate },
    { label: "확인 필요한 실패", value: String(summary.fail), icon: "error", tone: "text-error", delta: summary.failDelta, progress: Math.min(100, summary.fail * 20) },
  ];
  const filteredRuns = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return runs;
    return runs.filter((r) =>
      [r.brand, r.platform, r.status, r.error ?? ""].some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [query, runs]);
  const runningRuns = useMemo(() => runs.filter((r) => r.status === "running").slice(0, 4), [runs]);
  const recentProgressRuns = useMemo(() => runs.slice(0, 5), [runs]);
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

  return (
    <div className="space-y-card-gap p-4 sm:p-container-padding">
      <div className="grid grid-cols-1 gap-card-gap md:grid-cols-3">
        {cards.map((s) => (
          <Card key={s.label} className="surface-grid flex min-h-[132px] items-center justify-between p-4 sm:p-container-padding">
            <div className="min-w-0 flex-1">
              <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">{s.label}</span>
              <div className="mt-2 flex items-end gap-2">
                <p className={`font-metric-lg text-metric-lg tabular-nums ${s.tone}`}>{s.value}</p>
                <KpiDelta
                  dir={s.delta > 0 ? "up" : s.delta < 0 ? "down" : "flat"}
                  text={`${s.delta > 0 ? "+" : ""}${s.delta}${s.label === "성공률" ? "%p" : ""}`}
                />
              </div>
              <div className="mt-4 h-1.5 overflow-hidden rounded bg-surface-variant">
                <div className="h-full rounded bg-primary" style={{ width: `${s.progress}%` }} />
              </div>
            </div>
            <span className={`material-symbols-outlined notranslate rounded bg-surface-container-lowest/80 p-2 text-[32px] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] ${s.tone}`}>{s.icon}</span>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader
          title="수동 수집 시작"
          action={
            <button
              type="button"
              onClick={toggleAll}
              className="rounded border border-outline-variant/80 bg-surface-container-lowest px-3 py-1.5 font-label-muted text-label-muted text-on-surface-variant transition-colors hover:border-primary hover:text-primary"
            >
              {selectedAccounts.length === allAccountIds.length ? "전체 해제" : "전체 선택"}
            </button>
          }
        />
        <Form method="post" className="space-y-4 p-4 sm:p-container-padding">
          {selectedAccounts.map((id) => (
            <input key={id} type="hidden" name="accountId" value={id} />
          ))}

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-4">
              <div className="rounded border border-outline-variant/80 bg-surface-container-low p-3">
                <div className="mb-3 flex items-center justify-between">
                  <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">매체 빠른 선택</span>
                  <span className="font-label-muted text-label-muted text-on-surface-variant">Meta, Instagram, X, TikTok</span>
                </div>
                <div className="flex flex-wrap gap-2">
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
                        className={`inline-flex items-center gap-2 rounded border px-3 py-2 text-left transition-colors ${
                          checked
                            ? "border-primary bg-primary text-on-primary"
                            : "border-outline-variant/80 bg-surface-container-lowest text-on-surface hover:border-primary"
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

              <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                {collectable.map((brand) => {
                  const accountIds = brand.accounts.map((account) => account.id);
                  const checked = accountIds.length > 0 && accountIds.every((id) => selectedSet.has(id));
                  return (
                    <div key={brand.id} className="rounded border border-outline-variant/80 bg-surface-container-lowest p-3">
                      <button
                        type="button"
                        onClick={() => toggleBrand(accountIds)}
                        className="flex w-full items-center justify-between gap-3 text-left"
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-body-md text-body-md font-semibold">{brand.name}</span>
                          <span className="font-label-muted text-label-muted text-on-surface-variant">{brand.accounts.length}개 계정</span>
                        </span>
                        <span className={`material-symbols-outlined notranslate text-[22px] ${checked ? "text-primary" : "text-on-surface-variant"}`}>
                          {checked ? "check_box" : "check_box_outline_blank"}
                        </span>
                      </button>
                      <div className="mt-3 flex flex-wrap gap-2">
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
                              className={`inline-flex items-center gap-2 rounded border px-2.5 py-1.5 transition-colors ${
                                accountChecked
                                  ? "border-primary bg-primary/5 text-primary"
                                  : "border-outline-variant/70 bg-surface-container-low text-on-surface-variant hover:border-primary/70"
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

            <div className="rounded border border-outline-variant/80 bg-surface-container-low p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">실행 준비</span>
                <button
                  type="button"
                  onClick={() => revalidator.revalidate()}
                  className="inline-flex items-center gap-1 rounded border border-outline-variant/80 bg-surface-container-lowest px-2 py-1 font-label-muted text-[11px] text-on-surface-variant transition-colors hover:border-primary hover:text-primary"
                >
                  <span className="material-symbols-outlined notranslate text-[15px]">refresh</span>
                  상태 갱신
                </button>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded bg-surface-container-lowest p-3">
                  <p className="font-label-muted text-[11px] text-on-surface-variant">선택 조합</p>
                  <p className="mt-1 font-metric-md text-metric-md tabular-nums">{selectedAccounts.length}</p>
                </div>
                <label className="rounded bg-surface-container-lowest p-3">
                  <span className="font-label-muted text-[11px] text-on-surface-variant">계정당 최대</span>
                  <input
                    name="maxItems"
                    type="number"
                    min={1}
                    max={200}
                    defaultValue={50}
                    className="mt-1 w-full rounded border border-outline-variant/70 bg-surface-container-lowest px-2 py-1 font-body-md text-body-md tabular-nums focus:border-primary/60 focus:outline-none"
                  />
                </label>
              </div>
              <div className="mt-4 max-h-56 space-y-2 overflow-y-auto pr-1">
                {selectedPreview.length === 0 ? (
                  <p className="rounded border border-dashed border-outline-variant/80 p-3 font-body-sm text-body-sm text-on-surface-variant">
                    브랜드와 매체를 선택하면 여기서 실행 조합을 확인할 수 있습니다.
                  </p>
                ) : (
                  selectedPreview.map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-2 rounded bg-surface-container-lowest p-2">
                      <span className="min-w-0 truncate font-body-sm text-body-sm font-semibold">{item.brand}</span>
                      <PlatformChip platform={item.platform} />
                    </div>
                  ))
                )}
              </div>
              {actionData && (
                <div className={`mt-4 rounded border p-3 font-body-sm text-body-sm ${
                  actionData.ok
                    ? "border-primary-container/60 bg-primary-container/10 text-on-surface"
                    : "border-error/30 bg-error-container/60 text-error"
                }`}>
                  {actionData.ok
                    ? `${actionData.queued}개 수집 작업을 Queue에 넣었습니다. 요청 ${actionData.requested}개, 실패/제외 ${actionData.skipped}개.`
                    : actionData.error}
                </div>
              )}
              <div className="mt-4 rounded border border-outline-variant/80 bg-surface-container-lowest p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">수집 진행상황</span>
                  <span className="font-label-muted text-[11px] text-on-surface-variant">{seconds}초 후 자동 갱신</span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <div className="rounded bg-surface-container-low p-2">
                    <p className="font-label-muted text-[10px] text-on-surface-variant">Queue</p>
                    <p className="mt-1 font-body-md text-body-md font-semibold tabular-nums">
                      {actionData?.ok ? actionData.queued : "—"}
                    </p>
                  </div>
                  <div className="rounded bg-surface-container-low p-2">
                    <p className="font-label-muted text-[10px] text-on-surface-variant">진행 중</p>
                    <p className="mt-1 font-body-md text-body-md font-semibold tabular-nums">{runningRuns.length}</p>
                  </div>
                  <div className="rounded bg-surface-container-low p-2">
                    <p className="font-label-muted text-[10px] text-on-surface-variant">최근 상태</p>
                    <p className="mt-1 truncate font-body-md text-body-md font-semibold">
                      {latestRun ? STATUS_STYLE[latestRun.status]?.label ?? latestRun.status : "—"}
                    </p>
                  </div>
                </div>
                {runningRuns.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {runningRuns.map((run) => (
                      <RunStatusRow key={run.id} run={run} emphasize />
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 rounded border border-dashed border-outline-variant/80 p-3 font-body-sm text-body-sm text-on-surface-variant">
                    {actionData?.ok
                      ? "Queue 등록 직후입니다. Collector가 실행을 시작하면 진행 중 항목이 여기에 표시됩니다."
                      : "수집을 시작하면 Queue 등록 수와 실행 상태가 여기에 표시됩니다."}
                  </div>
                )}
                {recentProgressRuns.length > 0 && (
                  <div className="mt-3 space-y-2 border-t border-outline-variant/70 pt-3">
                    <span className="font-label-muted text-[11px] text-on-surface-variant">최근 실행</span>
                    {recentProgressRuns.slice(0, 3).map((run) => (
                      <RunStatusRow key={run.id} run={run} />
                    ))}
                  </div>
                )}
              </div>
              <button
                type="submit"
                disabled={selectedAccounts.length === 0 || isSubmitting}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded bg-primary px-4 py-2.5 font-body-md text-body-md font-semibold text-on-primary transition-colors hover:bg-[#1C1C1C] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span className="material-symbols-outlined notranslate text-[20px]">{isSubmitting ? "hourglass_top" : "play_arrow"}</span>
                {isSubmitting ? "수집 요청 중" : "Apify 수집 시작"}
              </button>
            </div>
          </div>
        </Form>
      </Card>

      <Card>
        <CardHeader
          title="최근 수집 실행"
          action={<span className="font-label-muted text-label-muted text-on-surface-variant">{seconds}초 후 새로고침</span>}
        />
        <div className="flex flex-col gap-3 border-b border-outline-variant/80 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-container-padding">
          <div className="relative w-full sm:max-w-sm">
            <span className="material-symbols-outlined notranslate absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-on-surface-variant">
              search
            </span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded border border-outline-variant/70 bg-surface-container-lowest py-2 pl-10 pr-3 font-body-sm text-body-sm focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="브랜드, 플랫폼, 오류 검색"
            />
          </div>
          <span className="font-label-muted text-label-muted text-on-surface-variant">표시 {filteredRuns.length}건 / 전체 {runs.length}건</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left">
            <thead>
              <tr className="bg-surface">
                {["브랜드", "플랫폼", "실행 시각", "상태", "수집 건수", "소요 시간"].map((h, i) => (
                  <th key={h} className={`border-b border-outline-variant/80 px-container-padding py-3 font-label-caps text-label-caps uppercase text-on-surface-variant ${i >= 4 ? "text-right" : ""}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/80">
              {filteredRuns.map((r) => {
                const s = STATUS_STYLE[r.status] ?? STATUS_STYLE.done;
                return (
                  <tr key={r.id} className={`hover:bg-surface-dim/30 transition-colors ${r.status === "error" ? "bg-error-container/20" : ""}`}>
                    <td className="px-container-padding py-3 font-body-md text-body-md font-semibold">{r.brand}</td>
                    <td className="px-container-padding py-3"><PlatformChip platform={r.platform} withIcon /></td>
                    <td className="px-container-padding py-3 font-body-sm text-body-sm tabular-nums text-on-surface-variant">{r.lastRun}</td>
                    <td className="px-container-padding py-3">
                      <span className={`inline-flex items-center gap-1.5 rounded px-2 py-1 font-label-caps text-[10px] ${s.cls}`}>
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
    duration: string;
  };
  emphasize?: boolean;
}) {
  const style = STATUS_STYLE[run.status] ?? STATUS_STYLE.done;
  return (
    <div
      className={`flex items-center justify-between gap-2 rounded border border-outline-variant/70 bg-surface-container-low p-2 ${
        emphasize ? "shadow-[inset_3px_0_0_rgba(200,164,93,0.75)]" : ""
      }`}
    >
      <span className="min-w-0">
        <span className="block truncate font-body-sm text-body-sm font-semibold">{run.brand}</span>
        <span className="mt-1 flex items-center gap-2">
          <PlatformChip platform={run.platform} />
          <span className="font-label-muted text-[11px] text-on-surface-variant">{run.lastRun}</span>
        </span>
      </span>
      <span className="shrink-0 text-right">
        <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-label-caps text-[10px] ${style.cls}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
          {style.label}
        </span>
        <span className="mt-1 block font-label-muted text-[11px] text-on-surface-variant">
          {run.items ? `${run.items}건` : run.duration}
        </span>
      </span>
    </div>
  );
}
