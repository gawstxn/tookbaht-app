<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Versioning

The app version in `package.json` is shown on the profile page, and every merge to `main` deploys to production. Bump it in the same PR as the change:

- `feat:` → minor (1.4.0 → 1.5.0)
- `fix:` → patch (1.5.0 → 1.5.1)
- Breaking change or major redesign → major (→ 2.0.0)
- `refactor:` / `chore:` / `docs:` / `test:` with no user-visible change → no bump

If a PR mixes types, use the highest one. Bump with `npm version <x.y.z> --no-git-tag-version` so `package-lock.json` stays in sync.

# Tests

`npm test` runs Vitest: unit tests for `lib/` in `tests/unit`, and database tests in `tests/db` that apply every migration in `supabase/migrations` to an in-memory Postgres (PGlite) — no Docker needed. CI runs them on every PR. Add a test with any change to money maths, billing dates, auto-log or RLS; a new migration is picked up automatically.
