// 로그인 (Supabase Auth password grant). 스플릿 레이아웃: 좌측 브랜드 패널 + 우측 폼.
// 게이트(workers/auth-gate.ts)가 이 경로만 미인증 통과시킨다.
import { Form, redirect, useActionData, useNavigation, useSearchParams } from "react-router";
import { sessionCookies, signInWithPassword } from "~/lib/auth.server";

export function meta() {
  return [{ title: "Celine Intelligence · 로그인" }];
}

// open redirect 방지: 사이트 내부 경로만 허용
function safeNext(v: string | null): string {
  return v && v.startsWith("/") && !v.startsWith("//") ? v : "/";
}

export async function action({ request }: { request: Request }) {
  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const next = safeNext(String(form.get("next") ?? "/"));
  if (!email || !password) return { error: "이메일과 비밀번호를 모두 입력해 주세요." };
  const result = await signInWithPassword(email, password);
  if (!result.ok) return { error: result.error };
  const headers = new Headers();
  for (const c of sessionCookies(result.tokens)) headers.append("set-cookie", c);
  return redirect(next, { headers });
}

const GOLD = "#C8A45D";

export default function Login() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const [searchParams] = useSearchParams();
  const next = safeNext(searchParams.get("next"));
  const submitting = navigation.state !== "idle";

  return (
    <div className="flex min-h-screen bg-[#141416] text-[#E7E2DC]">
      {/* ── 좌측 브랜드 패널 (데스크톱 전용) ─────────────────── */}
      <div className="relative hidden flex-1 overflow-hidden lg:block">
        {/* 배경: 그라디언트 + 그리드. /login-hero.jpg 를 public 에 넣으면 사진이 깔린다. */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#1E1C18] via-[#17171A] to-[#0F0F11]" />
        <div
          className="absolute inset-0 bg-cover bg-center opacity-45"
          style={{ backgroundImage: "url(/login-hero.jpg)" }}
        />
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
            backgroundSize: "56px 56px",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#141416] via-transparent to-[#141416]/60" />
        <div
          className="absolute -left-40 top-1/3 h-[480px] w-[480px] rounded-full opacity-20 blur-3xl"
          style={{ background: `radial-gradient(circle, ${GOLD}, transparent 70%)` }}
        />

        {/* 상단 로고 */}
        <div className="absolute left-10 top-8 flex items-center gap-3">
          <LogoMark />
          <span className="font-semibold tracking-tight">
            <span style={{ color: GOLD }}>Celine</span> Intelligence
          </span>
          <span className="border-l border-white/20 pl-3 text-[11px] font-medium tracking-[0.2em] text-white/50">
            K-BEAUTY MONITOR
          </span>
        </div>

        {/* 중앙 헤드라인 */}
        <div className="absolute left-10 top-1/2 max-w-lg -translate-y-1/2">
          <div className="mb-4 flex items-center gap-2">
            <span className="h-[3px] w-8" style={{ background: GOLD }} />
            <span className="h-[3px] w-3 bg-white/30" />
            <span className="text-[12px] font-semibold tracking-wide text-white/70">
              Celine Intelligence · Japan Market
            </span>
          </div>
          <h1 className="text-[40px] font-bold leading-[1.25] tracking-tight">
            일본 K-뷰티 경쟁의
            <br />
            흐름을 <span style={{ color: GOLD }}>한눈에</span>.
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-white/60">
            일본 시장의 K-뷰티 브랜드 광고·콘텐츠·트렌드를 매일 수집해 비교하는 내부
            인텔리전스 도구입니다.
          </p>
          <div className="mt-7 inline-block border border-white/15 bg-white/5 px-4 py-2 text-[11px] font-semibold tracking-[0.18em] text-white/70">
            META ADS · INSTAGRAM · X · TIKTOK
          </div>
        </div>

        {/* 하단 캡션 */}
        <div className="absolute bottom-7 left-10 text-[12px] text-white/35">
          Feed · Winning Ads · Trends · Radar
        </div>
      </div>

      {/* ── 우측 로그인 패널 ─────────────────────────────────── */}
      <div className="flex w-full items-center justify-center bg-[#111113] px-6 lg:w-[520px] lg:shrink-0 lg:border-l lg:border-white/5">
        <div className="w-full max-w-[360px] py-16">
          <div className="flex items-center gap-3">
            <LogoMark />
            <span className="text-[17px] font-semibold tracking-tight">
              <span style={{ color: GOLD }}>Celine</span> Intelligence
            </span>
          </div>
          <div className="mt-4 flex items-center gap-1.5">
            <span className="h-[3px] w-8" style={{ background: GOLD }} />
            <span className="h-[3px] w-2.5 bg-white/25" />
          </div>

          <h2 className="mt-5 text-[26px] font-bold tracking-tight">로그인</h2>
          <p className="mt-2 text-[13.5px] leading-relaxed text-white/50">
            내부 도구입니다. 권한이 부여된 계정으로만 접근할 수 있습니다.
          </p>

          <Form method="post" className="mt-8 space-y-5">
            <input type="hidden" name="next" value={next} />
            <div>
              <label htmlFor="email" className="mb-1.5 block text-[12.5px] font-semibold text-white/70">
                이메일 주소
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoFocus
                autoComplete="username"
                placeholder="name@company.com"
                className="w-full rounded-lg border border-white/15 bg-[#17171A] px-3.5 py-2.5 text-[14px] text-[#E7E2DC] placeholder:text-white/25 focus:border-[#C8A45D] focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="password" className="mb-1.5 block text-[12.5px] font-semibold text-white/70">
                비밀번호
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                placeholder="비밀번호를 입력하세요"
                className="w-full rounded-lg border border-white/15 bg-[#17171A] px-3.5 py-2.5 text-[14px] text-[#E7E2DC] placeholder:text-white/25 focus:border-[#C8A45D] focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg py-2.5 text-[14px] font-bold text-[#221A06] transition-[filter] hover:brightness-105 disabled:opacity-60"
              style={{ background: GOLD }}
            >
              {submitting ? "확인 중…" : "로그인 →"}
            </button>
            {actionData?.error && (
              <p className="text-[12.5px] text-[#E08F8F]">{actionData.error}</p>
            )}
          </Form>

          <div className="mt-8 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-[12.5px] leading-relaxed text-white/45">
            계정이 없나요? 가입 코드가 있다면{" "}
            <a href="/signup" className="font-semibold" style={{ color: GOLD }}>
              회원가입
            </a>
            할 수 있습니다. 비밀번호를 잊은 경우 관리자에게 문의하세요.
          </div>
        </div>
      </div>
    </div>
  );
}

function LogoMark() {
  return (
    <span className="flex h-9 w-9 items-center justify-center rounded border border-white/10 bg-black">
      <svg viewBox="0 0 32 32" className="h-5 w-5">
        <path d="M9 21h14v3H9zM9 15h10v3H9zM9 9h14v3H9z" fill={GOLD} />
      </svg>
    </span>
  );
}
