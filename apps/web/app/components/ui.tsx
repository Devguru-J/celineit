import { PLATFORM_META, type Platform } from "~/mock/data";

// Small platform chip used across feed / winning ads / timeline.
export function PlatformChip({ platform, withIcon = false }: { platform: Platform; withIcon?: boolean }) {
  const m = PLATFORM_META[platform];
  return (
    <span className="inline-flex items-center gap-1.5 rounded border border-outline-variant/80 bg-surface-container-low px-2 py-0.5 font-label-muted text-[10px] font-bold uppercase text-on-surface-variant shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
      {withIcon && <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />}
      <span>{m.short}</span>
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
    "from-primary-fixed to-primary-fixed-dim",
    "from-tertiary-fixed to-tertiary-fixed-dim",
    "from-secondary-container to-primary-fixed",
    "from-surface-container-high to-surface-variant",
    "from-primary-fixed-dim to-secondary-fixed-dim",
    "from-surface-dim to-surface-container-highest",
  ];
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const g = gradients[h % gradients.length];
  const icon = format === "video" ? "play_circle" : format === "carousel" ? "collections" : "image";
  return (
    <div className={`surface-grid relative overflow-hidden bg-gradient-to-br ${g} ${className}`}>
      <span className="material-symbols-outlined notranslate absolute inset-0 m-auto h-fit w-fit text-[28px] text-primary/55">
        {icon}
      </span>
    </div>
  );
}

// 실제 이미지 + 로드 실패 시 그라데이션 플레이스홀더로 폴백.
// (인스타 CDN 이미지는 핫링크 차단/만료될 수 있어 폴백 필요 — 추후 R2 사본으로 안정화)
export function MediaImage({
  src,
  seed,
  format,
  className = "",
}: {
  src: string | null | undefined;
  seed: string;
  format?: "image" | "video" | "carousel" | null;
  className?: string;
}) {
  if (!src) return <MediaPlaceholder seed={seed} format={format ?? undefined} className={className} />;
  const proxied = proxy(src);
  return (
    <div className={`relative bg-surface-variant overflow-hidden ${className}`}>
      <img
        src={proxied}
        alt=""
        loading="lazy"
        referrerPolicy="no-referrer"
        className="w-full h-full object-cover"
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.display = "none";
        }}
      />
      {format === "video" && (
        <span className="material-symbols-outlined notranslate absolute top-1.5 right-1.5 text-white drop-shadow text-[20px]">
          play_circle
        </span>
      )}
    </div>
  );
}

// CDN 핫링크 차단 호스트만 프록시 경유. 우리 저장소(Supabase Storage 등) URL은 직접 로드.
const CDN_RE = /cdninstagram\.com|fbcdn\.net|twimg\.com|tiktokcdn|pstatp\.com/i;
function proxy(url: string): string {
  if (!url.startsWith("http")) return url;
  return CDN_RE.test(url) ? `/img?u=${encodeURIComponent(url)}` : url;
}

// 영상 재생 (프록시 경유, Range 지원). poster 로 커버 이미지 표시.
export function MediaVideo({
  src,
  poster,
  className = "",
}: {
  src: string;
  poster?: string | null;
  className?: string;
}) {
  return (
    <div className={`relative bg-black overflow-hidden ${className}`}>
      <video
        src={proxy(src)}
        poster={poster ? proxy(poster) : undefined}
        controls
        playsInline
        preload="metadata"
        className="w-full h-full object-contain bg-black"
      />
    </div>
  );
}

// Card wrapper matching the Stitch surface treatment.
export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded border border-outline-variant/90 bg-surface shadow-[0_16px_36px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.05)] ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-outline-variant/80 px-4 py-4 sm:px-container-padding">
      <h3 className="font-headline-sm text-headline-sm text-on-surface">{title}</h3>
      {action}
    </div>
  );
}

// Inline SVG line chart for trend data.
export function LineChart({
  data,
  height = 200,
  stroke = "#C8A45D",
  fill = true,
}: {
  data: { value: number }[];
  height?: number;
  stroke?: string;
  fill?: boolean;
}) {
  if (data.length === 0) return null;
  const w = 600;
  const h = height;
  const pad = 8;
  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const stepX = data.length > 1 ? (w - pad * 2) / (data.length - 1) : 0;
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

// KPI 증감 배지 — 방향(up/down/flat) + 텍스트.
export function KpiDelta({ dir, text }: { dir: "up" | "down" | "flat"; text: string }) {
  const cfg =
    dir === "up"
      ? { icon: "trending_up", cls: "text-[#D8C28A] bg-[#D8C28A]/15" }
      : dir === "down"
        ? { icon: "trending_down", cls: "text-error bg-error-container/60" }
        : { icon: "trending_flat", cls: "text-on-surface-variant bg-surface-container" };
  return (
    <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-label-caps text-[10px] ${cfg.cls}`}>
      <span className="material-symbols-outlined notranslate text-[14px]">{cfg.icon}</span>
      {text}
    </span>
  );
}

// 간단한 SVG 막대 차트 (LineChart 패턴).
export function BarChart({
  data,
  height = 140,
  color = "#C8A45D",
}: {
  data: { value: number }[];
  height?: number;
  color?: string;
}) {
  const w = 600;
  const h = height;
  const pad = 8;
  const n = data.length;
  if (n === 0) return null;
  const max = Math.max(1, ...data.map((d) => d.value));
  const slot = (w - pad * 2) / n;
  const barW = Math.max(2, slot * 0.6);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height }} preserveAspectRatio="none">
      {data.map((d, i) => {
        const bh = (d.value / max) * (h - pad * 2);
        const x = pad + i * slot + (slot - barW) / 2;
        const y = h - pad - bh;
        return <rect key={i} x={x} y={y} width={barW} height={bh} rx="2" fill={color} opacity={0.35 + 0.65 * (d.value / max)} />;
      })}
    </svg>
  );
}
