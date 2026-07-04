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
- Add the second pass analytics layer: brand/platform comparison, priority alerts, campaign clusters, Meta Ads analysis, Watchlist, and data quality states.
- Add a management-screen manual Apify collection flow where selected brand/platform account combinations enqueue collector jobs.
- Replace the global palette with a L'Oreal-inspired black, charcoal, white, gray, and gold palette.
- Fix dark-theme logo legibility by rendering transparent/dark brand logos on a consistent light logo plate.

## Important files

- `apps/web/app/lib/queries.server.ts`
  - Expanded summary, trends, calendar, and admin loaders.
  - Added cross-platform follower snapshots and richer trend metrics.
  - Added platform-aware trends filtering.
  - Added `getPlatformMatrix`, `getDashboardAlerts`, and `getDataQualityStatus`.
  - `getTrends` now also returns `insights`, `contentClusters`, and `metaAds`.

- `apps/web/app/routes/summary.tsx`
  - Reworked summary dashboard layout.
  - Follower growth now renders every active platform, not only platforms with data.
  - Brand/activity sections use the updated visual system.
  - Added brand/platform comparison matrix.
  - Added priority alert cards.
  - Added platform data quality status cards.

- `apps/web/app/routes/trends.tsx`
  - Brand selector now uses `?brand=...` and `?platform=...` query params.
  - Selector no longer redirects to `/brands/:slug`.
  - Added platform tabs and platform-specific metric panels.
  - Top posts include platform information.
  - Added rule-based insight summary, campaign clusters, and Meta Ads Library analysis.

- `apps/web/app/routes/brands.tsx`
  - Brand cards now show web-fetched banner imagery.
  - Brand logo appears as a floating white square over the banner.
  - All monitored brands are shown.
  - Added client-side Watchlist using `localStorage` key `celine:brand-watchlist`.

- `apps/web/app/routes/brand-detail.tsx`
  - Brand header uses the shared brand logo component.
  - Platform indicators are visible text chips rather than only colored dots.

- `apps/web/app/routes/calendar.tsx`
  - Added richer calendar aggregates and a dashboard-like layout.

- `apps/web/app/routes/admin-runs.tsx`
  - Added summary/admin stats and updated surface styling.
  - Added manual collection controls: select all, brand-level selection, platform-level selection, selected-combination preview, per-account max item cap, and submit state.
  - The route action calls the collector worker `POST /manual-collect` endpoint with `COLLECTOR_URL` and `COLLECTOR_SECRET`.
  - The execution prep panel now also shows collection progress: queued count from the last manual request, current `running` jobs from `collection_runs`, latest status, recent run rows, and a manual refresh button.
  - Stale `running` rows older than 1 hour are displayed as `중단됨` instead of live `실행 중`.

- `apps/collector/src/worker.ts`
  - Added `POST /manual-collect`.
  - Authenticates with `x-celine-collect-secret` against `MANUAL_COLLECT_SECRET`.
  - Validates selected active accounts and enqueues the same `COLLECT_QUEUE` messages used by scheduled collection.
  - Supports an optional capped `maxItems` value per queued account.

- `apps/collector/src/seed.ts`
  - Seed data now includes `meta_ads` account rows for the monitored brands.
  - Meta Ads collection uses the account `handle` as a Meta Ad Library keyword search, not an Instagram-style `@handle`.

- `apps/web/app/components/ui.tsx`
  - Updated card, chart, media placeholder, and platform chip styling.
  - Platform chips now include readable labels such as `Meta`, `IG`, `X`, and `TikTok`.

- `apps/web/app/components/Sidebar.tsx`, `apps/web/app/components/TopBar.tsx`, `apps/web/app/root.tsx`, `apps/web/app/app.css`
  - Global Stitch-like surface, grid, spacing, and shell polish.
  - Palette now maps existing token names to L'Oreal-style black/charcoal/white/gray/gold values, so route markup can keep using the same semantic classes.

- `apps/web/app/lib/brand-assets.ts`
  - New shared brand asset registry.
  - Exports `brandLogoFor`, `BrandLogo`, `brandBannerFor`, and `BrandBanner`.
  - Keep this file as `.ts`; it intentionally uses `createElement` instead of JSX so Vite can import it as `brand-assets.ts`.
  - `BrandLogo` now always renders logos on a light `#F4F4F4` plate with a gold border, so black transparent logos stay visible across dark cards, tables, banners, and trend selectors.

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

## Logo visibility pass

The app now uses `BrandLogo` for the Trends dashboard header instead of the previous generic `monitoring` icon. The selected brand logo appears in the 56px header square and reuses the same light plate treatment as smaller logos.

The same shared component is used for:

- Summary brand/platform rows
- Brands page floating logos over banner imagery
- Brand detail headers
- Trends brand selector chips
- Any fallback text monogram when a logo asset is missing

Do not change logo containers back to `bg-surface-container-lowest`; that makes black transparent logos disappear on the L'Oreal dark palette. If a future design needs a different treatment, keep a light logo plate or add a per-logo inverse asset.

## Manual Apify collection

The manual collection flow is intentionally web → collector → queue, not web → Apify:

1. Admin user selects brand/platform account combinations on `/admin-runs`.
2. The web route action sends selected `accountIds` to `COLLECTOR_URL/manual-collect`.
3. The collector validates `MANUAL_COLLECT_SECRET`, loads active accounts, and enqueues queue messages.
4. The existing queue consumer runs `collectAccount()`, which handles Apify, normalization, ingestion, and `collection_runs` updates.

