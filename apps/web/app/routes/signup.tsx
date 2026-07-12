// 회원가입: 가입 코드(SIGNUP_CODE)를 아는 사람만 계정 생성 가능.
// 서버 action 이 코드 검증 후 Admin API 로 생성 + 자동 로그인. (게이트 제외 경로)
import { Form, Link, redirect, useActionData, useNavigation } from "react-router";
import { sessionCookies, signUpWithCode } from "~/lib/auth.server";

export function meta() {
  return [{ title: "Celine Intelligence · 회원가입" }];
}

export async function action({ request }: { request: Request }) {
  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const passwordConfirm = String(form.get("passwordConfirm") ?? "");
  const code = String(form.get("code") ?? "");

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "이메일 형식이 올바르지 않습니다." };
  if (password.length < 8) return { error: "비밀번호는 8자 이상이어야 합니다." };
  if (password !== passwordConfirm) return { error: "비밀번호가 서로 일치하지 않습니다." };

  const result = await signUpWithCode(email, password, code);
  if (!result.ok) return { error: result.error };
  const headers = new Headers();
  for (const c of sessionCookies(result.tokens)) headers.append("set-cookie", c);
  return redirect("/", { headers });
}

const GOLD = "#C8A45D";
const inputCls =
  "w-full rounded-lg border border-white/15 bg-[#17171A] px-3.5 py-2.5 text-[14px] text-[#E7E2DC] placeholder:text-white/25 focus:border-[#C8A45D] focus:outline-none";
const labelCls = "mb-1.5 block text-[12.5px] font-semibold text-white/70";

export default function Signup() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const submitting = navigation.state !== "idle";

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#141416] px-6 text-[#E7E2DC]">
      <div className="w-full max-w-[380px] py-16">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded border border-white/10 bg-black">
            <svg viewBox="0 0 32 32" className="h-5 w-5">
              <path d="M9 21h14v3H9zM9 15h10v3H9zM9 9h14v3H9z" fill={GOLD} />
            </svg>
          </span>
          <span className="text-[17px] font-semibold tracking-tight">
            <span style={{ color: GOLD }}>Celine</span> Intelligence
          </span>
        </div>
        <div className="mt-4 flex items-center gap-1.5">
          <span className="h-[3px] w-8" style={{ background: GOLD }} />
          <span className="h-[3px] w-2.5 bg-white/25" />
        </div>

        <h2 className="mt-5 text-[26px] font-bold tracking-tight">회원가입</h2>
        <p className="mt-2 text-[13.5px] leading-relaxed text-white/50">
          팀에서 공유받은 가입 코드가 있어야 계정을 만들 수 있습니다.
        </p>

        <Form method="post" className="mt-8 space-y-4">
          <div>
            <label htmlFor="email" className={labelCls}>이메일 주소</label>
            <input id="email" name="email" type="email" required autoFocus autoComplete="username" placeholder="name@company.com" className={inputCls} />
          </div>
          <div>
            <label htmlFor="password" className={labelCls}>비밀번호 (8자 이상)</label>
            <input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" placeholder="비밀번호" className={inputCls} />
          </div>
          <div>
            <label htmlFor="passwordConfirm" className={labelCls}>비밀번호 확인</label>
            <input id="passwordConfirm" name="passwordConfirm" type="password" required minLength={8} autoComplete="new-password" placeholder="비밀번호 다시 입력" className={inputCls} />
          </div>
          <div>
            <label htmlFor="code" className={labelCls}>가입 코드</label>
            <input id="code" name="code" type="text" required autoComplete="off" placeholder="팀에서 공유받은 코드" className={inputCls} />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg py-2.5 text-[14px] font-bold text-[#221A06] transition-[filter] hover:brightness-105 disabled:opacity-60"
            style={{ background: GOLD }}
          >
            {submitting ? "생성 중…" : "계정 만들기"}
          </button>
          {actionData?.error && <p className="text-[12.5px] text-[#E08F8F]">{actionData.error}</p>}
        </Form>

        <p className="mt-6 text-center text-[13px] text-white/45">
          이미 계정이 있나요?{" "}
          <Link to="/login" className="font-semibold" style={{ color: GOLD }}>
            로그인
          </Link>
        </p>
      </div>
    </div>
  );
}
