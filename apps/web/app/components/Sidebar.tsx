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
    <aside className="fixed left-0 top-0 z-50 hidden h-full w-[248px] flex-col border-r border-[#2C2C2C] bg-[#1C1C1C] px-stack-sm py-container-padding shadow-[8px_0_32px_rgba(0,0,0,0.16)] lg:flex">
      {/* Brand header */}
      <div className="mb-8 flex items-center gap-3 px-4">
        <div className="flex h-9 w-9 items-center justify-center rounded border border-[#D8C28A]/50 bg-black text-[#C8A45D] shadow-[0_10px_20px_rgba(0,0,0,0.24)]">
          <span className="material-symbols-outlined notranslate text-[20px]">insights</span>
        </div>
        <div>
          <h1 className="font-headline-sm text-headline-sm font-bold text-white">Celine</h1>
          <p className="font-body-md text-[10px] uppercase tracking-widest text-[#D8C28A]/75">
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
                "flex items-center gap-3 px-4 py-2.5 rounded transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D8C28A]/70 active:scale-[0.98]",
                isActive
                  ? "bg-[#C8A45D] font-semibold text-black shadow-[inset_3px_0_0_rgba(255,255,255,0.44)]"
                  : "text-[#F4F4F4] hover:bg-white/10 hover:text-white",
              ].join(" ")
            }
          >
            <span className="material-symbols-outlined notranslate">{item.icon}</span>
            <span className="font-body-md text-body-md">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Profile */}
      <div className="mt-auto border-t border-white/10 px-2 pt-4">
        <div className="flex cursor-pointer items-center gap-3 rounded border border-white/10 bg-black/28 p-2 transition-colors hover:bg-black/44">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-[#D8C28A] text-body-sm font-semibold text-black">
            CI
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="font-body-md text-body-md font-semibold truncate text-white">Celine Intelligence</p>
            <p className="font-label-muted text-label-muted text-[#B8B8B8] truncate">내부 전용 툴</p>
          </div>
          <span className="material-symbols-outlined notranslate text-[20px] text-[#B8B8B8]">logout</span>
        </div>
      </div>
    </aside>
  );
}

export function MobileNav() {
  const items = NAV_ITEMS.slice(0, 5);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-[#2C2C2C] bg-[#1C1C1C]/96 px-2 pb-[max(env(safe-area-inset-bottom),8px)] pt-2 shadow-[0_-8px_24px_rgba(0,0,0,0.18)] backdrop-blur lg:hidden">
      <div className="grid grid-cols-5 gap-1">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              [
                "flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded px-1 text-[10px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D8C28A]/70 active:scale-[0.98]",
                isActive
                  ? "bg-[#C8A45D] text-black"
                  : "text-[#F4F4F4] hover:bg-white/10 hover:text-white",
              ].join(" ")
            }
          >
            <span className="material-symbols-outlined notranslate text-[22px]">{item.icon}</span>
            <span className="max-w-full truncate">{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
