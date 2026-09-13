import { Form, useLocation, useSearchParams } from "react-router";

const TITLES: Record<string, string> = {
  "/": "요약",
  "/feed": "통합 피드",
  "/winning-ads": "위닝 광고",
  "/trends": "트렌드",
  "/radar": "트렌드 뷰어",
  "/calendar": "포스팅 캘린더",
  "/brands": "브랜드",
  "/admin/runs": "수집 관리 · 실행 현황",
  "/admin/users": "계정 관리",
};

function titleFor(pathname: string): string {
  if (TITLES[pathname]) return TITLES[pathname];
  if (pathname.startsWith("/brands/")) return "브랜드 상세";
  if (pathname.startsWith("/item/ad/")) return "광고 상세";
  if (pathname.startsWith("/item/post/")) return "게시물 상세";
  return "Celine";
}

export function TopBar({ userEmail }: { userEmail?: string | null }) {
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const title = titleFor(pathname);
  // 피드 화면에서는 현재 검색어를 입력창에 유지한다(다른 화면은 빈 값으로 시작).
  const q = pathname === "/feed" ? (searchParams.get("q") ?? "") : "";

  return (
    <header className="fixed left-0 right-0 top-0 z-40 flex h-14 items-center justify-between border-b border-[#3A3A3A] bg-[#111111]/94 px-4 backdrop-blur-xl lg:left-[248px] lg:h-16 lg:px-container-padding">
      <div className="flex min-w-0 items-center gap-3 lg:gap-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-black text-[#C8A45D] shadow-[0_8px_18px_rgba(0,0,0,0.18)] lg:hidden">
          <span className="material-symbols-outlined notranslate text-[20px]">insights</span>
        </div>
        <h2 className="truncate font-headline-sm text-headline-sm font-bold text-white">{title}</h2>
      </div>
      <div className="flex items-center gap-2 sm:gap-4 lg:gap-6">
        {/* 검색: 피드의 텍스트 필터(q)로 연결 — 브랜드명·캡션·광고 문구를 찾는다. */}
        <Form method="get" action="/feed" className="relative hidden w-64 lg:block">
          <span className="material-symbols-outlined notranslate absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">
            search
          </span>
          <input
            key={q}
            name="q"
            defaultValue={q}
            aria-label="피드 검색"
            className="w-full rounded border border-[#3A3A3A] bg-[#181818] py-1.5 pl-10 pr-4 text-body-sm text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-all placeholder:text-[#8A8A8A] focus:border-[#C8A45D] focus:outline-none focus:ring-1 focus:ring-[#C8A45D]"
            placeholder="브랜드, 캡션, 광고 문구 검색…"
            type="search"
          />
        </Form>
        {userEmail && (
          <span className="hidden max-w-[220px] truncate font-label-muted text-label-muted text-on-surface-variant sm:block" title={userEmail}>
            {userEmail}
          </span>
        )}
      </div>
    </header>
  );
}
