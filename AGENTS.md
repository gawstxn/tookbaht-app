<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Tookbaht

Personal-finance PWA used on an iPhone as an installed app. Thai-first (English too). See README.md for features and setup.

## Commands

- `npm run dev` · `npm test` · `npm run lint` · `npm run build` (also type-checks)
- Local database: `npx supabase start` (Docker Desktop must be running), `npx supabase migration up` after adding a migration.
- Local sign-in: the one-tap "dev@tookbaht.local" button on /login (needs `NEXT_PUBLIC_DEV_LOGIN=true` and a local Supabase URL). The onboarding "sample data" button fills a demo account.

## Conventions

- **Text:** every user-facing string goes in both `lib/locales/th.ts` and `lib/locales/en.ts`; never hard-code copy in components. Push texts are built server-side in `lib/pushText.ts`.
- **Colour:** use the tokens in `app/globals.css` (`bg-card`, `text-muted`, …), never hex values in components, so dark mode keeps working. `ink` flips to cream in dark mode; the dark signature cards use `hero` / `on-hero`, and text on lime uses `on-lime`. Check new screens in both themes.
- **Native feel:** no skeletons or spinners on screens that read the in-memory store; bottom sheets for choices; a toast for every change (with undo for deletes); no zoom, no scrollbars, no focus rings on touch.
- **Layout:** mobile first at 390–430px wide (the shell caps at 430px); verify at 414×896.
- **Data flow:** the Zustand store updates the screen first, then writes to Supabase and rolls back on failure (`save()` in `lib/store.ts`). Money maths, dates, schedules and filters live in pure functions in `lib/` with unit tests.
- **Database:** every table has `user_id` plus RLS; cross-row references use composite `(id, user_id)` foreign keys. Scheduled work (auto-log, reminders, alerts) belongs in SQL functions with DB tests in `tests/db`. A new migration must also be applied to production with `npx supabase db push` when its PR is merged.
- **Navigation:** route changes animate with React `ViewTransition` (`PageTransition` in `components/AppShell.tsx`): deeper paths slide in, shallower ones slide back, tab roots switch instantly. For close / back buttons use `useGoBack(fallback)` from `lib/nav.ts`, not `router.back()`, which doesn't animate.
- **Per-device settings** (theme, language before sign-in, app lock) live in localStorage; account-wide settings live in `profiles.settings`.
- **Legal pages:** when a change affects what data is kept, why, where, or for how long (new fields, retention, notifications, on-device storage), update `components/legal/PrivacyContent.tsx` / `TermsContent.tsx` in both languages and bump `TERMS_VERSION` in `lib/legal.ts` so users accept the new version.

## Performance

- Keep transitions compositor-only: animate `transform` / `opacity`; no box-shadows, filters or blur on view-transition layers (they repaint a full-page layer every frame and stutter on phones).
- Judge smoothness on a production build (`npm run build` then `npm run start`), not the dev server; throttle the CPU 4× in DevTools to approximate an iPhone.
- Don't add dependencies for things a few lines can do; check the first-load JS when adding one. supabase-js is the largest chunk; its Realtime and Storage clients are swapped for stubs in the browser (`turbopack.resolveAlias` → `lib/stubs/`), so using Realtime or Storage from client code means removing that alias first.
- Only import font weights that are used (see `app/layout.tsx`).
- Memoise derived lists on screens with many transactions (`useMemo` over store data); don't recompute per row.
- Charts are hand-written SVG (see `app/insights/page.tsx`); no chart library.

## Verifying changes

- Always: `npm run lint`, `npm test`, `npx tsc --noEmit`, `npm run build`.
- UI changes: run the app against local Supabase and check the affected screens at 414×896 in light and dark. Headless Playwright works when the browser pane can't render.
- Animations: check them mid-flight, not only before and after: slow them 10× with CDP `Animation.setPlaybackRate` and screenshot. Pages ghosting through each other and back buttons with no slide both reached users because only end states were checked.

## Pull requests

- Branch from `main` (`feat/…`, `fix/…`), Conventional Commits, bump the version (below), open a PR with a test plan.
- Merge only when the user asks, after CI is green; confirm the Vercel production deploy afterwards.

# Versioning

The app version in `package.json` is shown on the profile page, and every merge to `main` deploys to production. Bump it in the same PR as the change:

- `feat:` → minor (1.4.0 → 1.5.0)
- `fix:` → patch (1.5.0 → 1.5.1)
- Breaking change or major redesign → major (→ 2.0.0)
- `refactor:` / `chore:` / `docs:` / `test:` with no user-visible change → no bump

If a PR mixes types, use the highest one. Bump with `npm version <x.y.z> --no-git-tag-version` so `package-lock.json` stays in sync.

# Tests

`npm test` runs Vitest: unit tests for `lib/` in `tests/unit`, and database tests in `tests/db` that apply every migration in `supabase/migrations` to an in-memory Postgres (PGlite) — no Docker needed. CI runs them on every PR. Add a test with any change to money maths, billing dates, auto-log or RLS; a new migration is picked up automatically.
