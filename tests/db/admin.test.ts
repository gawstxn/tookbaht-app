import { beforeAll, describe, expect, it } from "vitest"
import { migratedDb } from "./setup"

const ADMIN = "aaaaaaaa-0000-0000-0000-000000000001"
const USER = "bbbbbbbb-0000-0000-0000-000000000002"
const OTHER = "cccccccc-0000-0000-0000-000000000003"

let t: Awaited<ReturnType<typeof migratedDb>>

describe.sequential("admin role", () => {
  beforeAll(async () => {
    t = await migratedDb()
    await t.db.exec(`
      insert into auth.users (id, email, raw_user_meta_data) values
        ('${ADMIN}', 'admin@x.com', '{"name":"Admin"}'), ('${USER}', 'user@x.com', '{"name":"Somchai"}'), ('${OTHER}', 'other@x.com', '{"name":"Other"}');
      update public.profiles set role = 'admin' where id = '${ADMIN}';
    `)
    await t.as(USER, `insert into public.accounts (name, kind) values ('เงินสด', 'cash')`)
    const [acc] = await t.as<{ id: string }>(USER, `select id from public.accounts`)
    await t.as(
      USER,
      `insert into public.transactions (type, amount, date, account_id, category, title) values
        ('out', 50, current_date, '${acc.id}', 'food', 'secret lunch'), ('out', 70, current_date, '${acc.id}', 'food', 'secret dinner')`,
    )
    await t.as(USER, `insert into public.feedback (message, page) values ('ปุ่มกดไม่ได้', '/add')`)
  })

  it("nobody can make themselves an admin", async () => {
    await expect(t.as(USER, `update public.profiles set role = 'admin' where id = '${USER}'`)).rejects.toThrow(
      /permission/,
    )
    await expect(t.as(USER, `update public.profiles set suspended_at = null where id = '${USER}'`)).rejects.toThrow(
      /permission/,
    )
    await expect(t.as(USER, `update public.profiles set last_active_at = now() where id = '${USER}'`)).rejects.toThrow(
      /permission/,
    )
    await expect(t.db.exec(`update public.profiles set role = 'owner' where id = '${USER}'`)).rejects.toThrow(/check/)
  })

  it("only admins can use the admin functions", async () => {
    for (const call of [
      `select * from public.admin_users()`,
      `select * from public.admin_overview()`,
      `select * from public.admin_feedback()`,
      `select public.admin_set_suspended('${OTHER}', true)`,
      `select public.admin_resolve_feedback(gen_random_uuid(), true)`,
    ]) {
      await expect(t.as(USER, call), call).rejects.toThrow(/admin only/)
      await expect(t.as(null, call), call).rejects.toThrow(/permission/)
    }
    await expect(t.as(USER, `select public.is_admin()`)).rejects.toThrow(/permission/)
    expect(await t.rows(`select suspended_at from public.profiles where id = '${OTHER}'`)).toEqual([
      { suspended_at: null },
    ])
  })

  it("lists users with a count of entries, never the entries", async () => {
    const rows = await t.as<Record<string, unknown>>(ADMIN, `select * from public.admin_users()`)
    expect(rows.map((r) => r.email).sort()).toEqual(["admin@x.com", "other@x.com", "user@x.com"])
    const user = rows.find((r) => r.email === "user@x.com")!
    expect(user).toMatchObject({ name: "Somchai", role: "user", suspended_at: null })
    expect(Number(user.entries)).toBe(2)
    expect(JSON.stringify(rows)).not.toMatch(/secret/)
  })

  it("shows one account's counts and sizes, never what was logged or its settings", async () => {
    await t.as(USER, `select public.merge_settings('{"lang":"en","promptPayId":"0812345678"}')`)
    await t.as(
      USER,
      `insert into public.ious (person, amount, date, note) values ('secret friend', 10, current_date, 'secret note')`,
    )
    const [d] = await t.as<Record<string, unknown>>(ADMIN, `select * from public.admin_user_detail('${USER}')`)
    for (const [key, n] of Object.entries({
      accounts: 1,
      subscriptions: 0,
      ious: 1,
      savings_goals: 0,
      wishes: 0,
      entries: 2,
      entries_day: 2,
      entries_week: 2,
      feedback: 1,
      feedback_day: 1,
      push_devices: 0,
    }))
      expect(Number(d[key]), key).toBe(n)
    expect(Number(d.data_bytes)).toBeGreaterThan(100)
    expect(JSON.stringify(d)).not.toMatch(/secret|0812345678|"en"|Bangkok/)
    // Entries from days ago aren't in the last 24 hours.
    await t.db.exec(`update public.transactions set created_at = now() - interval '3 days' where user_id = '${USER}'`)
    const [later] = await t.as<Record<string, unknown>>(ADMIN, `select * from public.admin_user_detail('${USER}')`)
    expect([Number(later.entries_day), Number(later.entries_week)]).toEqual([0, 2])
    expect(await t.as(ADMIN, `select * from public.admin_user_detail(gen_random_uuid())`)).toEqual([])
    await expect(t.as(USER, `select * from public.admin_user_detail('${USER}')`)).rejects.toThrow(/admin only/)
    await expect(t.as(null, `select * from public.admin_user_detail('${USER}')`)).rejects.toThrow(/permission/)
  })

  it("searches by name or email and pages", async () => {
    const find = async (q: string) =>
      (await t.as<{ email: string }>(ADMIN, `select email from public.admin_users('${q}')`)).map((r) => r.email)
    expect(await find("somch")).toEqual(["user@x.com"])
    expect(await find("OTHER@")).toEqual(["other@x.com"])
    // A wildcard is just a character.
    expect(await find("%")).toEqual([])
    expect(await t.as(ADMIN, `select email from public.admin_users('', 2, 0)`)).toHaveLength(2)
    expect(await t.as(ADMIN, `select email from public.admin_users('', 2, 2)`)).toHaveLength(1)
  })

  it("records when a user last used the app, at most every five minutes", async () => {
    await t.as(USER, `select public.touch_active()`)
    const [first] = await t.rows<{ at: string | null }>(
      `select last_active_at::text at from public.profiles where id = '${USER}'`,
    )
    expect(first.at).not.toBeNull()
    await t.as(USER, `select public.touch_active()`)
    expect(await t.rows(`select last_active_at::text at from public.profiles where id = '${USER}'`)).toEqual([
      { at: first.at },
    ])
    // Six minutes on, the next call moves it.
    await t.db.exec(`update public.profiles set last_active_at = now() - interval '6 minutes' where id = '${USER}'`)
    await t.as(USER, `select public.touch_active()`)
    const [later] = await t.rows<{ fresh: boolean }>(
      `select last_active_at > now() - interval '1 minute' as fresh from public.profiles where id = '${USER}'`,
    )
    expect(later.fresh).toBe(true)
    // Most recently active first; someone who never opened the app goes last.
    const order = await t.as<{ email: string }>(ADMIN, `select email from public.admin_users()`)
    expect(order[0].email).toBe("user@x.com")
    expect(await t.rows(`select last_active_at from public.profiles where id = '${OTHER}'`)).toEqual([
      { last_active_at: null },
    ])
  })

  it("counts users, recent activity, open reports and the database size", async () => {
    const [o] = await t.as<Record<string, unknown>>(ADMIN, `select * from public.admin_overview()`)
    expect(Number(o.users)).toBe(3)
    expect(Number(o.active_day)).toBe(1)
    expect(Number(o.active_week)).toBe(1)
    expect(Number(o.suspended)).toBe(0)
    expect(Number(o.feedback_open)).toBe(1)
    expect(Number(o.db_bytes)).toBeGreaterThan(0)
  })

  it("shows problem reports with who sent them, and marks them done", async () => {
    const [f] = await t.as<{ id: string; email: string; message: string; page: string; resolved_at: string | null }>(
      ADMIN,
      `select id, email, message, page, resolved_at from public.admin_feedback()`,
    )
    expect(f).toMatchObject({ email: "user@x.com", message: "ปุ่มกดไม่ได้", page: "/add", resolved_at: null })
    await t.as(ADMIN, `select public.admin_resolve_feedback('${f.id}', true)`)
    expect(await t.as(ADMIN, `select id from public.admin_feedback(true)`)).toEqual([])
    expect(await t.as(ADMIN, `select id from public.admin_feedback()`)).toHaveLength(1)
    await t.as(ADMIN, `select public.admin_resolve_feedback('${f.id}', false)`)
    expect(await t.as(ADMIN, `select id from public.admin_feedback(true)`)).toHaveLength(1)
    // Users still can't read reports back, their own included.
    await expect(t.as(USER, `select * from public.feedback`)).rejects.toThrow(/permission/)
  })
})

