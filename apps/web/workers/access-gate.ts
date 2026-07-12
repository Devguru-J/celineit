// 사이트 전역 접근 코드 게이트.
// SITE_ACCESS_CODE secret 이 설정돼 있으면 모든 요청이 이 게이트를 거친다(미설정=off, 로컬 dev).
// 배경: 앱에 인증이 전혀 없어 /radar/api/* 를 아무나 호출해 유료 프록시 대역폭을
// 소모시킬 수 있었다. 내부 툴이므로 팀 공유 접근 코드 1개 + 30일 쿠키로 충분.
const COOKIE = "celine_access";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30일

async function sha256Hex(s: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// 쿠키에는 코드 원문이 아니라 해시를 저장한다(쿠키 유출 시 코드 노출 방지).
let cachedHash: { code: string; hash: string } | null = null;
async function expectedCookieValue(code: string): Promise<string> {
  if (cachedHash?.code === code) return cachedHash.hash;
  const hash = await sha256Hex(`celine-access:${code}`);
  cachedHash = { code, hash };
  return hash;
}

function getCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return null;
}

// open redirect 방지: 사이트 내부 경로만 허용
function safeNext(v: string | null): string {
  return v && v.startsWith("/") && !v.startsWith("//") ? v : "/";
}

function loginPage(next: string, error?: string): Response {
  const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>Celine Intelligence · 접근 코드</title>
<style>
  * { box-sizing: border-box; margin: 0; }
  body { min-height: 100vh; display: grid; place-items: center; background: #17171a; color: #e7e2dc;
    font-family: Pretendard, -apple-system, "Apple SD Gothic Neo", sans-serif; }
  .card { width: min(360px, 90vw); background: #1f1f23; border: 1px solid #34343a; border-radius: 16px; padding: 32px 28px; }
  h1 { font-size: 17px; font-weight: 700; letter-spacing: -0.01em; }
  h1 span { color: #d4b269; }
  p { margin-top: 6px; font-size: 13px; color: #9b968f; }
  input { width: 100%; margin-top: 20px; padding: 11px 14px; border-radius: 10px; border: 1px solid #44444b;
    background: #17171a; color: #e7e2dc; font-size: 14px; outline: none; }
  input:focus { border-color: #d4b269; }
  button { width: 100%; margin-top: 12px; padding: 11px; border: 0; border-radius: 10px; background: #d4b269;
    color: #221a06; font-size: 14px; font-weight: 700; cursor: pointer; }
  button:hover { filter: brightness(1.06); }
  .err { margin-top: 12px; font-size: 12.5px; color: #e08f8f; }
</style>
</head>
<body>
  <form class="card" method="post" action="/login">
    <h1><span>Celine</span> Intelligence</h1>
    <p>내부 도구입니다. 접근 코드를 입력해 주세요.</p>
    <input type="password" name="code" placeholder="접근 코드" autofocus autocomplete="current-password" />
    <input type="hidden" name="next" value="${next.replace(/"/g, "&quot;")}" />
    <button type="submit">입장</button>
    ${error ? `<div class="err">${error}</div>` : ""}
  </form>
</body>
</html>`;
  return new Response(html, {
    status: error ? 401 : 200,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

/** 통과 시 null, 차단/처리 시 Response 를 반환한다. */
export async function accessGate(request: Request, env: Env): Promise<Response | null> {
  const code = env.SITE_ACCESS_CODE;
  if (!code) return null; // 게이트 off (로컬 dev 등)

  const url = new URL(request.url);
  const expected = await expectedCookieValue(code);
  const authed = getCookie(request, COOKIE) === expected;

  if (url.pathname === "/login") {
    if (request.method === "POST") {
      const form = await request.formData().catch(() => null);
      const input = String(form?.get("code") ?? "");
      const next = safeNext(String(form?.get("next") ?? "/"));
      const inputHash = await sha256Hex(`celine-access:${input}`);
      if (inputHash === expected) {
        return new Response(null, {
          status: 303,
          headers: {
            location: next,
            "set-cookie": `${COOKIE}=${expected}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}`,
          },
        });
      }
      return loginPage(next, "접근 코드가 올바르지 않습니다.");
    }
    if (authed) return Response.redirect(new URL("/", url).toString(), 302);
    return loginPage(safeNext(url.searchParams.get("next")));
  }

  if (authed) return null;

  // 미인증: 브라우저 내비게이션은 로그인으로 보내고, fetch/API 는 401 로 끊는다
  // (radar API 를 외부에서 직접 두드려 프록시 대역폭을 태우는 경로 차단).
  const isNav = request.method === "GET" && (request.headers.get("accept") ?? "").includes("text/html");
  if (isNav) {
    const next = encodeURIComponent(url.pathname + url.search);
    return Response.redirect(`${url.origin}/login?next=${next}`, 302);
  }
  return Response.json({ error: "unauthorized" }, { status: 401 });
}
