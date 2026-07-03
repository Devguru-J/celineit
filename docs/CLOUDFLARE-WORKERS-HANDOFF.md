# Cloudflare Workers Handoff Notes

This note summarizes the Cloudflare Workers deployment and local development fixes made on 2026-07-03 so a future agent can continue without rediscovering the same issues.

## Current App Shape

- Monorepo root: `/Users/tuesdaymorning/Devguru/celine/celineit`
- Web app workspace: `apps/web` (`@celine/web`)
- Web runtime: React Router v7 SSR on Cloudflare Workers, using `@cloudflare/vite-plugin`
- Database: Supabase Postgres via Cloudflare Hyperdrive
- Hyperdrive binding name: `HYPERDRIVE`
- Hyperdrive config id: `07f80eaefaa6470d9cf0fa956626d603`

## Cloudflare Git Deploy Settings

In Cloudflare Workers Git deploy, use the repository root as the root directory.

```txt
Build command:
npm run build -w @celine/web

Deploy command:
npx wrangler deploy --config apps/web/build/server/wrangler.json
```

Do not deploy with `--config apps/web/wrangler.jsonc`. That source config points at `workers/app.ts`, which imports `virtual:react-router/server-build`. That virtual module only exists during the React Router/Vite build. Deploying the generated `apps/web/build/server/wrangler.json` uses the already-built Worker entry and avoids the unresolved virtual module error.

Expected dry-run validation:

```bash
npm run build -w @celine/web
XDG_CONFIG_HOME=/tmp npx wrangler deploy --dry-run --config apps/web/build/server/wrangler.json
```

The dry-run should show the `HYPERDRIVE` binding and exit successfully. Wrangler 3 may warn about unknown fields in the generated config; that warning did not block deployment in local validation.

## Hyperdrive

The web Worker config is in `apps/web/wrangler.jsonc`.

Important bits:

```jsonc
{
  "compatibility_flags": ["nodejs_compat"],
  "hyperdrive": [
    {
      "binding": "HYPERDRIVE",
      "id": "07f80eaefaa6470d9cf0fa956626d603"
    }
  ]
}
```

The Hyperdrive config was created with Wrangler. Do not commit DB passwords or full connection strings. The local-only DB credentials live in ignored files such as `apps/web/.dev.vars` and `apps/web/.env`.

## Local Development

Run from the repo root:

```bash
npm run dev
```

`apps/web/package.json` loads `apps/web/.dev.vars` before starting React Router dev:

```json
"dev": "set -a; [ -f .dev.vars ] && . ./.dev.vars; set +a; react-router dev"
```

The local Hyperdrive emulation variable must use the current Cloudflare name:

```txt
CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE=...
```

`WRANGLER_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE` is deprecated and was not enough for the current local dev path. The example file is `apps/web/.dev.vars.example`.

If local direct Supabase hostname DNS fails, the pooler hostname used by `apps/web/.env` was confirmed to work from an unsandboxed local process with `select 1`.

## SSR Entry

`apps/web/app/entry.server.tsx` is intentionally present. Without it, React Router selected the Node default server entry and local Workers dev failed with:

```txt
TypeError: renderToPipeableStream is not a function
```

The custom entry imports `renderToReadableStream` from `react-dom/server.edge`, which is the correct Web Streams path for Workers.

## Request-Scoped DB Context

Do not reintroduce a global/singleton Postgres client in the web Worker.

An earlier implementation cached the Drizzle/Postgres client globally in `apps/web/app/lib/db.server.ts`. In Cloudflare Workers local dev this caused:

```txt
Cannot perform I/O on behalf of a different request.
I/O objects ... created in the context of one request handler cannot be accessed from a different request's handler.
```

Current fix:

- `apps/web/workers/app.ts` wraps each request with `runWithDb(env.HYPERDRIVE.connectionString, ...)`.
- `apps/web/app/lib/db.server.ts` uses `AsyncLocalStorage<Database>` so route loaders can keep calling `getDb()` while receiving a request-scoped DB object.
- Local React Router dev, which does not always pass through `workers/app.ts` the same way, falls back to creating a DB from `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE`.

This was validated with five repeated local requests returning HTTP 200.

## Mobile Responsive Layout

Mobile layout was improved after the deployed app showed the desktop sidebar consuming roughly half the phone viewport.

Current responsive shell:

- `apps/web/app/root.tsx`
  - Desktop keeps the left sidebar and `lg:ml-[240px]`.
  - Mobile removes the left margin, uses full-width content, and adds bottom padding so the bottom nav does not cover content.
- `apps/web/app/components/Sidebar.tsx`
  - Desktop sidebar is hidden below `lg`.
  - `NAV_ITEMS` is exported and reused by `MobileNav`.
  - `MobileNav` shows the first five primary destinations in a fixed bottom tab bar: summary, feed, winning ads, trends, calendar.
- `apps/web/app/components/TopBar.tsx`
  - Mobile uses a compact 56px header with brand icon, title, notifications, and help.
  - Desktop keeps the search field and system status.

Do not reintroduce `ml-[240px]` or `left-[240px]` globally. Those offsets must remain `lg:` scoped or mobile will break again.

Several route files were also adjusted so cards, filters, tables, and detail rows do not overflow on phones:

