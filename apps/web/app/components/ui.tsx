import { PLATFORM_META, type Platform } from "~/mock/data";

// Small platform chip used across feed / winning ads / timeline.
export function PlatformChip({ platform, withIcon = false }: { platform: Platform; withIcon?: boolean }) {
  const m = PLATFORM_META[platform];
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-variant font-label-muted text-[10px] uppercase font-bold text-on-surface-variant">
      {withIcon && <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />}
      {m.short}
    </span>
  );
}

// Deterministic gradient placeholder standing in for ad/post media.
export function MediaPlaceholder({
  seed,
  className = "",
  format,
}: {
  seed: string;
  className?: string;
  format?: "image" | "video" | "carousel";
}) {
  const gradients = [
    "from-indigo-200 to-purple-300",
    "from-rose-200 to-orange-200",
    "from-emerald-200 to-teal-300",
    "from-amber-200 to-yellow-100",
    "from-sky-200 to-indigo-200",
    "from-stone-300 to-neutral-200",
  ];
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const g = gradients[h % gradients.length];
  const icon = format === "video" ? "play_circle" : format === "carousel" ? "collections" : "image";
  return (
    <div className={`relative bg-gradient-to-br ${g} overflow-hidden ${className}`}>
      <span className="material-symbols-outlined absolute inset-0 m-auto w-fit h-fit text-white/70 text-[28px]">
        {icon}
      </span>
    </div>
  );
}

// Card wrapper matching the Stitch surface treatment.
export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-surface-container-lowest border border-outline-variant rounded ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="px-container-padding py-4 border-b border-outline-variant flex justify-between items-center">
      <h3 className="font-headline-sm text-headline-sm">{title}</h3>
      {action}
    </div>
  );
}

// Inline SVG line chart for trend data.
export function LineChart({
  data,
  height = 200,
  stroke = "#3525cd",
  fill = true,
}: {
  data: { value: number }[];
  height?: number;
  stroke?: string;
  fill?: boolean;
}) {
  const w = 600;
  const h = height;
  const pad = 8;
  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const stepX = (w - pad * 2) / (data.length - 1);
  const pts = data.map((d, i) => {
    const x = pad + i * stepX;
    const y = pad + (1 - (d.value - min) / span) * (h - pad * 2);
    return [x, y] as const;
  });
  const line = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)},${h} L${pts[0][0].toFixed(1)},${h} Z`;
  const gid = `g-${stroke.replace("#", "")}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height }} preserveAspectRatio="none">
      <defs>
        <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.18" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && <path d={area} fill={`url(#${gid})`} />}
      <path d={line} fill="none" stroke={stroke} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
