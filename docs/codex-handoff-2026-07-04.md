# Codex handoff - 2026-07-04

## Scope

This change finishes the Stitch-inspired redesign and dashboard data expansion that had been partially started before. Existing routes and behavior are kept, but the dashboard, trends, brand registry, calendar, and admin screens were restyled and given richer summary data.

The main user-facing goals were:

- Match the Google Stitch reference design more closely.
- Preserve existing features while improving visual hierarchy.
- Make Summary and Trends dashboards more useful.
- Let the Trends brand selector update trend data instead of navigating to brand detail pages.
- Show all available brands, not only five.
- Add visible brand logos and brand banner images.
- Split Meta, Instagram, X, and TikTok data more clearly.
- Show all supported platforms in platform summary areas, even if a platform has no current snapshot.

## Important files

- `apps/web/app/lib/queries.server.ts`
  - Expanded summary, trends, calendar, and admin loaders.
  - Added cross-platform follower snapshots and richer trend metrics.
  - Added platform-aware trends filtering.

- `apps/web/app/routes/summary.tsx`
  - Reworked summary dashboard layout.
  - Follower growth now renders every active platform, not only platforms with data.
  - Brand/activity sections use the updated visual system.

- `apps/web/app/routes/trends.tsx`
  - Brand selector now uses `?brand=...` and `?platform=...` query params.
  - Selector no longer redirects to `/brands/:slug`.
  - Added platform tabs and platform-specific metric panels.
  - Top posts include platform information.

- `apps/web/app/routes/brands.tsx`
  - Brand cards now show web-fetched banner imagery.
  - Brand logo appears as a floating white square over the banner.
  - All monitored brands are shown.

- `apps/web/app/routes/brand-detail.tsx`
  - Brand header uses the shared brand logo component.
  - Platform indicators are visible text chips rather than only colored dots.

- `apps/web/app/routes/calendar.tsx`
  - Added richer calendar aggregates and a dashboard-like layout.

- `apps/web/app/routes/admin-runs.tsx`
  - Added summary/admin stats and updated surface styling.

- `apps/web/app/components/ui.tsx`
  - Updated card, chart, media placeholder, and platform chip styling.
  - Platform chips now include readable labels such as `Meta`, `IG`, `X`, and `TikTok`.

- `apps/web/app/components/Sidebar.tsx`, `apps/web/app/components/TopBar.tsx`, `apps/web/app/root.tsx`, `apps/web/app/app.css`
  - Global Stitch-like surface, grid, spacing, and shell polish.

- `apps/web/app/lib/brand-assets.ts`
  - New shared brand asset registry.
  - Exports `brandLogoFor`, `BrandLogo`, `brandBannerFor`, and `BrandBanner`.
  - Keep this file as `.ts`; it intentionally uses `createElement` instead of JSX so Vite can import it as `brand-assets.ts`.

## Brand assets

Runtime assets live under:

- `apps/web/public/brand-logos/`
- `apps/web/public/brand-banners/`

The `reference/` folder is only local source/reference material and was not staged for commit.

Current banner files and dimensions:

- `aestura.png` - `1920x800`
- `anua.jpg` - `1200x628`
- `canmake.png` - `1200x630`
- `cezanne.jpg` - `2800x1180`
- `kate-tokyo.png` - `1366x561`
- `manyo.jpg` - `2260x1004`
- `medicube.png` - `3200x1400`
- `shiseido.jpg` - `2200x980`
- `sk-ii.jpg` - `1440x600`
- `vt-cosmetics.png` - `1000x1200`

Banner recommendation for future replacements:

- Minimum: `800x320`
- Good: `1200x500` or larger
- Ideal: around `1600x650` or larger

Avoid using logos or tiny square thumbnails in the banner slot. The banner area is rendered with `object-cover`, so use product/campaign/lifestyle imagery that can be cropped horizontally.

## Platform handling

The active platform set comes from `@celine/shared`. Summary platform cards intentionally include every active platform and show empty state values when data is missing. This is deliberate so Meta, Instagram, X, and TikTok remain visually separated even when one platform has no current follower snapshot.

Trends uses query params:

- `brand`: selected brand slug
- `platform`: `all`, `instagram`, `twitter`, `tiktok`, or `meta_ads`

When updating trends behavior, preserve query-param selection rather than changing brand tabs back to `/brands/:slug` links.

## Verification run

These checks passed after the final changes:

```bash
npm run typecheck -w @celine/web
npm run build -w @celine/web
git diff --check
```

The build uses React Router/Vite and emitted only the existing empty `img` chunk notice.

## Notes for next agent

- Do not delete or rename `apps/web/app/lib/brand-assets.ts` without updating all route imports.
- Do not replace platform chips with dot-only indicators; the user explicitly rejected dot-only platform display.
- The user wants design-only changes to preserve existing functionality unless explicitly asked otherwise.
- There are still untracked local source images in `reference/`; they are not required by the app.
- Some unused older candidate assets may exist locally if not staged, such as old `vt-cosmetics.jpg` or `cezanne.png` under `apps/web/public/brand-banners/`. The committed mapping only uses the files listed above.