describe.sequential("suspending an account", () => {
  it("refuses a suspended user's requests and lets them back in when lifted", async () => {
    await t.as(USER, `select public.check_request()`)
    await t.as(ADMIN, `select public.admin_set_suspended('${USER}', true, 'writing in a loop')`)
    expect(
      await t.rows(`select suspended_at is not null as on, suspended_note from public.profiles where id = '${USER}'`),
    ).toEqual([{ on: true, suspended_note: "writing in a loop" }])
    await expect(t.as(USER, `select public.check_request()`)).rejects.toThrow(/account suspended/)
    // Everyone else, signed-out visitors and background jobs are unaffected.
    await t.as(OTHER, `select public.check_request()`)
    await t.as(null, `select public.check_request()`)
    await t.db.exec(`select public.check_request()`)

    await t.as(ADMIN, `select public.admin_set_suspended('${USER}', false)`)
    expect(await t.rows(`select suspended_at, suspended_note from public.profiles where id = '${USER}'`)).toEqual([
      { suspended_at: null, suspended_note: "" },
    ])
    await t.as(USER, `select public.check_request()`)
  })

  it("never suspends an admin, and a suspended admin loses the role's powers", async () => {
    await expect(t.as(ADMIN, `select public.admin_set_suspended('${ADMIN}', true)`)).rejects.toThrow(
      /cannot be suspended/,
    )
    await expect(t.as(ADMIN, `select public.admin_set_suspended(gen_random_uuid(), true)`)).rejects.toThrow(
      /no such user/,
    )
    await t.db.exec(`update public.profiles set suspended_at = now() where id = '${ADMIN}'`)
    await expect(t.as(ADMIN, `select * from public.admin_users()`)).rejects.toThrow(/admin only/)
    await t.db.exec(`update public.profiles set suspended_at = null where id = '${ADMIN}'`)
  })

  it("keeps the note short", async () => {
    await t.as(ADMIN, `select public.admin_set_suspended('${OTHER}', true, repeat('x', 500))`)
    expect(await t.rows(`select char_length(suspended_note) n from public.profiles where id = '${OTHER}'`)).toEqual([
      { n: 200 },
    ])
  })
})
