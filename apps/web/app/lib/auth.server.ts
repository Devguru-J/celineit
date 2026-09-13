// Supabase Auth 연동 (서버 전용).
// SDK 없이 GoTrue REST 를 직접 호출한다 — 로그인(password grant)과 세션 쿠키 생성만.
// JWT 검증은 workers/auth-gate.ts 가 공개 JWKS 로 수행한다.
// 설계: docs/superpowers/specs/2026-07-12-supabase-auth-login-design.md
import { AsyncLocalStorage } from "node:async_hooks";

type AuthConfig = { url: string; apiKey: string; signupCode?: string; adminEmails: string[] };

// 워커 엔트리에서 요청별로 주입 (collector/webshare 와 동일 패턴)
const authContext = new AsyncLocalStorage<AuthConfig | undefined>();
export function runWithSupabaseAuth<T>(
  url: string | undefined,
  apiKey: string | undefined,
  signupCode: string | undefined,
  cb: () => T,
  opts: { adminEmails?: string } = {},
): T {
  const adminEmails = (opts.adminEmails ?? "")
    .split(/[,\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return authContext.run(url && apiKey ? { url, apiKey, signupCode, adminEmails } : undefined, cb);
}
function getConfig(): AuthConfig | null {
  return authContext.getStore() ?? null;
}

// ── 관리자 권한 ─────────────────────────────────────────────
// ADMIN_EMAILS(쉼표 구분) 가 설정되면 그 계정만 /admin/* (계정 관리·유료 수집 실행) 에 접근한다.
// 미설정이면 기존처럼 로그인한 모든 계정이 관리자(소규모 내부 팀 기본값).
export function isAdminRequest(request: Request): boolean {
  const cfg = getConfig();
  if (!cfg || cfg.adminEmails.length === 0) return true;
  const email = jwtEmail(getCookie(request, AT_COOKIE) ?? "");
  return !!email && cfg.adminEmails.includes(email.toLowerCase());
}
export function requireAdmin(request: Request): void {
  if (!isAdminRequest(request)) throw new Response("Forbidden", { status: 403 });
}

// ── 가입 코드 무차별 대입 완화 ──────────────────────────────
// isolate 단위 인메모리 카운터라 완전한 방어는 아니지만, 요청 속도로 코드를 돌려보는 시도를
// 크게 늦춘다(같은 isolate 에서 10분에 IP 당 10회).
const SIGNUP_WINDOW_MS = 10 * 60_000;
const SIGNUP_MAX_ATTEMPTS = 10;
const signupAttempts = new Map<string, { count: number; resetAt: number }>();
export function signupRateLimited(ip: string): boolean {
  const now = Date.now();
  const cur = signupAttempts.get(ip);
  if (!cur || cur.resetAt < now) {
    signupAttempts.set(ip, { count: 1, resetAt: now + SIGNUP_WINDOW_MS });
    if (signupAttempts.size > 1000) signupAttempts.clear(); // 메모리 상한
    return false;
  }
  cur.count++;
  return cur.count > SIGNUP_MAX_ATTEMPTS;
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

// ── 회원가입 (가입 코드 검증 → Admin API 생성 → 자동 로그인) ──
// Supabase 의 공개 signup 은 쓰지 않는다(대시보드에서 OFF 유지) — 코드를 아는
// 사람만 이 서버 경로로 가입할 수 있고, publishable key 우회 가입 구멍이 없다.
export async function signUpWithCode(
  email: string,
  password: string,
  code: string,
): Promise<{ ok: true; tokens: TokenPair } | { ok: false; error: string }> {
  const cfg = getConfig();
  if (!cfg) return { ok: false, error: "인증 서버가 설정되지 않았습니다." };
  if (!cfg.signupCode) return { ok: false, error: "현재 회원가입이 비활성화되어 있습니다. 관리자에게 문의하세요." };
  if (code.trim().toLowerCase() !== cfg.signupCode.toLowerCase()) {
    return { ok: false, error: "가입 코드가 올바르지 않습니다." };
  }
  const created = await createUser(email, password);
  if (created.error) return { ok: false, error: created.error };
  // 생성 직후 자동 로그인해 세션 쿠키까지 발급한다.
  return signInWithPassword(email, password);
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

/** 서명 검증 없이 JWT payload 의 email 만 읽는다 — 게이트가 검증을 마친 토큰에만 사용할 것. */
export function jwtEmail(token: string): string | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const json = atob(part.replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(json) as { email?: unknown };
    return typeof payload.email === "string" ? payload.email : null;
  } catch {
    return null;
  }
}
