// Supabase Auth 연동 (서버 전용).
// SDK 없이 GoTrue REST 를 직접 호출한다 — 로그인(password grant)과 세션 쿠키 생성만.
// JWT 검증은 workers/auth-gate.ts 가 공개 JWKS 로 수행한다.
// 설계: docs/superpowers/specs/2026-07-12-supabase-auth-login-design.md
import { AsyncLocalStorage } from "node:async_hooks";

type AuthConfig = { url: string; apiKey: string };

// 워커 엔트리에서 요청별로 주입 (collector/webshare 와 동일 패턴)
const authContext = new AsyncLocalStorage<AuthConfig | undefined>();
export function runWithSupabaseAuth<T>(
  url: string | undefined,
  apiKey: string | undefined,
  cb: () => T,
): T {
  return authContext.run(url && apiKey ? { url, apiKey } : undefined, cb);
}
function getConfig(): AuthConfig | null {
  return authContext.getStore() ?? null;
}

export type TokenPair = { accessToken: string; refreshToken: string; expiresIn: number };

export async function signInWithPassword(
  email: string,
  password: string,
): Promise<{ ok: true; tokens: TokenPair } | { ok: false; error: string }> {
  const cfg = getConfig();
  if (!cfg) {
    return { ok: false, error: "인증 서버가 설정되지 않았습니다 (SUPABASE_URL/KEY 미설정)." };
  }
  let res: Response;
  try {
    res = await fetch(`${cfg.url}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: cfg.apiKey, "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    return { ok: false, error: "로그인 처리에 실패했습니다. 잠시 후 다시 시도해 주세요." };
  }
  if (!res.ok) {
    // 400 invalid_grant = 자격증명 오류. 그 외(429 등)는 일반 오류 문구.
    if (res.status === 400 || res.status === 401) {
      return { ok: false, error: "이메일 또는 비밀번호가 올바르지 않습니다." };
    }
    return { ok: false, error: "로그인 처리에 실패했습니다. 잠시 후 다시 시도해 주세요." };
  }
  const body = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };
  if (!body.access_token || !body.refresh_token) {
    return { ok: false, error: "로그인 처리에 실패했습니다. 잠시 후 다시 시도해 주세요." };
  }
  return {
    ok: true,
    tokens: {
      accessToken: body.access_token,
      refreshToken: body.refresh_token,
      expiresIn: body.expires_in ?? 3600,
    },
  };
}

// ── 계정 관리 (Supabase Admin API, service key 필요) ──────────
// /admin/users 화면에서 사용. 전부 서버 전용 — service key 는 클라이언트에 노출되지 않는다.

export type ManagedUser = {
  id: string;
  email: string;
  createdAt: string; // ISO
  lastSignInAt: string | null; // ISO
};

async function adminFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const cfg = getConfig();
  if (!cfg) throw new Error("인증 서버가 설정되지 않았습니다 (SUPABASE_URL/KEY 미설정).");
  return fetch(`${cfg.url}/auth/v1/admin${path}`, {
    ...init,
    headers: {
      apikey: cfg.apiKey,
      authorization: `Bearer ${cfg.apiKey}`,
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

export async function listUsers(): Promise<ManagedUser[]> {
  const res = await adminFetch("/users?page=1&per_page=100");
  if (!res.ok) throw new Error(`계정 목록 조회 실패 (HTTP ${res.status})`);
  const body = (await res.json()) as { users?: any[] };
  return (body.users ?? []).map((u) => ({
    id: String(u.id),
    email: String(u.email ?? ""),
    createdAt: String(u.created_at ?? ""),
    lastSignInAt: u.last_sign_in_at ? String(u.last_sign_in_at) : null,
  }));
}

export async function createUser(email: string, password: string): Promise<{ error?: string }> {
  const res = await adminFetch("/users", {
    method: "POST",
    // email_confirm: 확인 메일 없이 즉시 로그인 가능하게(내부 툴)
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  if (res.ok) return {};
  if (res.status === 422) return { error: "이미 등록된 이메일입니다." };
  const body = (await res.json().catch(() => null)) as { msg?: string; message?: string } | null;
  return { error: body?.msg ?? body?.message ?? `계정 생성 실패 (HTTP ${res.status})` };
}

export async function updateUserPassword(id: string, password: string): Promise<{ error?: string }> {
  const res = await adminFetch(`/users/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify({ password }),
  });
  if (res.ok) return {};
  const body = (await res.json().catch(() => null)) as { msg?: string; message?: string } | null;
  return { error: body?.msg ?? body?.message ?? `비밀번호 변경 실패 (HTTP ${res.status})` };
}

export async function deleteUser(id: string): Promise<{ error?: string }> {
  const res = await adminFetch(`/users/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (res.ok) return {};
  return { error: `계정 삭제 실패 (HTTP ${res.status})` };
}

// ── 세션 쿠키 (순수 함수 — 게이트에서도 import) ────────────────
export const AT_COOKIE = "sb_at"; // access token(JWT). 만료 시 게이트가 rt 로 재발급.
export const RT_COOKIE = "sb_rt"; // refresh token. 30일.
const RT_MAX_AGE = 60 * 60 * 24 * 30;
const BASE = "Path=/; HttpOnly; Secure; SameSite=Lax";

export function sessionCookies(tokens: TokenPair): string[] {
  return [
    `${AT_COOKIE}=${encodeURIComponent(tokens.accessToken)}; ${BASE}; Max-Age=${tokens.expiresIn}`,
    `${RT_COOKIE}=${encodeURIComponent(tokens.refreshToken)}; ${BASE}; Max-Age=${RT_MAX_AGE}`,
  ];
}

export function clearSessionCookies(): string[] {
  return [`${AT_COOKIE}=; ${BASE}; Max-Age=0`, `${RT_COOKIE}=; ${BASE}; Max-Age=0`];
}

export function getCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() === name) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return null;
}
