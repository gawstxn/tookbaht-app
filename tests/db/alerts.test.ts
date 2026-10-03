import { beforeAll, describe, expect, it } from "vitest"
import { migratedDb } from "./setup"

const ADMIN = "aaaaaaaa-0000-0000-0000-000000000001"
const USER = "bbbbbbbb-0000-0000-0000-000000000002"
const ACC = "a0000000-0000-0000-0000-00000000000a"

let t: Awaited<ReturnType<typeof migratedDb>>
type AlertRow = { key: string; kind: string; data: Record<string, unknown>; sent_at: string | null }
const alerts = (kind: string) =>
  t.rows<AlertRow>(`select key, kind, data, sent_at from public.admin_alerts where kind = '${kind}' order by key`)
// Noon in Bangkok today, so the morning summary is due whatever time the tests run.
const NOON = `(current_date + time '12:00') at time zone 'Asia/Bangkok'`

describe.sequential("alerts for the maintainers", () => {
  beforeAll(async () => {
    t = await migratedDb()
    await t.db.exec(`
      insert into auth.users (id, email, raw_user_meta_data) values
        ('${ADMIN}', 'admin@x.com', '{"name":"Admin"}'), ('${USER}', 'user@x.com', '{"name":"Somchai"}');
      update public.profiles set role = 'admin' where id = '${ADMIN}';
      insert into public.accounts (id, user_id, name, kind) values ('${ACC}', '${USER}', 'เงินสด', 'cash');
    `)
  })

  it("is closed to users, and the server can't rewrite or delete an alert", async () => {
    for (const uid of [USER, ADMIN, null]) {
      await expect(t.as(uid, `select * from public.admin_alerts`)).rejects.toThrow(/permission denied/)
      await expect(t.as(uid, `select public.collect_alerts()`)).rejects.toThrow(/permission denied/)
      await expect(t.as(uid, `select public.ping_alerts()`)).rejects.toThrow(/permission denied/)
      await expect(t.as(uid, `select * from public.system_health()`)).rejects.toThrow(/permission denied/)
    }
    const can = async (priv: string) =>
      (
        await t.rows<{ ok: boolean }>(`select has_table_privilege('service_role', 'public.admin_alerts', '${priv}') ok`)
      )[0].ok
    expect([await can("select"), await can("insert"), await can("delete"), await can("truncate")]).toEqual([
      true,
      true,
      false,
      false,
    ])
    expect(
      await t.rows(
        `select has_column_privilege('service_role', 'public.admin_alerts', 'sent_at', 'update') a,
                has_column_privilege('service_role', 'public.admin_alerts', 'data', 'update') b`,
      ),
    ).toEqual([{ a: true, b: false }])
  })

  it("a quiet day raises nothing but the morning summary, once", async () => {
    await t.db.exec(`select public.collect_alerts(${NOON})`)
    await t.db.exec(`select public.collect_alerts(${NOON})`)
    const all = await t.rows<AlertRow>(`select kind, data from public.admin_alerts`)
    expect(all.map((a) => a.kind)).toEqual(["summary"])
    expect(all[0].data).toMatchObject({ users: 2, suspended: 0, feedbackOpen: 0, entriesDay: 0 })
    expect(Number(all[0].data.dbBytes)).toBeGreaterThan(0)
  })

  it("the summary waits for 08:00 Bangkok", async () => {
    await t.db.exec(`delete from public.admin_alerts`)
    await t.db.exec(`select public.collect_alerts((current_date + time '07:30') at time zone 'Asia/Bangkok')`)
    expect(await alerts("summary")).toEqual([])
  })

  it("an account writing in a loop is raised once a day, by name and count only", async () => {
    await t.db.exec(`
      insert into public.transactions (user_id, type, amount, date, account_id, category, title)
      select '${USER}', 'out', 1, current_date, '${ACC}', 'food', 'secret lunch' from generate_series(1, 2001)`)
    await t.db.exec(`select public.collect_alerts(); select public.collect_alerts()`)
    const rows = await alerts("writes")
    expect(rows).toHaveLength(1)
    expect(rows[0].key).toMatch(new RegExp(`^writes:${USER}:\\d{4}-\\d\\d-\\d\\d$`))
    expect(rows[0].data).toEqual({ name: "Somchai", count: 2001 })
    expect(JSON.stringify(rows)).not.toMatch(/secret|user@x.com/)
    // 2,000 in a day is still a person (or an import).
    await t.db.exec(`delete from public.admin_alerts;
      delete from public.transactions where id in (select id from public.transactions limit 1)`)
    await t.db.exec(`select public.collect_alerts()`)
    expect(await alerts("writes")).toEqual([])
  })

  it("an account at a table's cap is raised", async () => {
    await t.db.exec(`
      insert into public.accounts (user_id, name, kind) select '${USER}', 'a' || n, 'cash' from generate_series(1, 99) n`)
    await t.db.exec(`select public.collect_alerts(); select public.collect_alerts()`)
    const rows = await alerts("cap")
    expect(rows.map((r) => [r.key, r.data])).toEqual([
      [`cap:${USER}:accounts`, { name: "Somchai", table: "accounts", count: 100 }],
    ])
  })

  it("an account that used up its problem reports for the day is raised", async () => {
    for (let i = 0; i < 20; i++) await t.as(USER, `insert into public.feedback (message) values ('spam ${i}')`)
    await t.db.exec(`select public.collect_alerts()`)
    const rows = await alerts("fbspam")
    expect(rows.map((r) => r.data)).toEqual([{ name: "Somchai", count: 20 }])
    expect(JSON.stringify(rows)).not.toMatch(/spam \d/)
  })

  it("a burst of sign-ups within an hour is raised", async () => {
    await t.db.exec(`
      insert into auth.users (id, email) select gen_random_uuid(), 'bot' || n || '@x.com' from generate_series(1, 21) n`)
    await t.db.exec(`select public.collect_alerts(); select public.collect_alerts()`)
    const rows = await alerts("signups")
    expect(rows).toHaveLength(1)
    expect(Number(rows[0].data.count)).toBeGreaterThan(20)
    expect(String(rows[0].data.hour)).toMatch(/^\d\d:00$/)
  })

  it("suspending and lifting leave a record of who did it, only when something changed", async () => {
    await t.as(ADMIN, `select public.admin_set_suspended('${USER}', true, 'สแปม')`)
    await t.as(ADMIN, `select public.admin_set_suspended('${USER}', true, 'อีกครั้ง')`)
    await t.as(ADMIN, `select public.admin_set_suspended('${USER}', false)`)
    await t.as(ADMIN, `select public.admin_set_suspended('${USER}', false)`)
    expect((await alerts("suspended")).map((r) => r.data)).toEqual([{ name: "Somchai", admin: "Admin", note: "สแปม" }])
    expect((await alerts("lifted")).map((r) => r.data)).toEqual([{ name: "Somchai", admin: "Admin", note: "" }])
    // Still refused for anyone else, and nothing is recorded.
    await expect(t.as(USER, `select public.admin_set_suspended('${ADMIN}', true)`)).rejects.toThrow(/admin only/)
    await expect(t.as(ADMIN, `select public.admin_set_suspended(gen_random_uuid(), true)`)).rejects.toThrow(
      /no such user/,
    )
    expect(
      await t.rows(`select count(*)::int n from public.admin_alerts where kind in ('suspended', 'lifted')`),
    ).toEqual([{ n: 2 }])
  })

  it("alerts are kept for a month", async () => {
    await t.db.exec(`
      insert into public.admin_alerts (key, kind, created_at) values
        ('old', 'job', now() - interval '31 days'), ('recent', 'job', now() - interval '29 days');
      select public.purge_old_logs()`)
    expect((await alerts("job")).map((r) => r.key)).toEqual(["recent"])
  })

  it("the database calls the alerts route only once its address and secret are in Vault", async () => {
    // No Vault and no pg_net here: nothing happens.
    await t.db.exec(`select public.ping_alerts()`)
    await t.db.exec(`
      create schema vault; create table vault.decrypted_secrets (name text, decrypted_secret text);
      create schema net; create table net.calls (url text, headers jsonb);
      create function net.http_get(url text, params jsonb default '{}', headers jsonb default '{}', timeout_milliseconds integer default 5000)
        returns bigint language sql as $$ insert into net.calls values (url, headers); select 1::bigint $$;
      select public.ping_alerts();
      insert into vault.decrypted_secrets values ('app_url', 'https://app.example/');
      select public.ping_alerts();
      insert into vault.decrypted_secrets values ('cron_secret', 's3cret');
      select public.ping_alerts();`)
    expect(await t.rows(`select url, headers from net.calls`)).toEqual([
      { url: "https://app.example/api/cron/alerts", headers: { Authorization: "Bearer s3cret" } },
    ])
  })
})
