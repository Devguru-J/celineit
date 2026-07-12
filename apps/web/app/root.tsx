import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLocation,
} from "react-router";
import type { LinksFunction } from "react-router";

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
  // 로그인/가입 화면은 사이드바/탑바 없는 전체 화면 레이아웃
  if (pathname === "/login" || pathname === "/signup") return <Outlet />;
  return (
    <>
      <Sidebar />
      <TopBar />
      <MobileNav />
      <main className="min-h-screen px-0 pb-[calc(76px+env(safe-area-inset-bottom))] pt-14 lg:ml-[248px] lg:pb-0 lg:pt-16">
        <Outlet />
      </main>
    </>
  );
}
