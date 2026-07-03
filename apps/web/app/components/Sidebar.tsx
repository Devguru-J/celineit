import { NavLink } from "react-router";

type NavItem = { to: string; icon: string; label: string; end?: boolean };

export const NAV_ITEMS: NavItem[] = [
  { to: "/", icon: "dashboard", label: "요약", end: true },
  { to: "/feed", icon: "rss_feed", label: "피드" },
  { to: "/winning-ads", icon: "star", label: "위닝 광고" },
  { to: "/trends", icon: "trending_up", label: "트렌드" },
  { to: "/calendar", icon: "calendar_month", label: "캘린더" },
  { to: "/brands", icon: "domain", label: "브랜드" },
  { to: "/admin/runs", icon: "settings_applications", label: "수집 관리" },
];

export function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 z-50 hidden h-full w-[240px] flex-col border-r border-outline-variant bg-surface px-stack-sm py-container-padding lg:flex">
      {/* Brand header */}
      <div className="px-4 mb-8 flex items-center gap-3">
        <div className="w-8 h-8 bg-primary rounded flex items-center justify-center text-on-primary">
          <span className="material-symbols-outlined text-[20px]">insights</span>
        </div>
        <div>
          <h1 className="font-headline-sm text-headline-sm font-bold text-primary">Celine</h1>
          <p className="font-body-md text-[10px] text-on-surface-variant uppercase tracking-widest opacity-70">
            Intelligence Platform
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              [
                "flex items-center gap-3 px-4 py-2.5 rounded transition-colors active:scale-[0.98]",
                isActive
                  ? "text-primary font-semibold bg-primary-container/10"
                  : "text-on-surface-variant hover:bg-surface-container-high",
              ].join(" ")
            }
          >
            <span className="material-symbols-outlined">{item.icon}</span>
            <span className="font-body-md text-body-md">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Profile */}
      <div className="mt-auto border-t border-outline-variant pt-4 px-2">
        <div className="flex items-center gap-3 p-2 rounded hover:bg-surface-container transition-colors cursor-pointer">
          <div className="w-8 h-8 rounded bg-secondary-container flex items-center justify-center text-on-secondary-container font-semibold text-body-sm">
            CI
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="font-body-md text-body-md font-semibold truncate">Celine Intelligence</p>
            <p className="font-label-muted text-label-muted text-on-surface-variant truncate">내부 전용 툴</p>
          </div>
          <span className="material-symbols-outlined text-[20px] text-on-surface-variant">logout</span>
        </div>
      </div>
    </aside>
  );
}

export function MobileNav() {
  const items = NAV_ITEMS.slice(0, 5);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-outline-variant bg-surface/95 px-2 pb-[max(env(safe-area-inset-bottom),8px)] pt-2 shadow-[0_-8px_24px_rgba(26,27,34,0.08)] backdrop-blur lg:hidden">
      <div className="grid grid-cols-5 gap-1">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              [
                "flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded px-1 text-[10px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 active:scale-[0.98]",
                isActive
                  ? "bg-primary-container/10 text-primary"
                  : "text-on-surface-variant hover:bg-surface-container",
              ].join(" ")
            }
          >
            <span className="material-symbols-outlined text-[22px]">{item.icon}</span>
            <span className="max-w-full truncate">{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
