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
    <header className="fixed top-0 left-[240px] right-0 h-16 bg-background border-b border-outline-variant flex items-center justify-between px-container-padding z-40">
      <div className="flex items-center gap-4">
        <h2 className="font-headline-sm text-headline-sm font-bold text-primary">{title}</h2>
        <div className="h-4 w-[1px] bg-outline-variant mx-2" />
        <div className="flex items-center gap-2 text-on-surface-variant">
          <span className="font-label-muted text-label-muted">시스템 상태:</span>
          <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
          <span className="font-label-muted text-label-muted text-emerald-600 font-medium">정상</span>
        </div>
      </div>
      <div className="flex items-center gap-6">
        <div className="relative w-64">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">
            search
          </span>
          <input
            className="w-full pl-10 pr-4 py-1.5 bg-surface-container rounded-full border-none focus:ring-1 focus:ring-primary text-body-sm transition-all"
            placeholder="브랜드, 광고 검색..."
            type="text"
          />
        </div>
        <div className="flex items-center gap-4">
          <button className="material-symbols-outlined text-on-surface-variant hover:text-primary duration-200">
            notifications
          </button>
          <button className="material-symbols-outlined text-on-surface-variant hover:text-primary duration-200">
            help_outline
          </button>
        </div>
      </div>
    </header>
  );
}
