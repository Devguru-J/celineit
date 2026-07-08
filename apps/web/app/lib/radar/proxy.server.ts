// Webshare 프록시를 통한 GET — Cloudflare Workers의 fetch는 프록시를 못 쓰므로
// cloudflare:sockets connect() + HTTP CONNECT 터널을 직접 구현한다.
// 인스타/틱톡이 CF 데이터센터 IP를 차단하는 문제를 우회(주거용/타지역 IP 경유)한다.
import { AsyncLocalStorage } from "node:async_hooks";
import { connect } from "cloudflare:sockets";
import { cached } from "./http.server";

// ── Webshare API 키 컨텍스트 (collector.server 패턴 동일) ──
const keyContext = new AsyncLocalStorage<string | undefined>();
export function runWithWebshare<T>(key: string | undefined, cb: () => T): T {
  return keyContext.run(key, cb);
}
function getKey(): string | undefined {
  return keyContext.getStore() ?? (typeof process !== "undefined" ? process.env?.WEBSHARE_API_KEY : undefined);
}

export function proxyEnabled(): boolean {
  return !!getKey();
}

type Proxy = { host: string; port: number; user: string; pass: string };

async function getProxies(): Promise<Proxy[]> {
  const key = getKey();
  if (!key) return [];
  const { data } = await cached("webshare:proxies", false, async () => {
    const res = await fetch(
      "https://proxy.webshare.io/api/v2/proxy/list/?mode=direct&page=1&page_size=25",
      { headers: { Authorization: `Token ${key}` } },
    );
    if (!res.ok) throw new Error(`webshare list ${res.status}`);
    const j: any = await res.json();
    return (j.results ?? [])
      .filter((p: any) => p.valid)
      .map((p: any) => ({ host: p.proxy_address, port: p.port, user: p.username, pass: p.password }));
  });
  return data;
}

// ── HTTP 응답 파서 유틸 ──────────────────────────────
function concat(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}

function indexOfDoubleCRLF(buf: Uint8Array, from = 0): number {
  for (let i = from; i + 3 < buf.length; i++) {
    if (buf[i] === 13 && buf[i + 1] === 10 && buf[i + 2] === 13 && buf[i + 3] === 10) return i;
  }
  return -1;
}
function indexOfCRLF(buf: Uint8Array, from: number): number {
  for (let i = from; i + 1 < buf.length; i++) if (buf[i] === 13 && buf[i + 1] === 10) return i;
  return -1;
}

// 프록시 CONNECT 응답 헤더를 \r\n\r\n 까지 읽는다.
async function readConnectStatus(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<string> {
  const chunks: Uint8Array[] = [];
  while (true) {
    const { value, done } = await reader.read();
    if (value) chunks.push(value);
    const buf = concat(chunks);
    const end = indexOfDoubleCRLF(buf);
    if (end >= 0) return new TextDecoder().decode(buf.slice(0, end));
    if (done) return new TextDecoder().decode(buf);
  }
}

// 응답을 읽되 Content-Length가 있으면 그만큼만 읽고 즉시 종료(EOF 대기 안 함).
// chunked면 종료 청크까지, 둘 다 없으면 EOF까지.
async function readResponse(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  let size = 0;
  let headerEnd = -1;
  let contentLength = -1;
  let chunked = false;
  let bodyStart = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (value) {
      chunks.push(value);
      size += value.length;
    }
    if (headerEnd < 0) {
      const buf = concat(chunks);
      headerEnd = indexOfDoubleCRLF(buf);
      if (headerEnd >= 0) {
        const h = new TextDecoder().decode(buf.slice(0, headerEnd)).toLowerCase();
        const m = h.match(/content-length:\s*(\d+)/);
        contentLength = m ? parseInt(m[1], 10) : -1;
        chunked = /transfer-encoding:\s*chunked/.test(h);
        bodyStart = headerEnd + 4;
      }
    }
    if (headerEnd >= 0 && contentLength >= 0 && size - bodyStart >= contentLength) break;
    if (headerEnd >= 0 && chunked && endsWithZeroChunk(concat(chunks), bodyStart)) break;
    if (done) break;
  }
  return concat(chunks);
}

// chunked 본문이 종료 청크("0\r\n\r\n")로 끝났는지
function endsWithZeroChunk(buf: Uint8Array, bodyStart: number): boolean {
  if (buf.length - bodyStart < 5) return false;
  const tail = buf.slice(buf.length - 5);
  return tail[0] === 48 && tail[1] === 13 && tail[2] === 10 && tail[3] === 13 && tail[4] === 10;
}

