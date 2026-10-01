import { beforeAll, describe, expect, it } from "vitest"
import { migratedDb } from "./setup"

const A = "aaaaaaaa-0000-0000-0000-000000000001"
const accA = "a0000000-0000-0000-0000-00000000000a"

let t: Awaited<ReturnType<typeof migratedDb>>
const setToday = (day: string) =>
  t.db.exec(
    `create or replace function public.user_today(p_timezone text) returns date language sql stable set search_path = '' as $$ select '${day}'::date $$`,
  )
const foodAlert = () =>
  t
    .rows<{ level: number; budget: string }>(
      `select level, budget from public.pending_budget_alerts() where budget_key = 'food'`,
    )
    .then((r) => r.map((x) => [x.level, Number(x.budget)]))

describe.sequential("budget rollover", () => {
  beforeAll(async () => {
    t = await migratedDb()
    await t.db.exec(`insert into auth.users (id, email) values ('${A}', 'a@x.com')`)
    await t.as(A, `insert into public.accounts (id, name, kind) values ('${accA}', 'เงินสด', 'cash')`)
    await t.db.exec(`update public.goals set category_budgets = '{"food": 500}' where user_id = '${A}'`)
    await t.as(
      A,
      `insert into public.transactions (type, amount, date, category, account_id) values
         ('out', 300, '2026-08-10', 'food', '${accA}'),
         ('out', 600, '2026-09-10', 'food', '${accA}')`,
    )
    await setToday("2026-09-20")
  })

  it("without rollover, 600 of 500 is over", async () => {
    expect(await foodAlert()).toEqual([[100, 500]])
  })

  it("with rollover, August's unused 200 is added: 600 of 700 is only past 80%", async () => {
    await t.as(A, `update public.goals set rollover_keys = '{food}' where user_id = '${A}'`)
    expect(await foodAlert()).toEqual([[80, 700]])
  })

  it("an overspent month carries nothing (never negative)", async () => {
    await t.as(
      A,
      `insert into public.transactions (type, amount, date, category, account_id) values ('out', 900, '2026-08-20', 'food', '${accA}')`,
    )
    expect(await foodAlert()).toEqual([[100, 500]])
  })

  it("the monthly summary uses the same budget", async () => {
    await t.db.exec(`delete from public.transactions where amount = 900`)
    await setToday("2026-10-01")
    // September: 600 of 500 + 200 carried → not over.
    const [row] = await t.rows<{ over_budget: string[] }>(
      `select over_budget from public.pending_month_summaries() where month = '2026-09'`,
    )
    expect([...row.over_budget]).toEqual([])
  })
})
