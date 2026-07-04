// 최소 Apify REST 클라이언트.
// PoC: run-sync-get-dataset-items 로 동기 실행 후 결과를 바로 받는다.
// 운영: startRun(webhook) → 완료 webhook → getDatasetItems 로 비동기 처리.

const BASE = "https://api.apify.com/v2";

export class ApifyClient {
  constructor(private token: string) {
    if (!token) throw new Error("APIFY_TOKEN 이 필요합니다.");
  }

  /** 동기 실행 후 데이터셋 아이템 배열을 그대로 반환 (PoC용). */
  async runSyncGetItems(actorId: string, input: unknown, opts?: { timeoutSecs?: number }): Promise<unknown[]> {
    const url = new URL(`${BASE}/acts/${encodeURIComponent(actorId)}/run-sync-get-dataset-items`);
    url.searchParams.set("token", this.token);
    if (opts?.timeoutSecs) url.searchParams.set("timeout", String(opts.timeoutSecs));
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input ?? {}),
    });
    if (!res.ok) {
      throw new Error(`Apify run 실패 (${actorId}): ${res.status} ${await res.text()}`);
    }
    return (await res.json()) as unknown[];
  }

  /** 비동기 실행 시작 (운영). webhook URL 지정 시 완료 알림을 보내준다. */
  async startRun(actorId: string, input: unknown, webhookUrl?: string): Promise<{ runId: string; datasetId: string }> {
    const url = new URL(`${BASE}/acts/${encodeURIComponent(actorId)}/runs`);
    url.searchParams.set("token", this.token);
    if (webhookUrl) {
      const webhooks = [
        { eventTypes: ["ACTOR.RUN.SUCCEEDED", "ACTOR.RUN.FAILED", "ACTOR.RUN.TIMED_OUT"], requestUrl: webhookUrl },
      ];
      url.searchParams.set("webhooks", btoa(JSON.stringify(webhooks)));
    }
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input ?? {}),
    });
    if (!res.ok) throw new Error(`Apify startRun 실패: ${res.status} ${await res.text()}`);
    const data = (await res.json()) as { data: { id: string; defaultDatasetId: string } };
    return { runId: data.data.id, datasetId: data.data.defaultDatasetId };
  }

  /** run 상태 폴링(reconciler 용). SUCCEEDED/FAILED 등 + 데이터셋 id 반환. */
  async getRun(runId: string): Promise<{ status: string; datasetId: string } | null> {
    const url = new URL(`${BASE}/actor-runs/${encodeURIComponent(runId)}`);
    url.searchParams.set("token", this.token);
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as { data?: { status?: string; defaultDatasetId?: string } };
    if (!data.data?.status) return null;
    return { status: data.data.status, datasetId: data.data.defaultDatasetId ?? "" };
  }

  async getDatasetItems(datasetId: string): Promise<unknown[]> {
    const url = new URL(`${BASE}/datasets/${datasetId}/items`);
    url.searchParams.set("token", this.token);
    url.searchParams.set("clean", "true");
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Apify dataset fetch 실패: ${res.status}`);
    return (await res.json()) as unknown[];
  }
}
