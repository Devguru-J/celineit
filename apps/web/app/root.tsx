import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  isRouteErrorResponse,
  useLocation,
  useRouteError,
  useRouteLoaderData,
} from "react-router";
import type { LinksFunction } from "react-router";
import { AT_COOKIE, getCookie, isAdminRequest, jwtEmail } from "./lib/auth.server";

import "./app.css";
import { MobileNav, Sidebar } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";

export const links: LinksFunction = () => [
  {
    rel: "icon",
    href: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='4' fill='%23000000'/%3E%3Cpath d='M9 21h14v3H9zM9 15h10v3H9zM9 9h14v3H9z' fill='%23C8A45D'/%3E%3C/svg%3E",
  },
  { rel: "preconnect", href: "https://cdn.jsdelivr.net" },
  // 아이콘 폰트는 셀프호스팅 서브셋(app.css @font-face) — 구글 CDN CSS 는
  // 도착 전까지 리거처 텍스트("dashboard")가 노출되는 FOUT 이 있어 제거함.
  {
    rel: "preload",
    href: "/fonts/material-symbols-outlined.woff2",
    as: "font",
    type: "font/woff2",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@latest/dist/web/variable/pretendardvariable-dynamic-subset.min.css",
  },
];

// 게이트(workers/auth-gate.ts)가 이미 서명을 검증한 access token 에서 이메일만 꺼낸다.
export function loader({ request }: { request: Request }) {
  const token = getCookie(request, AT_COOKIE);
  return { userEmail: token ? jwtEmail(token) : null, isAdmin: isAdminRequest(request) };
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" translate="no" className="light">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body className="notranslate bg-background text-on-surface">
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  const { pathname } = useLocation();
  const data = useRouteLoaderData<typeof loader>("root");
  const userEmail = data?.userEmail ?? null;
  const isAdmin = data?.isAdmin ?? true;
  // 로그인/가입 화면은 사이드바/탑바 없는 전체 화면 레이아웃
  if (pathname === "/login" || pathname === "/signup") return <Outlet />;
  return (
    <>
      <Sidebar userEmail={userEmail} isAdmin={isAdmin} />
      <TopBar userEmail={userEmail} />
      <MobileNav />
      <main className="min-h-screen px-0 pb-[calc(76px+env(safe-area-inset-bottom))] pt-14 lg:ml-[248px] lg:pb-0 lg:pt-16">
        <Outlet />
      </main>
    </>
  );
}

// 루트 에러 바운더리 — loader/렌더 예외 시 RR 기본 흰 화면(스택 트레이스 노출) 대신
// 브랜드 톤의 안내 화면을 보여준다. 404 는 별도 문구.
export function ErrorBoundary() {
  const error = useRouteError();
  const isResponse = isRouteErrorResponse(error);
  const status = isResponse ? error.status : 500;
  const title =
    status === 404 ? "페이지를 찾을 수 없습니다" : status === 403 ? "접근 권한이 없습니다" : "문제가 발생했습니다";
  const detail =
    status === 404
      ? "주소가 잘못되었거나 삭제된 항목일 수 있습니다."
      : status === 403
        ? "이 화면은 관리자 계정만 사용할 수 있습니다."
      : isResponse
        ? `${error.status} ${error.statusText || ""}`.trim()
        : error instanceof Error
          ? error.message
          : "알 수 없는 오류";
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-on-surface">
      <div className="w-full max-w-md rounded-xl bg-surface p-8 shadow-[0_1px_3px_rgba(0,0,0,0.4),0_12px_32px_rgba(0,0,0,0.16)]">
        <p className="font-label-muted text-label-muted text-primary">Celine Intelligence · {status}</p>
        <h1 className="mt-2 font-headline-sm text-headline-sm font-bold">{title}</h1>
        <p className="mt-3 break-words font-body-sm text-body-sm text-on-surface-variant">{detail}</p>
        <div className="mt-6 flex gap-2">
          <a href="/" className="rounded-lg bg-primary px-4 py-2 font-body-sm text-body-sm font-semibold text-on-primary">
            요약으로 이동
          </a>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-lg border border-outline-variant px-4 py-2 font-body-sm text-body-sm text-on-surface-variant hover:bg-surface-container"
          >
            다시 시도
          </button>
        </div>
      </div>
    </main>
  );
}
