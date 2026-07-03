import { useLocation } from "react-router";

const TITLES: Record<string, string> = {
  "/": "요약",
  "/feed": "통합 피드",
  "/winning-ads": "위닝 광고",
  "/trends": "트렌드",
  "/calendar": "포스팅 캘린더",
  "/brands": "브랜드",
  "/admin/runs": "수집 관리 · 실행 현황",
};

export function TopBar() {
  const { pathname } = useLocation();
  const title = TITLES[pathname] ?? "Celine";

  return (
    <header className="fixed left-0 right-0 top-0 z-40 flex h-14 items-center justify-between border-b border-outline-variant bg-background/95 px-4 backdrop-blur lg:left-[240px] lg:h-16 lg:px-container-padding">
      <div className="flex min-w-0 items-center gap-3 lg:gap-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-primary text-on-primary lg:hidden">
          <span className="material-symbols-outlined notranslate text-[20px]">insights</span>
        </div>
        <h2 className="truncate font-headline-sm text-headline-sm font-bold text-primary">{title}</h2>
        <div className="mx-2 hidden h-4 w-[1px] bg-outline-variant sm:block" />
        <div className="hidden items-center gap-2 text-on-surface-variant sm:flex">
          <span className="font-label-muted text-label-muted">시스템 상태:</span>
          <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
          <span className="font-label-muted text-label-muted text-emerald-600 font-medium">정상</span>
        </div>
      </div>
      <div className="flex items-center gap-2 sm:gap-4 lg:gap-6">
        <div className="relative hidden w-64 lg:block">
          <span className="material-symbols-outlined notranslate absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">
            search
          </span>
          <input
            className="w-full rounded-full border-none bg-surface-container py-1.5 pl-10 pr-4 text-body-sm transition-all focus:ring-1 focus:ring-primary"
            placeholder="브랜드, 광고 검색..."
            type="text"
          />
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          <button className="material-symbols-outlined notranslate text-on-surface-variant hover:text-primary duration-200">
            notifications
          </button>
          <button className="material-symbols-outlined notranslate text-on-surface-variant hover:text-primary duration-200">
            help_outline
          </button>
        </div>
      </div>
    </header>
  );
}
