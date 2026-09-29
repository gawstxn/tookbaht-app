import { beforeAll, describe, expect, it } from "vitest";
import { migratedDb } from "./setup";

const A = "aaaaaaaa-0000-0000-0000-000000000025";
const accA = "a0000000-0000-0000-0000-000000000025";

let t: Awaited<ReturnType<typeof migratedDb>>;
const setToday = (day: string) =>
  t.db.exec(`create or replace function public.user_today(p_timezone text) returns date language sql stable set search_path = '' as $$ select '${day}'::date $$`);
const period = (date: string, day: number, offset = 0) =>
  t.rows<{ start_date: string; next_start: string; month: string }>(`select start_date::text, next_start::text, month from public.user_period('${date}', ${day}, ${offset})`).then((r) => r[0]);

describe.sequential("months that start on payday", () => {
  beforeAll(async () => {
    t = await migratedDb();
    await t.db.exec(`insert into auth.users (id, email) values ('${A}', 'pay@x.com')`);
    await t.as(A, `insert into public.accounts (id, name, kind) values ('${accA}', 'SCB', 'bank')`);
    await t.db.exec(`update public.profiles set settings = '{"cycleStartDay": 25}' where id = '${A}'`);
    await t.db.exec(`update public.goals set category_budgets = '{"food": 500}', rollover_keys = '{food}' where user_id = '${A}'`);
    await t.as(
      A,
      `insert into public.transactions (type, amount, date, title, category, account_id) values
         ('out', 300, '2026-08-26', 'ข้าว', 'food', '${accA}'),
         ('out', 450, '2026-09-24', 'ข้าว', 'food', '${accA}'),
         ('out', 650, '2026-09-26', 'ข้าว', 'food', '${accA}')`,
    );
  });

  it("matches lib/period.ts", async () => {
    expect(await period("2026-09-29", 2)).toEqual({ start_date: "2026-09-02", next_start: "2026-10-02", month: "2026-09" });
    expect(await period("2026-09-25", 25)).toEqual({ start_date: "2026-09-25", next_start: "2026-10-25", month: "2026-10" });
    expect(await period("2026-09-24", 25, -1)).toEqual({ start_date: "2026-07-25", next_start: "2026-08-25", month: "2026-08" });
    expect(await period("2026-02-28", 31)).toEqual({ start_date: "2026-02-28", next_start: "2026-03-31", month: "2026-03" });
    expect(await period("2026-09-10", 1)).toEqual({ start_date: "2026-09-01", next_start: "2026-10-01", month: "2026-09" });
  });

  it("reads the start day from settings, 1 when it isn't a whole day 1–31", async () => {
    const day = (s: string) => t.rows<{ d: number }>(`select public.cycle_start_day('${s}'::jsonb) as d`).then((r) => r[0].d);
    expect(await day('{"cycleStartDay": 25}')).toBe(25);
    expect(await day("{}")).toBe(1);
    expect(await day('{"cycleStartDay": 0}')).toBe(1);
    expect(await day('{"cycleStartDay": 2.5}')).toBe(1);
    expect(await day('{"cycleStartDay": "25"}')).toBe(1);
  });

  it("alerts on the month since payday, with what the month before left carried over", async () => {
    await setToday("2026-09-28");
    // 25 Aug – 24 Sep spent 750 of 500: nothing carried. 25 Sep on: 650 of 500 is over.
    const rows = await t.rows<{ month: string; level: number; spent: string; budget: string }>(
      `select month, level, spent, budget from public.pending_budget_alerts() where user_id = '${A}' and budget_key = 'food'`,
    );
    expect(rows.map((r) => [r.month, r.level, Number(r.spent), Number(r.budget)])).toEqual([["2026-10", 100, 650, 500]]);
  });

  it("sums up the month that ended on payday, for the first three days only", async () => {
    await setToday("2026-09-26");
    const [row] = await t.rows<{ month: string; expense: string; over_budget: string[] }>(
      `select month, expense, over_budget from public.pending_month_summaries() where user_id = '${A}'`,
    );
    // 25 Aug – 24 Sep: 750 on food. The month before spent nothing on it, so 500 carried: 750 of 1,000 isn't over.
    expect([row.month, Number(row.expense), [...row.over_budget]]).toEqual(["2026-09", 750, []]);

    await setToday("2026-09-28");
    expect(await t.rows(`select * from public.pending_month_summaries() where user_id = '${A}'`)).toEqual([]);
  });
});