function dechunk(body: Uint8Array): Uint8Array {
  const out: Uint8Array[] = [];
  let i = 0;
  while (i < body.length) {
    const nl = indexOfCRLF(body, i);
    if (nl < 0) break;
    const sizeStr = new TextDecoder().decode(body.slice(i, nl)).split(";")[0].trim();
    const size = parseInt(sizeStr, 16);
    if (!Number.isFinite(size) || size <= 0) break;
    const start = nl + 2;
    out.push(body.slice(start, start + size));
    i = start + size + 2; // 데이터 + 뒤 CRLF
  }
  return concat(out);
}

function parseBody(raw: Uint8Array): string {
  const end = indexOfDoubleCRLF(raw);
  if (end < 0) return new TextDecoder().decode(raw);
  const headerText = new TextDecoder().decode(raw.slice(0, end)).toLowerCase();
  let body: Uint8Array<ArrayBufferLike> = raw.slice(end + 4);
  if (/transfer-encoding:\s*chunked/.test(headerText)) body = dechunk(body);
  return new TextDecoder().decode(body);
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("proxy timeout")), ms);
    p.then((v) => {
      clearTimeout(t);
      resolve(v);
    }).catch((e) => {
      clearTimeout(t);
      reject(e);
    });
  });
}

// 단일 프록시로 CONNECT 터널을 열고 GET 수행 → 본문 텍스트 반환
async function tunnelGet(
  url: string,
  headers: Record<string, string>,
  proxy: Proxy,
  timeoutMs: number,
): Promise<string> {
  const u = new URL(url);
  const host = u.hostname;
  const port = u.port || "443";
  const path = (u.pathname || "/") + (u.search || "");
  const enc = new TextEncoder();

  const socket = connect(
    { hostname: proxy.host, port: proxy.port },
    { secureTransport: "starttls", allowHalfOpen: false },
  );

  const run = async (): Promise<string> => {
    // 1) CONNECT (평문)
    const w = socket.writable.getWriter();
    const r = socket.readable.getReader();
    const auth = btoa(`${proxy.user}:${proxy.pass}`);
    await w.write(
      enc.encode(
        `CONNECT ${host}:${port} HTTP/1.1\r\nHost: ${host}:${port}\r\n` +
          `Proxy-Authorization: Basic ${auth}\r\nProxy-Connection: Keep-Alive\r\n\r\n`,
      ),
    );
    const status = await readConnectStatus(r);
    if (!/ 200[ \r]/.test(status.split("\n")[0] + " ")) {
      throw new Error("CONNECT 실패: " + status.split("\n")[0]);
    }
    r.releaseLock();
    w.releaseLock();

    // 2) 타깃과 TLS
    const tls = (socket as any).startTls({ expectedServerHostname: host });
    const tw = tls.writable.getWriter();
    const tr = tls.readable.getReader();
    const hdr = Object.entries(headers)
      .map(([k, v]) => `${k}: ${v}`)
      .join("\r\n");
    await tw.write(
      enc.encode(
        `GET ${path} HTTP/1.1\r\nHost: ${host}\r\n` +
          (hdr ? hdr + "\r\n" : "") +
          `Accept-Encoding: identity\r\nConnection: close\r\n\r\n`,
      ),
    );
    const raw = await readResponse(tr);
    // 상태 코드 확인 — 429/403 등은 실패로 던져 다음 프록시로 재시도.
    const statusLine = new TextDecoder().decode(raw.slice(0, Math.min(raw.length, 40)));
    const code = parseInt(statusLine.split(" ")[1] ?? "0", 10);
    if (code < 200 || code >= 400) throw new Error(`upstream ${code}`);
    return parseBody(raw);
  };

  try {
    return await withTimeout(run(), timeoutMs);
  } finally {
    try {
      await socket.close();
    } catch {
      /* ignore */
    }
  }
}

// 프록시 몇 개를 순회 시도하며 GET. 실패 시 예외.
// 동시 요청이 서로 다른 프록시 IP를 쓰도록 라운드로빈(인스타 IP당 레이트리밋 회피).
let rrIndex = 0;

export async function proxyGetText(
  url: string,
  headers: Record<string, string> = {},
  timeoutMs = 15000,
): Promise<string> {
  const proxies = await getProxies();
  if (!proxies.length) throw new Error("프록시 없음(WEBSHARE_API_KEY 확인)");
  const start = rrIndex++ % proxies.length;
  const tries = Math.min(4, proxies.length);
  let lastErr: unknown;
  for (let k = 0; k < tries; k++) {
    const proxy = proxies[(start + k) % proxies.length];
    try {
      return await tunnelGet(url, headers, proxy, timeoutMs);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error("all proxies failed");
}

export async function proxyGetJson<T = any>(
  url: string,
  headers: Record<string, string> = {},
  timeoutMs = 15000,
): Promise<T> {
  const text = await proxyGetText(url, headers, timeoutMs);
  return JSON.parse(text) as T;
}
