// 트렌드 뷰어 공용 HTTP + Cloudflare Cache API 래퍼.
// 레퍼런스의 urllib(http_get/http_json) + 1시간 인메모리 캐시를 엣지 환경에 맞게 옮김.
import { UA, CACHE_TTL } from "./constants";

type FetchInit = {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
};

// 표준 fetch 래퍼 (UA 기본 부착 + 타임아웃). 실패 시 예외를 던진다.
export async function httpText(url: string, init: FetchInit = {}): Promise<string> {
  const res = await httpRaw(url, init);
  return res.text();
}

export async function httpJson<T = any>(url: string, init: FetchInit = {}): Promise<T> {
  const res = await httpRaw(url, init);
  return (await res.json()) as T;
}

export async function httpRaw(url: string, init: FetchInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), init.timeoutMs ?? 15000);
  try {
    const res = await fetch(url, {
      method: init.method ?? "GET",
      headers: { "User-Agent": UA, ...(init.headers ?? {}) },
      body: init.body,
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
    return res;
  } finally {
    clearTimeout(timeout);
  }
}

// InnerTube 등 JSON POST
export async function postJson<T = any>(
  url: string,
  payload: unknown,
  headers: Record<string, string> = {},
  timeoutMs = 15000,
): Promise<T> {
  return httpJson<T>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(payload),
    timeoutMs,
  });
}

// 에러를 삼키고 fallback 반환 (레퍼런스의 try/except → [] 패턴).
export async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

// ── Cloudflare Cache API 기반 1시간 캐시 ────────────────────────
// key: 안정적인 문자열(계정목록/필터 반영). force=true면 캐시 우회 후 갱신.
// 반환: { data, fetchedAt(초) }. Cache API가 없는 환경(로컬 dev 등)에선 매번 fetch.

type Cached<T> = { data: T; fetchedAt: number };

declare const caches: { default?: Cache } | undefined;

function cacheStore(): Cache | null {
  try {
    return typeof caches !== "undefined" && caches?.default ? caches.default : null;
  } catch {
    return null;
  }
}

export async function cached<T>(
  key: string,
  force: boolean,
  fetchFn: () => Promise<T>,
): Promise<Cached<T>> {
  const store = cacheStore();
  // https 스킴의 안정 키(실제 네트워크 요청은 아님)
  const cacheKey = new Request(`https://radar.cache/${encodeURIComponent(key)}`);

  if (store && !force) {
    const hit = await store.match(cacheKey);
    if (hit) {
      const body = (await hit.json()) as Cached<T>;
      return body;
    }
  }

  const data = await fetchFn();
  const payload: Cached<T> = { data, fetchedAt: Math.floor(Date.now() / 1000) };

  if (store) {
    const res = new Response(JSON.stringify(payload), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": `public, max-age=${CACHE_TTL}`,
      },
    });
    // waitUntil 없이도 put은 진행됨(엣지에서 백그라운드 처리).
    try {
      await store.put(cacheKey, res);
    } catch {
      /* 캐시 실패는 무시 */
    }
  }
  return payload;
}
