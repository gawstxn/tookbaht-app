import { beforeAll, describe, expect, it } from "vitest"
import { migratedDb } from "./setup"

const A = "aaaaaaaa-0000-0000-0000-000000000001"
const B = "bbbbbbbb-0000-0000-0000-000000000002"

let t: Awaited<ReturnType<typeof migratedDb>>
type Result = { count: number; users: number; notify: boolean }
const report = (user: string | null, fp: string, message = "TypeError: boom") =>
  t.rows<Result>(
    `select * from public.report_error(${user ? `'${user}'` : "null"}, '${fp}', 'error', '${message}', 'at a (x.js:1:1)', '/add', '1.45.0', 'iPhone · Safari')`,
  )

describe.sequential("errors the app reports", () => {
  beforeAll(async () => {
    t = await migratedDb()
    await t.db.exec(`insert into auth.users (id, email) values ('${A}', 'a@x.com'), ('${B}', 'b@x.com')`)
  })

  it("is closed to everyone but the server's function", async () => {
    for (const uid of [A, null]) {
      await expect(t.as(uid, `select * from public.error_reports`)).rejects.toThrow(/permission denied/)
      await expect(t.as(uid, `select * from public.error_report_users`)).rejects.toThrow(/permission denied/)
      await expect(
        t.as(uid, `select * from public.report_error(null, 'x', 'error', 'm', '', '', '', '')`),
      ).rejects.toThrow(/permission denied/)
    }
    expect(
      await t.rows(
        `select has_table_privilege('service_role', 'public.error_reports', 'select') a,
                has_function_privilege('service_role', 'public.report_error(uuid, text, text, text, text, text, text, text)', 'execute') b`,
      ),
    ).toEqual([{ a: false, b: true }])
  })

  it("counts one error once a day, with how many times and how many people", async () => {
    expect(await report(A, "fp1")).toEqual([{ count: 1, users: 1, notify: true }])
    expect(await report(A, "fp1")).toEqual([{ count: 2, users: 1, notify: false }])
    expect(await report(B, "fp1")).toEqual([{ count: 3, users: 2, notify: false }])
    // On the server there is no user to count.
    expect(await report(null, "fp1")).toEqual([{ count: 4, users: 2, notify: false }])
    expect(await t.rows(`select count(*)::int n from public.error_reports`)).toEqual([{ n: 1 }])
    expect(await t.rows(`select message, page, device from public.error_reports`)).toEqual([
      { message: "TypeError: boom", page: "/add", device: "iPhone · Safari" },
    ])
  })

  it("tells the maintainers the first time, then at ten times the last count", async () => {
    const told: number[] = []
    for (let i = 5; i <= 100; i++) {
      const [r] = await report(null, "fp1")
      if (r.notify) told.push(r.count)
    }
    expect(told).toEqual([10, 100])
  })

  it("one account can't flood it", async () => {
    // 50 of the same error, then nothing more from that account.
    for (let i = 0; i < 49; i++) await report(A, "fp2")
    expect((await report(A, "fp2"))[0].count).toBe(50)
    expect(await report(A, "fp2")).toEqual([])
    // 20 different errors a day (fp1 and fp2 are two of them).
    for (let i = 3; i <= 20; i++) expect(await report(A, `fp${i}`)).toHaveLength(1)
    expect(await report(A, "fp21")).toEqual([])
    // Another account still can.
    expect(await report(B, "fp21")).toHaveLength(1)
  })

  it("keeps at most 100 different errors a day", async () => {
    await t.db.exec(`
      insert into public.error_reports (fingerprint, day, source, message)
      select 'bulk' || n, (now() at time zone 'Asia/Bangkok')::date, 'error', 'm' from generate_series(1, 79) n`)
    expect(await t.rows(`select count(*)::int n from public.error_reports`)).toEqual([{ n: 100 }])
    expect(await report(B, "one-too-many")).toEqual([])
    // One already known is still counted.
    expect(await report(B, "bulk1")).toHaveLength(1)
  })

  it("long text is cut, not refused", async () => {
    await t.db.exec(`delete from public.error_reports where fingerprint like 'bulk%'`)
    expect(await report(B, "long", "x".repeat(900))).toHaveLength(1)
    expect(
      await t.rows(`select char_length(message)::int n from public.error_reports where fingerprint = 'long'`),
    ).toEqual([{ n: 300 }])
  })

  it("goes after two weeks, and with the account", async () => {
    await t.db.exec(`
      insert into public.error_reports (fingerprint, day, source, message) values
        ('old', current_date - 15, 'error', 'm'), ('recent', current_date - 13, 'error', 'm');
      insert into public.error_report_users (fingerprint, day, user_id) values ('old', current_date - 15, '${A}');
      select public.purge_old_logs()`)
    expect(await t.rows(`select fingerprint from public.error_reports where fingerprint in ('old', 'recent')`)).toEqual(
      [{ fingerprint: "recent" }],
    )
    expect(await t.rows(`select count(*)::int n from public.error_report_users where fingerprint = 'old'`)).toEqual([
      { n: 0 },
    ])
    await t.db.exec(`delete from auth.users where id = '${A}'`)
    expect(await t.rows(`select count(*)::int n from public.error_report_users where user_id = '${A}'`)).toEqual([
      { n: 0 },
    ])
    // The error itself stays: it isn't the user's data.
    expect(
      (await t.rows<{ n: number }>(`select count(*)::int n from public.error_reports where fingerprint = 'fp2'`))[0].n,
    ).toBe(1)
  })
})
