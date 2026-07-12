// Supabase Auth 세션 게이트. 기존 접근 코드 게이트(access-gate)를 대체한다.
// 매 요청 access token(JWT) 을 공개 JWKS(ES256) 로 로컬 검증 — 네트워크 호출 없음.
// 만료 시 refresh token 으로 조용히 재발급해 통과시키고, 새 쿠키를 응답에 부착한다.
// SUPABASE_URL/SUPABASE_SERVICE_KEY 미설정 시 게이트 off (로컬 dev 편의).
// 설계: docs/superpowers/specs/2026-07-12-supabase-auth-login-design.md
import { createRemoteJWKSet, jwtVerify } from "jose";
import {
  AT_COOKIE,
  RT_COOKIE,
  getCookie,
  sessionCookies,
  clearSessionCookies,
  type TokenPair,
} from "../app/lib/auth.server";

// JWKS 원격 세트는 isolate 수명 동안 캐시된다(jose 가 내부적으로 키 캐싱/쿨다운 처리).
let jwksCache: { url: string; jwks: ReturnType<typeof createRemoteJWKSet> } | null = null;
function jwksFor(supabaseUrl: string) {
  if (jwksCache?.url !== supabaseUrl) {
    jwksCache = {
      url: supabaseUrl,
      jwks: createRemoteJWKSet(new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`)),
    };
  }
  return jwksCache.jwks;
}

async function refreshSession(
  supabaseUrl: string,
  apiKey: string,
  refreshToken: string,
): Promise<TokenPair | null> {
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: { apikey: apiKey, "content-type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };
    if (!body.access_token || !body.refresh_token) return null;
    return {
      accessToken: body.access_token,
      refreshToken: body.refresh_token,
      expiresIn: body.expires_in ?? 3600,
    };
  } catch {
    return null;
  }
}

export type GateResult = {
  /** 차단 응답 (리다이렉트/401). 있으면 즉시 반환할 것. */
  block?: Response;
  /** 토큰 재발급 시 최종 응답에 append 할 Set-Cookie 들. */
  setCookies?: string[];
};

export async function authGate(request: Request, env: Env): Promise<GateResult> {
  const supabaseUrl = env.SUPABASE_URL;
  const apiKey = env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !apiKey) return {}; // 게이트 off

  const url = new URL(request.url);
  // 로그인/가입/로그아웃은 미인증 상태에서 접근 가능해야 한다.
  if (url.pathname === "/login" || url.pathname === "/signup" || url.pathname === "/logout") return {};

  const accessToken = getCookie(request, AT_COOKIE);
  if (accessToken) {
    try {
      await jwtVerify(accessToken, jwksFor(supabaseUrl));
      return {}; // 유효 세션
    } catch {
      // 만료/위조 → refresh 시도로 폴스루
    }
  }

  const refreshToken = getCookie(request, RT_COOKIE);
  if (refreshToken) {
    const tokens = await refreshSession(supabaseUrl, apiKey, refreshToken);
    if (tokens) return { setCookies: sessionCookies(tokens) };
  }

  // 미인증: 브라우저 내비게이션은 로그인으로, fetch/API 는 401
  // (radar API 를 외부에서 직접 두드려 프록시 대역폭을 태우는 경로 차단).
  const isNav =
    request.method === "GET" && (request.headers.get("accept") ?? "").includes("text/html");
  if (isNav) {
    const next = encodeURIComponent(url.pathname + url.search);
    const headers = new Headers({ location: `${url.origin}/login?next=${next}` });
    // 죽은 세션 쿠키가 남아 있으면 정리
    for (const c of clearSessionCookies()) headers.append("set-cookie", c);
    return { block: new Response(null, { status: 302, headers }) };
  }
  return { block: Response.json({ error: "unauthorized" }, { status: 401 }) };
}
