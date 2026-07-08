import { useEffect, useRef, useState } from "react";
import type { SortOption } from "~/lib/radar/types";

// 접이식 정렬 메뉴 — 레퍼런스 initFoldMenu/buildSortMenu 동작 재현.
export function SortMenu({
  options,
  value,
  onPick,
}: {
  options: SortOption[];
  value: string;
  onPick: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.key === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="flex items-center gap-2 rounded border border-outline-variant bg-surface-container px-4 py-1.5 font-body-sm text-body-sm font-medium text-on-surface transition-colors hover:border-primary"
      >
        정렬: <span className="text-primary">{current.label}</span>
        <span
          className={`material-symbols-outlined notranslate text-[16px] text-on-surface-variant transition-transform ${open ? "rotate-180" : ""}`}
        >
          expand_more
        </span>
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-52 overflow-hidden rounded-lg border border-outline-variant bg-surface-container-high shadow-[0_12px_32px_rgba(0,0,0,0.5)]">
          {options.map((o) => {
            const sel = o.key === value;
            return (
              <button
                type="button"
                key={o.key}
                onClick={() => {
                  onPick(o.key);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-3 px-4 py-3 text-left font-body-sm text-body-sm transition-colors ${
                  sel
                    ? "bg-primary/10 font-semibold text-primary"
                    : "text-on-surface-variant hover:bg-surface-variant hover:text-on-surface"
                }`}
              >
                <span>{o.icon}</span>
                <span className="flex-1">{o.label}</span>
                {sel && <span className="material-symbols-outlined notranslate text-[18px]">check</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
