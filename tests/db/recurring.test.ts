import { beforeAll, describe, expect, it } from "vitest"
import { migratedDb } from "./setup"

const U = "aaaaaaaa-0000-0000-0000-000000000001"
const BANK = "a0000000-0000-0000-0000-00000000000a"
const SAVE = "a0000000-0000-0000-0000-00000000000b"
const PAYLATER = "a0000000-0000-0000-0000-00000000000c"

let t: Awaited<ReturnType<typeof migratedDb>>
let today: string
const addDays = (s: string, n: number) =>
  new Date(Date.parse(s + "T00:00:00Z") + n * 86_400_000).toISOString().slice(0, 10)
const addMonths = (s: string, n: number) => {
  const d = new Date(s + "T00:00:00Z")
  d.setUTCMonth(d.getUTCMonth() + n)
  return d.toISOString().slice(0, 10)
}
const logged = (id: string) =>
  t.rows<{
    type: string
    amount: string
    date: string
    category: string | null
    account_id: string | null
    from_id: string | null
    to_id: string | null
  }>(
    `select type, amount, date::text date, category, account_id, from_id, to_id from public.transactions where subscription_id = '${id}' order by date`,
  )
const runAutoLog = () => t.rows(`select * from public.log_due_subscriptions()`)
/** Insert a scheduled entry that logs from its start date (as rows created before auto_log_from existed do). */
const schedule = async (id: string, cols: Record<string, string | number>) => {
  const keys = Object.keys(cols)
  await t.db
    .exec(`insert into public.subscriptions (id, user_id, ${keys.join(", ")}) values ('${id}', '${U}', ${keys.map((k) => (typeof cols[k] === "number" ? cols[k] : `'${cols[k]}'`)).join(", ")});
    alter table public.subscriptions disable trigger subscriptions_auto_log_from;
    update public.subscriptions set auto_log_from = start_date where id = '${id}';
    alter table public.subscriptions enable trigger subscriptions_auto_log_from;`)
}

beforeAll(async () => {
  t = await migratedDb()
  await t.db.exec(`insert into auth.users (id, email) values ('${U}', 'a@x.com');
    insert into public.accounts (id, user_id, name, kind, opening_balance) values
      ('${BANK}', '${U}', 'เงินเดือน', 'bank', 0), ('${SAVE}', '${U}', 'ออม', 'saving', 0), ('${PAYLATER}', '${U}', 'SPayLater', 'credit', 10000);`)
  ;[{ d: today }] = await t.rows<{ d: string }>(`select public.user_today('Asia/Bangkok')::text d`)
})

describe.sequential("recurring entries", () => {
  it("logs recurring income in its own category", async () => {
    await schedule("51000000-0000-0000-0000-000000000001", {
      kind: "recurring",
      entry_type: "in",
      name: "เงินเดือน",
      amount: 45000,
      cycle: "month",
      start_date: addMonths(today, -1),
      account_id: BANK,
      category: "salary",
    })
    await runAutoLog()
    const rows = await logged("51000000-0000-0000-0000-000000000001")
    expect(rows.map((r) => [r.type, r.category, r.account_id, r.date])).toEqual([
      ["in", "salary", BANK, addMonths(today, -1)],
      ["in", "salary", BANK, today],
    ])
  })

  it("logs a recurring transfer between two accounts", async () => {
    await schedule("51000000-0000-0000-0000-000000000002", {
      kind: "recurring",
      entry_type: "move",
      name: "ออมทุกเดือน",
      amount: 5000,
      cycle: "month",
      start_date: today,
      account_id: BANK,
      to_account_id: SAVE,
      category: "other",
    })
    await runAutoLog()
    expect(
      (await logged("51000000-0000-0000-0000-000000000002")).map((r) => [
        r.type,
        r.category,
        r.account_id,
        r.from_id,
        r.to_id,
      ]),
    ).toEqual([["move", null, null, BANK, SAVE]])
  })

  it("stops an installment plan after its last charge", async () => {
    // Bought 4 months ago, 3 monthly installments: charges at months -4, -3, -2 only.
    await schedule("51000000-0000-0000-0000-000000000003", {
      kind: "recurring",
      entry_type: "out",
      name: "หูฟัง",
      amount: 1000,
      cycle: "month",
      start_date: addMonths(today, -4),
      account_id: PAYLATER,
      category: "shop",
      installments: 3,
    })
    await runAutoLog()
    expect((await logged("51000000-0000-0000-0000-000000000003")).map((r) => r.date)).toEqual([
      addMonths(today, -4),
      addMonths(today, -3),
      addMonths(today, -2),
    ])
  })

  it("keeps subscriptions as expenses in the subscription category", async () => {
    await schedule("51000000-0000-0000-0000-000000000004", {
      name: "Netflix",
      amount: 419,
      cycle: "month",
      start_date: today,
      account_id: PAYLATER,
      category: "fun",
    })
    await runAutoLog()
    expect((await logged("51000000-0000-0000-0000-000000000004")).map((r) => [r.type, r.category])).toEqual([
      ["out", "sub"],
    ])
  })

  it("rejects malformed scheduled entries", async () => {
    const insert = (cols: string, values: string) =>
      t.as(
        U,
        `insert into public.subscriptions (name, amount, cycle, start_date, account_id, category, ${cols}) values ('x', 1, 'month', '${today}', '${BANK}', 'other', ${values})`,
      )
    await expect(insert("kind, entry_type", "'subscription', 'in'")).rejects.toThrow(/subscriptions_entry_shape/)
    await expect(insert("kind, entry_type", "'recurring', 'move'")).rejects.toThrow(/subscriptions_entry_shape/)
    await expect(insert("kind, entry_type, to_account_id", `'recurring', 'move', '${BANK}'`)).rejects.toThrow(
      /subscriptions_entry_shape/,
    )
    await expect(insert("kind, entry_type, currency", "'recurring', 'out', 'USD'")).rejects.toThrow(
      /subscriptions_currency_kind/,
    )
    await expect(insert("kind, installments", "'recurring', 0")).rejects.toThrow(/check/)
  })
})