Required runtime settings:

- Web Worker: `COLLECTOR_URL`, `COLLECTOR_SECRET`
- Collector Worker: `MANUAL_COLLECT_SECRET`, `APIFY_TOKEN`, Hyperdrive, queue bindings

`COLLECTOR_SECRET` and `MANUAL_COLLECT_SECRET` must be the same value. If those values are missing, the admin page will show a configuration error instead of silently failing.

If the `/admin/runs` "Meta" quick-select button shows `0` or is disabled, the production `brand_accounts` table is missing active `meta_ads` rows. Re-run the collector seed or upsert equivalent `brand_accounts` rows. The quick-select UI can only enqueue existing active accounts because `/manual-collect` validates `accountIds` before queueing.

Root cause found on 2026-07-04: `ACTIVE_PLATFORMS` included `meta_ads`, so the quick-select button rendered, but the collector seed only had Instagram, X, and TikTok rows for the monitored brands. That made the Meta quick-select target set empty. The seed now creates `meta_ads` rows using Meta Ad Library keyword handles such as `Anua`, `VT Cosmetics`, `medicube`, `manyo`, and `AESTURA`.

## Palette

The active visual palette is:

- Primary Black: `#000000`
- Rich Charcoal: `#1C1C1C`
- White: `#FFFFFF`
- Light Gray: `#F4F4F4`
- Medium Gray: `#B8B8B8`
- Luxury Gold: `#C8A45D`
- Champagne Gold: `#D8C28A`

The mapping lives in `apps/web/tailwind.config.ts`. Direct global CSS colors live in `apps/web/app/app.css`; keep those in the same grayscale/gold family.

## Analytics layer

The later feature pass implemented the ideas requested by the user:

- **Brand/platform comparison matrix**
  - Implemented in `getPlatformMatrix()`.
  - Shown on Summary.
  - Uses latest followers, post count, active ad count, and engagement sum.

- **Priority alerts**
  - Implemented in `getDashboardAlerts()`.
  - Combines data quality issues, follower spikes, and newly detected ads.
  - Shown on Summary as "오늘 볼 변화".

- **Campaign clusters**
  - Implemented inside `getTrends()`.
  - Uses `contentTagOf()` rule-based tagging on captions.
  - Current buckets include 신제품, 프로모션, 튜토리얼, 선케어, 립, 보습, 세럼, 영상형, 캐러셀, 제품/브랜드.

- **Brand insight summary**
  - Implemented inside `getTrends()`.
  - Builds three readable insights from top channel, top content cluster, and follower delta.

- **Content performance ranking**
  - Existing Trends top-post table remains the main ranking surface.
  - It is now supported by the insight and cluster panels above it.

- **Meta Ads dedicated view**
  - Implemented inside `getTrends().metaAds`.
  - Shows active ads, new ads in 7 days, inactive ads in 7 days, average active days, longest running ad, CTA mix, and creative reuse count when present in raw Meta data.

- **Watchlist**
  - Implemented in `brands.tsx`.
  - Client-side only; no DB schema change.
  - Stored in browser `localStorage` under `celine:brand-watchlist`.

- **Data quality status**
  - Implemented in `getDataQualityStatus()`.
  - Shown on Summary.
  - Uses latest `collection_runs` status per active platform and active account counts.

## Verification run

These checks passed after the final changes:

```bash
npm run typecheck -w @celine/web
npm run build -w @celine/web
git diff --check
```

The build uses React Router/Vite and emitted only the existing empty `img` chunk notice.

After the second feature pass, the same checks were run again and passed:

```bash
npm run typecheck -w @celine/web
npm run build -w @celine/web
git diff --check
```

After the final logo visibility pass, the same checks were run again and passed:

```bash
npm run typecheck -w @celine/web
npm run build -w @celine/web
git diff --check
```

After adding Meta seed accounts for manual collection, these checks were run again and passed:

```bash
npm run typecheck -w @celine/web
npm run build -w @celine/web
npm test -w @celine/collector
git diff --check
```

After adding the admin collection progress panel, these checks were run again and passed:

```bash
npm run typecheck -w @celine/web
npm run build -w @celine/web
git diff --check
```

After fixing stale `running` collection display, these checks were run again and passed:

```bash
npm run typecheck -w @celine/web
npm run build -w @celine/web
git diff --check
```

## Notes for next agent

- Do not delete or rename `apps/web/app/lib/brand-assets.ts` without updating all route imports.
- Do not replace platform chips with dot-only indicators; the user explicitly rejected dot-only platform display.
- The user wants design-only changes to preserve existing functionality unless explicitly asked otherwise.
- There are still untracked local source images in `reference/`; they are not required by the app.
- Some unused older candidate assets may exist locally if not staged, such as old `vt-cosmetics.jpg` or `cezanne.png` under `apps/web/public/brand-banners/`. The committed mapping only uses the files listed above.
- The Watchlist is intentionally local-only. If shared/team watchlists are needed, add a DB table and server actions instead of reusing localStorage.
- Campaign clustering is intentionally rule-based. If AI/embedding clustering is added later, keep the existing rule labels as fallback so the dashboard still works when AI calls fail.
