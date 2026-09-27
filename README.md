<p align="center">
  <img src="docs/logo.png" alt="Tookbaht" width="112" height="112" />
</p>

<h1 align="center">Tookbaht · ทุกบาท</h1>

<p align="center">
  A personal finance app for your phone. Install it to the home screen and it works like a native app.<br />
  Income, spending, transfers, subscriptions, installments, budgets and savings goals in one place, Thai-first with English.
</p>

<p align="center">
  <a href="https://tookbaht.gawstxn.dev"><b>tookbaht.gawstxn.dev</b></a>
</p>

---

**Stack:** Next.js 16 (App Router, React 19) · TypeScript · Tailwind CSS v4 · Zustand · i18next · Supabase (Postgres, Auth, pg_cron) · Web Push · tesseract.js · Vercel · Vitest + PGlite

- [Features](#features)
- [How it works](#how-it-works)
- [Getting started](#getting-started)
- [Commands and tests](#commands-and-tests)
- [Project structure](#project-structure)
- [Deploying](#deploying)
- [Scheduled jobs](#scheduled-jobs)
- [Security](#security)
- [Credits](#credits)
- [License](#license)

## Features

### Logging money
- Income, expenses and transfers on a number pad that also adds up (`120+85` saves 205). Edit, delete, undo.
- New entries preselect the category and account you use most.
- **Read a slip:** pick a bank transfer slip photo and the amount, date and memo are filled in, or pick up to 10 and save them together after a check. Read on the device with tesseract.js (Thai); the photos never leave the phone.
- Your own expense and income categories next to the built-in ones.
- **Works offline:** opens from the copy on the device, queues what you log, and syncs when the connection is back.
- Trip / project tags, a double-save check, and "balance doesn't match" reconciling against your bank app.
- Activity list with search and filters (type, account, category, tag, date range).

### Every month
- **Subscriptions** with service logos, priced in baht or USD (converted at that day's rate plus the card's fee, optional +7% VAT).
- **Recurring entries** (salary, rent, monthly saving) logged by the database on schedule, even when the app is closed.
- **Installments** counted in the month each one is paid, stopping after the last.

### Cards and pay-later (e.g. SPayLater)
- Real remaining limit (the full price comes off on purchase, then back one installment at a time).
- Buy in installments: enter the price, months and the per-installment amount the shop shows; interest is worked out.
- Due day, what's due this cycle, and a "bill paid" transfer.

### Budgets, goals and insights
- Monthly income target, overall and per-category budgets with a "spent by today" pace line, and what's left to spend today.
- Budget rollover per category, savings goals with the amount to put aside each month.
- **Split a trip:** bills you paid under a trip tag plus bills friends paid, each shared by some of the group, settled in the fewest transfers; the ones involving you become money owed.
- Money owed with friends in both directions: split a bill evenly or by amount, show a PromptPay QR with the amount for a friend to scan, mark it paid back (repayments lower your spending rather than count as income).
- Insights: 6-month income vs spending, spending by category, categories running above usual, a spending calendar, net worth over 12 months, how many months your money would last, trips, and a year in review.
- Expenses logged by hand every month (rent paid by transfer) are spotted and offered as recurring entries.
- In-app notification center and Web Push: charges due tomorrow, payment due dates, budgets at 80% / over, price rises, the monthly summary, and an optional 8 pm "anything to log?" nudge.

### Your data
- Google sign-in, row-level security on every table, app lock with a 6-digit PIN or Face ID (passkey).
- JSON backup and restore, CSV export, account deletion with a 30-day grace period.
- Light / dark / system theme, Thai / English, and a "what's new" dialog after each update.

## How it works

- **Screens read an in-memory store** (`lib/store.ts`, Zustand). A change shows immediately, then is written to Supabase; if the write is refused the change is rolled back with a toast.
- **Offline:** every write is described as an operation (`lib/offline.ts`). Without a connection it waits in a per-user outbox and is replayed in order later. The last loaded data is kept on the device so the app opens instantly and offline; both are cleared on sign-out.
- **Service worker** (`public/sw.js`) keeps build files, screens and navigation data for offline use; app data never goes through it.
- **The database does the scheduled work:** SQL functions log due entries (pg_cron) and decide which reminders are due; Vercel Cron only delivers the pushes.
- **Security:** RLS on every table with composite `(id, user_id)` foreign keys, explicit table grants (no default API access, no TRUNCATE), per-user row caps, a static CSP (`'wasm-unsafe-eval'` only for the slip reader), and push only to known push services.

## Getting started

You need Node 22 and Docker Desktop (for the local Supabase).

```bash
npm install             # also copies the OCR engine into public/ocr
npx supabase start      # local Postgres + Auth on ports 553xx, applies every migration
npx supabase status     # copy API_URL / PUBLISHABLE_KEY / SECRET_KEY into .env.local (see .env.example)
npm run dev
```

Open http://localhost:3000 on your phone, or use a mobile viewport in DevTools (the app is designed for 390–430 px).

**One-tap local sign-in:** set `NEXT_PUBLIC_DEV_LOGIN=true` in `.env.local` and the login screen shows a "sign in now" button for `dev@tookbaht.local`. It only appears against a local Supabase. Onboarding then offers sample data.

After pulling new migrations run `npx supabase migration up`; to start over, `npx supabase db reset`.

### Environment variables

| Variable | Where it's used |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser and server |
| `SUPABASE_SECRET_KEY` | Server only: cron jobs, exchange rates |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Web Push (`npx web-push generate-vapid-keys`) |
| `CRON_SECRET` | Vercel Cron authorization |
| `NEXT_PUBLIC_CONTACT_EMAIL` | Contact on the privacy and terms pages (optional) |
| `NEXT_PUBLIC_DEV_LOGIN` | Local one-tap sign-in. **Never set in production.** |

## Commands and tests

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm test` | Vitest: unit tests (`tests/unit`) and database tests (`tests/db`) that apply every migration to an in-memory Postgres (PGlite), starting from Supabase's default privileges. No Docker needed. |
| `npm run lint` | ESLint |
| `npm run build` | Production build (also type-checks) |
| `npm run start` | Serve the production build: use it to check the service worker, push and animation smoothness |

CI (GitHub Actions) runs lint, tests and a build on every pull request. Conventions for contributors (and coding agents) are in [AGENTS.md](AGENTS.md).

## Project structure

```
app/                         Screens (App Router)
  page.tsx                   Home
  add/ transactions/ insights/ insights/year/ tags/ goals/ ious/ notifications/
  profile/ settings/ onboarding/ login/ privacy/ terms/
  accounts/ [id]/ [id]/buy/  Accounts, card / pay-later page, buy in installments
  subscriptions/ recurring/  Subscriptions and recurring entries
  api/cron/                  reminders (09:00) and evening (20:00) push jobs
components/
  ui/primitives.tsx          Card, HeroCard, Sheet (drawer or modal), Switch, Segmented, Chip, buttons
  AppShell.tsx               Session, loading, page transitions, sync, toasts, app lock
  app.tsx                    Bottom nav, screen scaffolds, transaction rows
  pickers.tsx                Calendar, month, account and category pickers
lib/
  store.ts db.ts offline.ts  Store, database mapping, offline outbox and device copy
  selectors.ts budget.ts insights.ts savings.ts ious.ts tags.ts quick.ts calc.ts slip.ts
                             Money maths, dates, schedules and filters: pure functions with tests
  locales/                   Thai and English strings
  push.ts pushText.ts        Push delivery and push copy (server)
supabase/migrations/         Schema, RLS, grants, scheduled logging, reminders
tests/unit tests/db          Unit and database tests
public/sw.js public/ocr/     Service worker; slip reader data
```

## Deploying

- Vercel deploys `main` automatically; every merge goes to production.
- A new migration goes out with `npx supabase db push` when its pull request is merged (the CLI is linked to the project).
- First-time setup: create a Supabase project (Singapore), enable the Google provider (redirect URI `https://<ref>.supabase.co/auth/v1/callback`), set the Site URL and Redirect URLs to the app's domain (`https://<domain>/**`), and add the environment variables above to Vercel.
- Keep the Email provider disabled so Google is the only way in.

## Scheduled jobs

- **Auto-log** (pg_cron, hourly): logs due subscriptions, recurring entries and installments in each user's time zone; never back-fills and never logs twice.
- **Daily push** (Vercel Cron, 09:00 Bangkok): charges due tomorrow, payments due tomorrow, budgets at 80% / over, last month's summary on the 1st–3rd. Each is sent once.
- **Evening push** (Vercel Cron, 20:00 Bangkok): a nudge to log, only for users who turned it on and logged nothing that day.
- Push works on production builds only; on iPhone the app must be installed to the home screen (iOS 16.4+).

## Security

Found a vulnerability? Please report it privately: see [SECURITY.md](SECURITY.md).

## Credits

- Service logos from [Simple Icons](https://simpleicons.org) (CC0). Names and logos are trademarks of their owners, shown only to identify each service.
- Slip reading by [tesseract.js](https://github.com/naptha/tesseract.js) (Apache-2.0) with the Thai model from [tessdata_fast](https://github.com/tesseract-ocr/tessdata_fast) (Apache-2.0).
- Fonts: IBM Plex Sans Thai, IBM Plex Mono, Noto Serif Thai.

## License

© 2026 gawstxn. All rights reserved.

The source is published so people can read and learn from it. No license is granted to copy, modify, redistribute, or use it in another product or service. Third-party parts keep their own licenses (see Credits).