describe.sequential("reminders the day before", () => {
  it("covers expenses and installments, with the installment number, but not income", async () => {
    await schedule("52000000-0000-0000-0000-000000000001", {
      kind: "recurring",
      entry_type: "out",
      name: "ผ่อนมือถือ",
      amount: 1500,
      cycle: "month",
      start_date: addMonths(addDays(today, 1), -1),
      account_id: PAYLATER,
      category: "shop",
      installments: 6,
    })
    await schedule("52000000-0000-0000-0000-000000000002", {
      kind: "recurring",
      entry_type: "in",
      name: "ค่าจ้าง",
      amount: 9000,
      cycle: "month",
      start_date: addDays(today, 1),
      account_id: BANK,
      category: "freelance",
    })
    const rows = await t.rows<{ name: string; installment_no: number; installments: number | null }>(
      `select name, installment_no, installments from public.pending_reminders() order by name`,
    )
    expect(rows).toEqual([{ name: "ผ่อนมือถือ", installment_no: 2, installments: 6 }])
  })
})

describe.sequential("payment due day", () => {
  it("only applies to cards and pay-later accounts", async () => {
    await expect(t.db.exec(`update public.accounts set due_day = 5 where id = '${BANK}'`)).rejects.toThrow(
      /accounts_due_day_credit/,
    )
  })

  it("clamps the due day to short months", async () => {
    expect(await t.rows(`select public.due_date_in_month('2026-02-10', 31)::text d`)).toEqual([{ d: "2026-02-28" }])
    expect(await t.rows(`select public.due_date_in_month('2026-09-30', 5)::text d`)).toEqual([{ d: "2026-09-05" }])
  })

  it("reminds the day before, with what is owed, once", async () => {
    const tomorrow = addDays(today, 1)
    await t.db.exec(`update public.accounts set due_day = ${Number(tomorrow.slice(8))} where id = '${PAYLATER}'`)
    // Owed so far: 3 installments (3,000) + Netflix (419), less a 1,000 payment,
    // plus the phone installment (1,500) that falls due tomorrow.
    await t.db.exec(
      `insert into public.transactions (user_id, type, amount, date, from_id, to_id) values ('${U}', 'move', 1000, '${today}', '${BANK}', '${PAYLATER}')`,
    )
    const rows = await t.rows<{ name: string; owed: string; due_date: string }>(
      `select name, owed, due_date::text due_date from public.pending_due_reminders()`,
    )
    expect(rows.map((r) => [r.name, Number(r.owed), r.due_date])).toEqual([["SPayLater", 3919, tomorrow]])
    await t.db.exec(
      `insert into public.due_reminders_sent (account_id, due_date) values ('${PAYLATER}', '${tomorrow}')`,
    )
    expect(await t.rows(`select * from public.pending_due_reminders()`)).toEqual([])
  })
})

