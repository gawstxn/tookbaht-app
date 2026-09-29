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
- **Native feel:** no skeletons or spinners on screens that read the in-memory store; bottom sheets for choices; a toast for every change (with undo for deletes); every delete asks first in a `ConfirmSheet` drawer; no zoom, no scrollbars, no focus rings on touch.
- **No emoji anywhere in the app** (UI copy, toasts, push texts, empty states): use words, or an `Icon` from `components/ui/Icon.tsx`.
- **No browser-native pickers or dialogs, ever:** no `<input type="date|month|week|time|datetime-local|color|range">`, no `<select>`, no `alert` / `confirm` / `prompt`. Use the app's own components: `DateSheet` / `Calendar` / `MonthSheet` / `AccountSheet` / `CategorySheet` in `components/pickers.tsx`, `Chip` / `Segmented` / `Switch` / `Sheet` in `components/ui/primitives.tsx`. If nothing fits, build a custom sheet in the same style. Plain text and number fields (the on-screen keyboard) are fine, and so are the hidden file inputs behind "restore from backup" and "อ่านสลิป" (the OS file / photo chooser has no alternative).
- **Layout:** mobile first at 390–430px wide (the shell caps at 430px); verify at 414×896.
- **Data flow:** the Zustand store updates the screen first, then writes to Supabase and rolls back on failure (`save()` in `lib/store.ts`). Money maths, dates, schedules and filters live in pure functions in `lib/` with unit tests.
- **Database:** new tables start with no API access (default privileges are revoked): grant exactly what the app uses, never `all`, and never TRUNCATE (it skips RLS). Every table has `user_id` plus RLS; cross-row references use composite `(id, user_id)` foreign keys. Scheduled work (auto-log, reminders, alerts) belongs in SQL functions with DB tests in `tests/db`. A new migration must also be applied to production with `npx supabase db push` when its PR is merged.
- **Database size:** production is on the Supabase free tier, 500 MB for the whole database (indexes, `auth` and `cron` included). A transaction costs about 330 bytes with its indexes. Every new user table gets a row cap (`enforce_row_cap`; entries are capped at 30,000 per user, about 10 MB) and every free-form text, array or jsonb column a length check; a table that only remembers what was already sent or done gets purged in `purge_old_logs()`; don't store what can be worked out from rows already kept; prefer partial indexes (`where x is not null`) on mostly-empty columns. Check the size (Supabase dashboard → Database → Database size) before merging anything that stores a new row per user per day.
- **Navigation:** route changes animate with React `ViewTransition` (`PageTransition` in `components/AppShell.tsx`): deeper paths slide in, shallower ones slide back, tab roots switch instantly. For close / back buttons use `useGoBack(fallback)` from `lib/nav.ts`, not `router.back()`, which doesn't animate.
- **Per-device settings** (theme, language before sign-in, app lock) live in localStorage; account-wide settings live in `profiles.settings`.
- **Legal pages:** when a change affects what data is kept, why, where, or for how long (new fields, retention, notifications, on-device storage), update `components/legal/PrivacyContent.tsx` / `TermsContent.tsx` in both languages and bump `TERMS_VERSION` in `lib/legal.ts` so users accept the new version. Set `TERMS_UPDATED` to the day you make the change, read from the clock (`TZ=Asia/Bangkok date +%F`); `TERMS_VERSION` is a label, not a date (see the comment in `lib/legal.ts`).

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

# Dates

Never invent or count forward a date: take it from the clock (`TZ=Asia/Bangkok date +%F`) or from git. The terms page showed 16 Oct on 29 Sep because `TERMS_VERSION` was bumped a day per change and later copied from a migration name.

- `TERMS_UPDATED` is the day the legal text changed; a unit test fails if it's in the future.
- Migration file names only set the order. The newest ones are already dated ahead of the calendar and can't be renamed (production has applied them), and `db push` refuses a file that sorts before the last one applied. Name a new migration after the newest file: today's timestamp if that is later, otherwise the newest name plus one second (`20261017000000` → `20261017000001`), never plus a day. Never use a migration name as "today".
- Tests that depend on today use `current_date` / `user_today()` in SQL or build dates from `new Date()`, never hard-coded days that go stale.

# Mistakes that keep coming back

Each of these reached users at least once; check them before opening a PR.

- **Fixing one place only.** A behaviour lives in several screens (hiding amounts on Home but not in the account picker; delete confirmations; pickers). Grep for every place that does the same thing and change them together, or move it into one shared component.
- **iOS Safari, not only Chromium.** Headless Chromium hides WebKit layout bugs: an element that takes its height from an image (round avatars turned into ovals), and Face ID in home-screen apps. Give sized boxes an explicit size, and say in the PR when something needs a check on a real iPhone.
- **Thai text length.** Thai labels are often longer than the English ones: check both languages at 390px wide for wrapping and cramped rows (onboarding balance label, split rows, tier labels).
- **Callbacks in effect dependencies.** A parent that passes a new function each render re-runs the child's effect (the sheet that pulled focus off the text field after every keystroke). Read callbacks through a ref inside effects.
- **End states only.** Transitions that looked fine before and after but ghosted or didn't slide mid-flight: see "Verifying changes".
- **Rules already listed above** (native pickers, emoji, `confirm()`, hard-coded copy or colours) each needed a fix PR before they became rules; search the diff for them.

# Versioning

The app version in `package.json` is shown on the profile page, and every merge to `main` deploys to production. Bump it in the same PR as the change:

- `feat:` → minor (1.4.0 → 1.5.0)
- `fix:` → patch (1.5.0 → 1.5.1)
- Breaking change or major redesign → major (→ 2.0.0)
- `refactor:` / `chore:` / `docs:` / `test:` with no user-visible change → no bump

If a PR mixes types, use the highest one. Bump with `npm version <x.y.z> --no-git-tag-version` so `package-lock.json` stays in sync.

A `feat:` release also adds its highlights to `RELEASES` in `lib/whatsNew.ts` (copy under `whatsNew.<key>` in both locales); users see them once in the "มีอะไรใหม่" drawer after updating.

# Tests

`npm test` runs Vitest: unit tests for `lib/` in `tests/unit`, and database tests in `tests/db` that apply every migration in `supabase/migrations` to an in-memory Postgres (PGlite) — no Docker needed. CI runs them on every PR. Add a test with any change to money maths, billing dates, auto-log or RLS; a new migration is picked up automatically.
