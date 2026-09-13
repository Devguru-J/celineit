// 최소 Apify REST 클라이언트.
// PoC: run-sync-get-dataset-items 로 동기 실행 후 결과를 바로 받는다.
// 운영: startRun(webhook) → 완료 webhook → getDatasetItems 로 비동기 처리.

const BASE = "https://api.apify.com/v2";

/** 네트워크 오류·429·5xx 처럼 재시도로 풀릴 수 있는 실패. 호출측은 run 을 error 로 확정하지 말고 나중에 다시 시도한다. */
export class ApifyTransientError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = "ApifyTransientError";
  }
}

export function isTransientError(err: unknown): boolean {
  if (err instanceof ApifyTransientError) return true;
  // fetch 자체가 실패하면 TypeError(network) 로 떨어진다.
  return err instanceof TypeError;
}

const RETRY_DELAYS_MS = [500, 2000];

// 429/5xx/네트워크 오류는 짧게 재시도한다. 결제된 데이터셋을 일시 오류 한 번에 잃지 않기 위함.
async function fetchWithRetry(input: URL, init?: RequestInit, label = "apify"): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt - 1]));
    try {
      const res = await fetch(input, init);
      if (res.status === 429 || res.status >= 500) {
        lastErr = new ApifyTransientError(`${label}: HTTP ${res.status}`, res.status);
        continue;
      }
      return res;
    } catch (err) {
      lastErr = err instanceof TypeError ? new ApifyTransientError(`${label}: ${err.message}`) : err;
      if (!(err instanceof TypeError)) throw err;
    }
  }
  throw lastErr;
}

export class ApifyClient {
  constructor(private token: string) {
    if (!token) throw new Error("APIFY_TOKEN 이 필요합니다.");
  }

  /** 동기 실행 후 데이터셋 아이템 배열을 그대로 반환 (PoC용). 실행 자체는 재시도하지 않는다(중복 과금 방지). */
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

  /** 비동기 실행 시작 (운영). webhook URL 지정 시 완료 알림을 보내준다. 시작 요청은 재시도하지 않는다(중복 run 방지). */
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

  /** run 상태 폴링(reconciler 용). SUCCEEDED/FAILED 등 + 데이터셋 id 반환. 조회 불가(404 등)면 null. */
  async getRun(runId: string): Promise<{ status: string; datasetId: string } | null> {
    const url = new URL(`${BASE}/actor-runs/${encodeURIComponent(runId)}`);
    url.searchParams.set("token", this.token);
    const res = await fetchWithRetry(url, undefined, "getRun");
    if (!res.ok) return null;
    const data = (await res.json()) as { data?: { status?: string; defaultDatasetId?: string } };
    if (!data.data?.status) return null;
    return { status: data.data.status, datasetId: data.data.defaultDatasetId ?? "" };
  }

  /** 데이터셋 전체 아이템. 일시 오류는 재시도 후 ApifyTransientError 로 던진다(호출측이 run 을 보류). */
  async getDatasetItems(datasetId: string): Promise<unknown[]> {
    const url = new URL(`${BASE}/datasets/${datasetId}/items`);
    url.searchParams.set("token", this.token);
    url.searchParams.set("clean", "true");
    const res = await fetchWithRetry(url, undefined, "getDatasetItems");
    if (!res.ok) throw new Error(`Apify dataset fetch 실패: ${res.status}`);
    return (await res.json()) as unknown[];
  }
}