describe.sequential("budget alerts", () => {
  const month = () => today.slice(0, 7)

  it("announces 80% once, then over budget once", async () => {
    await t.db
      .exec(`delete from public.transactions; update public.goals set expense_budget = 10000, category_budgets = '{"food": 1000}', alert_at_80 = true where user_id = '${U}';
      insert into public.transactions (user_id, type, amount, date, category, account_id) values ('${U}', 'out', 850, '${today}', 'food', '${BANK}');`)
    expect(await t.rows(`select budget_key, level from public.pending_budget_alerts()`)).toEqual([
      { budget_key: "food", level: 80 },
    ])
    await t.db.exec(
      `insert into public.budget_alerts_sent (user_id, month, budget_key, level) values ('${U}', '${month()}', 'food', 80)`,
    )
    expect(await t.rows(`select * from public.pending_budget_alerts()`)).toEqual([])

    await t.db.exec(
      `insert into public.transactions (user_id, type, amount, date, category, account_id) values ('${U}', 'out', 9500, '${today}', 'shop', '${BANK}')`,
    )
    const rows = await t.rows<{ budget_key: string; level: number; spent: string }>(
      `select budget_key, level, spent from public.pending_budget_alerts() order by budget_key`,
    )
    expect(rows.map((r) => [r.budget_key, r.level, Number(r.spent)])).toEqual([["total", 100, 10350]])
  })

  it("skips the 80% warning when the user turned it off", async () => {
    await t.db.exec(
      `delete from public.budget_alerts_sent; update public.goals set alert_at_80 = false where user_id = '${U}'`,
    )
    expect(await t.rows(`select budget_key, level from public.pending_budget_alerts()`)).toEqual([
      { budget_key: "total", level: 100 },
    ])
  })

  it("ignores last month's spending", async () => {
    await t.db.exec(`delete from public.transactions; delete from public.budget_alerts_sent;
      insert into public.transactions (user_id, type, amount, date, category, account_id) values ('${U}', 'out', 20000, '${addMonths(today, -1)}', 'shop', '${BANK}');`)
    expect(await t.rows(`select * from public.pending_budget_alerts()`)).toEqual([])
  })
})

describe.sequential("pay-later purchases", () => {
  it("keeps a price only on installment plans", async () => {
    const insert = (cols: string, values: string) =>
      t.as(
        U,
        `insert into public.subscriptions (kind, entry_type, name, amount, cycle, start_date, account_id, category, ${cols}) values ('recurring', 'out', 'x', 1250, 'month', '${today}', '${PAYLATER}', 'shop', ${values})`,
      )
    await expect(insert("principal", "7000")).rejects.toThrow(/subscriptions_principal_plan/)
    await insert("principal, installments", "7000, 6")
  })

  it("remembers which account pays the bill, never itself", async () => {
    await t.db.exec(`update public.accounts set bill_from_id = '${BANK}' where id = '${PAYLATER}'`)
    await expect(
      t.db.exec(`update public.accounts set bill_from_id = '${PAYLATER}' where id = '${PAYLATER}'`),
    ).rejects.toThrow(/accounts_bill_from_self/)
  })

  it("includes installments falling due by tomorrow in the payment reminder", async () => {
    const tomorrow = addDays(today, 1)
    await t.db
      .exec(`delete from public.transactions; delete from public.due_reminders_sent; delete from public.subscriptions;
      update public.accounts set due_day = ${Number(tomorrow.slice(8))} where id = '${PAYLATER}';
      insert into public.transactions (user_id, type, amount, date, category, account_id) values ('${U}', 'out', 300, '${today}', 'food', '${PAYLATER}');`)
    // An installment due tomorrow (not logged yet) and one next month (not counted).
    await schedule("53000000-0000-0000-0000-000000000001", {
      kind: "recurring",
      entry_type: "out",
      name: "มือถือ",
      amount: 1250,
      cycle: "month",
      start_date: tomorrow,
      account_id: PAYLATER,
      category: "shop",
      installments: 6,
      principal: 7000,
    })
    const rows = await t.rows<{ owed: string }>(`select owed from public.pending_due_reminders()`)
    expect(rows.map((r) => Number(r.owed))).toEqual([1550])
  })
})
