import { beforeAll, beforeEach, describe, expect, it } from "vitest"
import { migratedDb } from "./setup"

const A = "aaaaaaaa-0000-0000-0000-000000000001"
const ACC = "a0000000-0000-0000-0000-00000000000a"
const BILL = "b0000000-0000-0000-0000-00000000000b"
const TODAY = `public.user_today('Asia/Bangkok')`

let t: Awaited<ReturnType<typeof migratedDb>>
const pending = () =>
  t.rows<{ name: string; variable: boolean }>(`select name, variable from public.pending_reminders() order by name`)
/** A monthly bill of changing amount, first due `n` days from today. */
const bill = (n: number) =>
  t.as(
    A,
    `insert into public.subscriptions (id, kind, entry_type, name, amount, cycle, start_date, account_id, category, auto_log, variable)
     values ('${BILL}', 'recurring', 'out', 'ค่าไฟ', 1200, 'month', ${TODAY} + ${n}, '${ACC}', 'bill', false, true)`,
  )
const pay = (daysAgo: number, amount = 1340) =>
  t.as(
    A,
    `insert into public.transactions (type, amount, date, account_id, category, title, subscription_id)
     values ('out', ${amount}, ${TODAY} - ${daysAgo}, '${ACC}', 'bill', 'ค่าไฟ', '${BILL}')`,
  )

describe.sequential("bills whose amount changes", () => {
  beforeAll(async () => {
    t = await migratedDb()
    await t.db.exec(`insert into auth.users (id, email) values ('${A}', 'a@x.com')`)
    await t.as(A, `insert into public.accounts (id, name, kind) values ('${ACC}', 'กสิกร', 'bank')`)
  })
  beforeEach(async () => {
    await t.db.exec(
      `delete from public.transactions; delete from public.subscriptions; update public.profiles set settings = '{}'`,
    )
  })

  it("are never logged automatically", async () => {
    await bill(0)
    await t.db.exec(`select public.log_due_subscriptions()`)
    expect(await t.rows(`select id from public.transactions`)).toEqual([])
    await expect(t.as(A, `update public.subscriptions set auto_log = true where id = '${BILL}'`)).rejects.toThrow(
      /subscriptions_variable/,
    )
  })

  it("are only plain recurring expenses", async () => {
    const insert = (cols: string) =>
      t.as(
        A,
        `insert into public.subscriptions (name, amount, cycle, start_date, account_id, category, auto_log, variable, kind, entry_type, installments)
         values ('x', 100, 'month', current_date, '${ACC}', 'bill', false, true, ${cols})`,
      )
    await expect(insert(`'subscription', 'out', null`)).rejects.toThrow(/subscriptions_variable/)
    await expect(insert(`'recurring', 'in', null`)).rejects.toThrow(/subscriptions_variable/)
    await expect(insert(`'recurring', 'out', 3`)).rejects.toThrow(/subscriptions_variable/)
    await insert(`'recurring', 'out', null`)
  })

  it("remind the day before, flagged as a changing amount", async () => {
    await bill(1)
    await t.as(
      A,
      `insert into public.subscriptions (name, amount, cycle, start_date, account_id, category) values ('Netflix', 419, 'month', ${TODAY} + 1, '${ACC}', 'fun')`,
    )
    expect(await pending()).toEqual([
      { name: "Netflix", variable: false },
      { name: "ค่าไฟ", variable: true },
    ])
  })

  it("stay quiet once this round was paid early", async () => {
    await bill(1)
    await pay(2)
    expect(await pending()).toEqual([])
  })

  it("still remind when the only payment is too old to be for this round", async () => {
    await bill(1)
    // More than half a month before the due date: that was the round before.
    await pay(29)
    expect(await pending()).toEqual([{ name: "ค่าไฟ", variable: true }])
  })

  it("stay quiet when the user skipped this round", async () => {
    await bill(1)
    await t.as(
      A,
      `select public.merge_settings(jsonb_build_object('billSkipped', jsonb_build_array('${BILL}:' || (${TODAY} + 1)::text)))`,
    )
    expect(await pending()).toEqual([])
    // Skipping another round doesn't silence this one.
    await t.as(
      A,
      `select public.merge_settings(jsonb_build_object('billSkipped', jsonb_build_array('${BILL}:' || (${TODAY} - 30)::text)))`,
    )
    expect(await pending()).toEqual([{ name: "ค่าไฟ", variable: true }])
  })
})