- `summary.tsx`
- `feed.tsx`
- `winning-ads.tsx`
- `trends.tsx`
- `calendar.tsx`
- `brands.tsx`
- `brand-detail.tsx`
- `admin-runs.tsx`
- `item.tsx`
- `components/feed-card.tsx`

Responsive QA performed:

- Mobile viewport: `390x844`
- Desktop viewport: `1280x800`
- Checked mobile routes: `/`, `/feed`, `/winning-ads`, `/trends`, `/calendar`, `/brands`, `/admin/runs`
- All checked mobile routes had `documentElement.scrollWidth <= window.innerWidth + 2`.
- Mobile bottom nav interaction was verified by clicking `Feed` and confirming navigation to `/feed`.
- Desktop sidebar/search remained visible at `1280x800`.
- Browser console had no relevant `error` or `warn` entries during QA.

## Summary Insight Panel Balance

The Summary page originally had a `lg:grid-cols-3` section where the left `최근 변경` card spanned two columns and the right column contained only a short blue `AI 인사이트 (예시)` card. On desktop this left a large empty area beneath the blue card, making the section look visually unbalanced.

Current layout in `apps/web/app/routes/summary.tsx`:

- The left side remains `Card className="lg:col-span-2 overflow-hidden"` for recent changes.
- The right side is now a stacked insight panel instead of a single `h-fit` card.
- The right panel contains:
  - `AI 인사이트 (예시)`
  - `최근 수집 요약`, reusing the later KPI values via `kpis.slice(2, 4)`
  - `다음 확인 포인트`

This keeps the original AI insight copy, but gives the right column enough informational weight to balance against the longer timeline card.

QA performed for this adjustment:

- Desktop viewport: `1280x800`
  - Confirmed the right side is no longer a lone short card floating above a large blank area.
  - Confirmed `최근 수집 요약` and `다음 확인 포인트` render in the right column.
- Mobile viewport: `390x844`
  - Confirmed the panel stacks below `최근 변경`.
  - Confirmed no horizontal overflow: `document.documentElement.scrollWidth` remained within viewport width.
- `npm run typecheck -w @celine/web` passed.
- `npm run build -w @celine/web` passed.
- Browser console had no relevant `error` or `warn` entries during QA.

## Mobile Chrome Translation / Material Symbols

Mobile Chrome showed broken oversized text such as `EVENT+` and `TRENDING AREA` where Material Symbols icons should have appeared. The root cause was Chrome/Google Translate treating Material Symbols ligature text such as `event`, `trending_up`, and `dashboard` as translatable page text. The app also previously declared `<html lang="en">`, which made Chrome more likely to offer or apply page translation on a Korean dashboard.

Current fix:

- `apps/web/app/root.tsx`
  - `<html lang="ko" translate="no" className="light">`
  - `<body className="notranslate bg-background text-on-surface">`
- `apps/web/app/app.css`
  - `.material-symbols-outlined` explicitly sets `font-family: "Material Symbols Outlined"`.
  - The icon class also fixes ligature rendering details: `font-feature-settings: "liga"`, `line-height: 1`, `letter-spacing: normal`, `text-transform: none`, `white-space: nowrap`, and `direction: ltr`.
- Every JSX usage of `material-symbols-outlined` now also includes `notranslate`.

Do not remove `notranslate` from icon spans unless replacing Material Symbols with real SVG/icon components. Material Symbols are text ligatures; if translation touches them, they can render as visible words instead of icons.

QA performed for this adjustment:

- Mobile viewport: `390x844`
- Checked `/` and `/feed`.
- Verified:
  - `document.documentElement.lang === "ko"`
  - `document.documentElement.getAttribute("translate") === "no"`
  - `document.body.classList.contains("notranslate") === true`
  - All rendered `.material-symbols-outlined` nodes had the `notranslate` class.
  - First icon computed font was `"Material Symbols Outlined"`.
  - Icon max width stayed at `24px` instead of expanding into translated text.
  - `document.documentElement.scrollWidth` stayed within the mobile viewport.
  - Text fragments from the broken screenshot, including `EVENT+` and `TRENDING AREA`, were absent.
  - Mobile bottom nav click from `/` to `/feed` worked.
- `npm run typecheck -w @celine/web` passed.
- `npm run build -w @celine/web` passed.
- Browser console had no relevant `error` or `warn` entries during QA.

## Relevant Commits

- `2bc0474 Configure web Hyperdrive binding`
- `ee49151 Fix local Workers dev setup`
- `fa325b2 Fix Cloudflare Workers deploy command`
- `d388a35 Use request scoped DB context for Workers`
- `44de625 Improve mobile dashboard layout`
- `5288e8b Document mobile responsive handoff notes`
- `4259683 Balance summary insight panel`
- `6f02cca Prevent mobile Chrome icon translation`

## Useful Verification Commands

```bash
npm run typecheck -w @celine/web
npm run build -w @celine/web
XDG_CONFIG_HOME=/tmp npx wrangler deploy --dry-run --config apps/web/build/server/wrangler.json
```

For local runtime verification:

```bash
npm run dev
curl -s -o /tmp/celineit-home.html -w "%{http_code}\n" http://localhost:5173/
```

If port `5173` is in use, Vite will choose another port. Use the port printed by the dev server.

For mobile responsive smoke checks, use a browser viewport around `390x844` and inspect `document.documentElement.scrollWidth` against `window.innerWidth` on the main routes listed above.
