import { beforeAll, describe, expect, it } from "vitest"
import { stepCycle } from "@/lib/format"
import type { Cycle } from "@/lib/types"
import { migratedDb } from "./setup"

const U = "aaaaaaaa-0000-0000-0000-000000000001"
const CARD = "a0000000-0000-0000-0000-00000000000a"

let t: Awaited<ReturnType<typeof migratedDb>>
let today: string
const addDays = (s: string, n: number) =>
  new Date(Date.parse(s + "T00:00:00Z") + n * 86_400_000).toISOString().slice(0, 10)
const logged = async (sub: string) =>
  (
    await t.rows<{ d: string }>(
      `select date::text d from public.transactions where subscription_id = '${sub}' order by date`,
    )
  ).map((r) => r.d)
const runAutoLog = () => t.rows(`select * from public.log_due_subscriptions()`)

beforeAll(async () => {
  t = await migratedDb()
  await t.db.exec(`insert into auth.users (id, email) values ('${U}', 'a@x.com');
    insert into public.accounts (id, user_id, name, kind, fx_fee_pct) values ('${CARD}', '${U}', 'บัตร', 'credit', 2.5);`)
  ;[{ d: today }] = await t.rows<{ d: string }>(`select public.user_today('Asia/Bangkok')::text d`)
})

describe("billing dates", () => {
  it("SQL billing_date agrees with the app's stepCycle", async () => {
    const cases: [string, Cycle, number][] = [
      ["2024-01-31", "month", 1],
      ["2024-01-31", "month", 2],
      ["2024-01-31", "month", 13],
      ["2024-02-29", "year", 1],
      ["2024-02-29", "year", 4],
      ["2025-12-31", "month", 2],
      ["2026-03-30", "week", 5],
      ["2026-08-31", "month", 6],
    ]
    for (let k = 0; k < 120; k++) {
      const start = new Date(Date.UTC(2023 + (k % 4), k % 12, 1 + ((k * 7) % 31))).toISOString().slice(0, 10)
      cases.push([start, (["week", "month", "year"] as const)[k % 3], (k * 5) % 40])
    }
    for (const [start, cycle, i] of cases) {
      const [{ d }] = await t.rows<{ d: string }>(`select public.billing_date('${start}', '${cycle}', ${i})::text d`)
      expect(d, `${start} ${cycle} #${i}`).toBe(stepCycle(start, cycle, i))
    }
  })
})

describe.sequential("auto-log", () => {
  const netflix = "51000000-0000-0000-0000-000000000001"
  const spotify = "51000000-0000-0000-0000-000000000002"

  it("never back-fills charges from before the subscription was added", async () => {
    await t.db
      .exec(`insert into public.subscriptions (id, user_id, name, amount, cycle, start_date, account_id, category, auto_log_from)
      values ('${netflix}', '${U}', 'Netflix', 419, 'month', '${addDays(today, -120)}', '${CARD}', 'fun', '2000-01-01')`)
    expect(await t.rows(`select auto_log_from::text f from public.subscriptions where id = '${netflix}'`)).toEqual([
      { f: today },
    ])
    await runAutoLog()
    expect((await logged(netflix)).filter((d) => d < today)).toEqual([])
  })

  it("logs a charge due today, once", async () => {
    await t.db
      .exec(`insert into public.subscriptions (id, user_id, name, amount, cycle, start_date, account_id, category)
      values ('${spotify}', '${U}', 'Spotify', 149, 'week', '${today}', '${CARD}', 'music')`)
    await runAutoLog()
    await runAutoLog()
    expect(await logged(spotify)).toEqual([today])
  })

  it("skips charges that fell during a pause", async () => {
    await t.db.exec(
      `update public.subscriptions set paused = true, auto_log_from = '2000-01-01' where id = '${spotify}'`,
    )
    expect(await t.rows(`select auto_log_from::text f from public.subscriptions where id = '${spotify}'`)).toEqual([
      { f: today },
    ])
    // Pretend it was paused a month ago.
    await t.db.exec(`alter table public.subscriptions disable trigger subscriptions_auto_log_from;
      update public.subscriptions set auto_log_from = '${addDays(today, -30)}', start_date = '${addDays(today, -30)}' where id = '${spotify}';
      delete from public.transactions where subscription_id = '${spotify}';
      alter table public.subscriptions enable trigger subscriptions_auto_log_from;`)
    await t.db.exec(`update public.subscriptions set paused = false where id = '${spotify}'`)
    expect(await t.rows(`select auto_log_from::text f from public.subscriptions where id = '${spotify}'`)).toEqual([
      { f: today },
    ])
    await runAutoLog()
    expect((await logged(spotify)).filter((d) => d < today)).toEqual([])
  })
})

describe.sequential("USD subscriptions", () => {
  const claude = "52000000-0000-0000-0000-000000000001"

  it("waits for an exchange rate instead of guessing", async () => {
    await t.as(
      U,
      `insert into public.subscriptions (id, name, amount, currency, cycle, start_date, account_id, category)
      values ('${claude}', 'Claude Pro', 21.4, 'USD', 'month', '${today}', '${CARD}', 'tools')`,
    )
    expect(await t.as(U, `select * from public.run_my_auto_log()`)).toEqual([])
  })

  it("logs baht at the day's rate plus the card fee, keeping the original amount", async () => {
    await t.db.exec(`insert into public.exchange_rates (currency, date, rate) values ('USD', '${today}', 33.48)`)
    const rows = await t.as<{ amount: string; orig_amount: string; orig_currency: string; fx_rate: string }>(
      U,
      `select * from public.run_my_auto_log()`,
    )
    expect(rows).toHaveLength(1)
    expect(Number(rows[0].amount)).toBe(Math.round(21.4 * 33.48 * 1.025 * 100) / 100)
    expect([Number(rows[0].orig_amount), rows[0].orig_currency, Number(rows[0].fx_rate)]).toEqual([21.4, "USD", 33.48])
    expect(await t.as(U, `select * from public.run_my_auto_log()`)).toEqual([])
  })

  it("requires the original amount, currency and rate together", async () => {
    await expect(
      t.as(
        U,
        `insert into public.transactions (type, amount, date, account_id, category, orig_amount) values ('out', 10, '${today}', '${CARD}', 'food', 1)`,
      ),
    ).rejects.toThrow(/transactions_fx_shape/)
  })

  it("lets users read rates but not write them", async () => {
    expect((await t.as(U, `select rate from public.exchange_rates`)).length).toBeGreaterThan(0)
    await expect(
      t.as(U, `insert into public.exchange_rates (currency, date, rate) values ('USD', '2000-01-01', 1)`),
    ).rejects.toThrow(/permission denied/)
  })
})

describe("push endpoint allowlist", () => {
  it.each([
    ["https://fcm.googleapis.com/fcm/send/abc", true],
    ["https://updates.push.services.mozilla.com/wpush/v2/abc", true],
    ["https://web.push.apple.com/QGx", true],
    ["https://wns2-sg2p.notify.windows.com/w/?token=abc", true],
    ["https://evil.example.com/steal", false],
    ["http://fcm.googleapis.com/fcm/send/abc", false],
    ["https://fcm.googleapis.com.evil.com/x", false],
    ["https://localhost:8443/ok", false],
  ])("%s → %s", async (endpoint, allowed) => {
    expect(await t.rows(`select public.is_push_endpoint('${endpoint}') ok`)).toEqual([{ ok: allowed }])
  })
})
