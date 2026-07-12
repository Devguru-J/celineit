// 로그아웃: 세션 쿠키 삭제 후 로그인 페이지로. (게이트 제외 경로)
import { redirect } from "react-router";
import { clearSessionCookies } from "~/lib/auth.server";

function logout() {
  const headers = new Headers();
  for (const c of clearSessionCookies()) headers.append("set-cookie", c);
  return redirect("/login", { headers });
}

export const loader = logout;
export const action = logout;
