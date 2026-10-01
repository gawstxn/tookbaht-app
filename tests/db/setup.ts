import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { PGlite } from "@electric-sql/pglite"

const MIGRATIONS = join(__dirname, "../../supabase/migrations")

/**
 * An in-memory Postgres with every migration applied, plus the few pieces of
 * Supabase the schema relies on (auth.users, auth.uid(), the API roles and
 * their default privileges).
 * pg_cron doesn't exist here, so the scheduling tail of that migration is cut.
 */
export async function migratedDb() {
  const db = new PGlite()
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin;
    create schema auth;
    create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}', last_sign_in_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema public, auth to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated, service_role;
    -- Like a hosted Supabase project: new tables and functions are open to the API roles unless a migration says otherwise.
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
  `)
  for (const file of readdirSync(MIGRATIONS).sort()) {
    const sql = readFileSync(join(MIGRATIONS, file), "utf8").replace(
      /create extension if not exists pg_cron[\s\S]*$/m,
      "",
    )
    await db.exec(sql)
  }

  /** Run as a signed-in user (uid), or as anon (null), the way PostgREST would. */
  const as = async <T = Record<string, unknown>>(uid: string | null, sql: string) => {
    await db.exec(
      `reset role; select set_config('request.jwt.claim.sub', '${uid ?? ""}', false); set role ${uid ? "authenticated" : "anon"};`,
    )
    try {
      return (await db.query<T>(sql)).rows
    } finally {
      await db.exec("reset role")
    }
  }
  /** Several statements as one user. */
  const asExec = async (uid: string | null, sql: string) => {
    await db.exec(
      `reset role; select set_config('request.jwt.claim.sub', '${uid ?? ""}', false); set role ${uid ? "authenticated" : "anon"};`,
    )
    try {
      await db.exec(sql)
    } finally {
      await db.exec("reset role")
    }
  }
  const rows = async <T = Record<string, unknown>>(sql: string) => (await db.query<T>(sql)).rows
  return { db, as, asExec, rows }
}
