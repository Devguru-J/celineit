import { createElement } from "react";

const LOGOS: { keys: string[]; src: string }[] = [
  { keys: ["canmake", "canmake-tokyo", "canmake tokyo"], src: "/brand-logos/canmake.avif" },
  { keys: ["vt", "vt-cosmetics", "vt cosmetics", "vtコスメティックス"], src: "/brand-logos/vt-cosmetics.webp" },
  { keys: ["manyo", "ma:nyo", "マニョ"], src: "/brand-logos/manyo.png" },
  { keys: ["medicube", "メディキューブ"], src: "/brand-logos/medicube.avif" },
  { keys: ["shiseido", "資生堂"], src: "/brand-logos/shiseido.png" },
  { keys: ["aestura", "エストラ"], src: "/brand-logos/aestura.webp" },
  { keys: ["sk-ii", "skii", "sk ii"], src: "/brand-logos/sk-ii.png" },
  { keys: ["anua", "アヌア"], src: "/brand-logos/anua.webp" },
  { keys: ["kate", "kate-tokyo", "katetokyo"], src: "/brand-logos/kate-tokyo.png" },
  { keys: ["cezanne", "セザンヌ"], src: "/brand-logos/cezanne.webp" },
];

const BANNERS: { keys: string[]; src: string }[] = [
  { keys: ["canmake", "canmake-tokyo", "canmake tokyo"], src: "/brand-banners/canmake.png" },
  { keys: ["vt", "vt-cosmetics", "vt cosmetics", "vtコスメティックス"], src: "/brand-banners/vt-cosmetics.png" },
  { keys: ["manyo", "ma:nyo", "マニョ"], src: "/brand-banners/manyo.jpg" },
  { keys: ["medicube", "メディキューブ"], src: "/brand-banners/medicube.png" },
  { keys: ["shiseido", "資生堂"], src: "/brand-banners/shiseido.jpg" },
  { keys: ["aestura", "エストラ"], src: "/brand-banners/aestura.png" },
  { keys: ["sk-ii", "skii", "sk ii"], src: "/brand-banners/sk-ii.jpg" },
  { keys: ["anua", "アヌア"], src: "/brand-banners/anua.jpg" },
  { keys: ["kate", "kate-tokyo", "katetokyo"], src: "/brand-banners/kate-tokyo.png" },
  { keys: ["cezanne", "セザンヌ"], src: "/brand-banners/cezanne.jpg" },
];

function normalize(v: string | null | undefined) {
  return (v ?? "")
    .toLowerCase()
    .replace(/[_./]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

export function brandLogoFor(input: { slug?: string | null; name?: string | null }) {
  const slug = normalize(input.slug);
  const name = normalize(input.name);
  return LOGOS.find((logo) => logo.keys.some((key) => slug.includes(key) || name.includes(key)))?.src ?? null;
}

export function brandBannerFor(input: { slug?: string | null; name?: string | null }) {
  const slug = normalize(input.slug);
  const name = normalize(input.name);
  return BANNERS.find((banner) => banner.keys.some((key) => slug.includes(key) || name.includes(key)))?.src ?? null;
}

export function BrandLogo({
  slug,
  name,
  className = "",
}: {
  slug?: string | null;
  name?: string | null;
  className?: string;
}) {
  const src = brandLogoFor({ slug, name });
  if (!src) {
    return createElement(
      "span",
      {
        className: `flex items-center justify-center rounded border border-outline-variant bg-surface-container-lowest font-headline-sm font-bold text-primary ${className}`,
      },
      (name ?? slug ?? "B").replace(/[^A-Za-z가-힣ぁ-んァ-ン一-龥]/g, "").charAt(0) || "B",
    );
  }

  return createElement(
    "span",
    {
      className: `flex items-center justify-center rounded border border-outline-variant bg-surface-container-lowest p-1 ${className}`,
    },
    createElement("img", {
      src,
      alt: `${name ?? slug ?? "Brand"} logo`,
      className: "h-full w-full object-contain",
      loading: "lazy",
    }),
  );
}

export function BrandBanner({
  slug,
  name,
  className = "",
}: {
  slug?: string | null;
  name?: string | null;
  className?: string;
}) {
  const src = brandBannerFor({ slug, name });
  if (!src) {
    return createElement(
      "div",
      {
        className: `surface-grid flex items-center justify-center bg-surface-container-low ${className}`,
      },
      createElement(
        "span",
        {
          className: "font-label-caps text-label-caps uppercase text-on-surface-variant",
        },
        name ?? slug ?? "Brand",
      ),
    );
  }

  return createElement(
    "div",
    {
      className: `surface-grid flex items-center justify-center overflow-hidden bg-surface-container-low ${className}`,
    },
    createElement("img", {
      src,
      alt: `${name ?? slug ?? "Brand"} brand image`,
      className: "h-full w-full object-cover",
      loading: "lazy",
    }),
  );
}
