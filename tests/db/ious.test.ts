import { beforeAll, describe, expect, it } from "vitest";
import { migratedDb } from "./setup";

const A = "aaaaaaaa-0000-0000-0000-000000000001";
const B = "bbbbbbbb-0000-0000-0000-000000000002";
const accA = "a0000000-0000-0000-0000-00000000000a";
const saveA = "a0000000-0000-0000-0000-00000000000b";
const accB = "b0000000-0000-0000-0000-00000000000a";
const mealA = "a1000000-0000-0000-0000-000000000001";

let t: Awaited<ReturnType<typeof migratedDb>>;

/** Pretend today is `day` for every user (user_today normally reads the clock). */
const setToday = (day: string) =>
  t.db.exec(`create or replace function public.user_today(p_timezone text) returns date language sql stable set search_path = '' as $$ select '${day}'::date $$`);

describe.sequential("ious, savings goals, monthly summary and feedback", () => {
  beforeAll(async () => {
    t = await migratedDb();
    await t.db.exec(`insert into auth.users (id, email) values ('${A}', 'a@x.com'), ('${B}', 'b@x.com')`);
    await t.as(A, `insert into public.accounts (id, name, kind) values ('${accA}', 'เงินสด', 'cash'), ('${saveA}', 'ออม', 'saving')`);
    await t.as(B, `insert into public.accounts (id, name, kind) values ('${accB}', 'B', 'bank')`);
    await t.as(A, `insert into public.transactions (id, type, amount, date, title, category, account_id) values ('${mealA}', 'out', 1200, '2026-09-10', 'หมูกระทะ', 'food', '${accA}')`);
  });

  it("keeps each user's debts private", async () => {
    await t.as(A, `insert into public.ious (person, amount, date, transaction_id) values ('บอส', 300, '2026-09-10', '${mealA}'), ('มิ้นท์', 300, '2026-09-10', '${mealA}')`);
    expect(await t.as(B, `select * from public.ious`)).toEqual([]);
    await t.as(B, `update public.ious set amount = 1`);
    expect((await t.as<{ amount: string }>(A, `select amount from public.ious`)).map((r) => Number(r.amount))).toEqual([300, 300]);
  });

  it("won't link a debt to another user's transaction", async () => {
    await expect(t.as(B, `insert into public.ious (person, amount, date, transaction_id) values ('x', 1, '2026-09-10', '${mealA}')`)).rejects.toThrow(/foreign key/);
  });

  it("rejects empty names and non-positive amounts", async () => {
    await expect(t.as(A, `insert into public.ious (person, amount, date) values ('', 10, '2026-09-10')`)).rejects.toThrow(/check/);
    await expect(t.as(A, `insert into public.ious (person, amount, date) values ('x', 0, '2026-09-10')`)).rejects.toThrow(/check/);
  });

  it("keeps the debt when the bill is deleted", async () => {
    await t.as(A, `delete from public.transactions where id = '${mealA}'`);
    const rows = await t.as<{ transaction_id: string | null; user_id: string }>(A, `select transaction_id, user_id from public.ious`);
    expect(rows).toEqual([
      { transaction_id: null, user_id: A },
      { transaction_id: null, user_id: A },
    ]);
  });

  it("savings goals are private and fall back to manual when the account goes", async () => {
    await t.as(A, `insert into public.savings_goals (name, target, deadline, account_id) values ('เที่ยวญี่ปุ่น', 40000, '2027-03-31', '${saveA}')`);
    expect(await t.as(B, `select * from public.savings_goals`)).toEqual([]);
    await expect(t.as(B, `insert into public.savings_goals (name, target, account_id) values ('x', 1, '${saveA}')`)).rejects.toThrow(/foreign key/);
    await t.as(A, `delete from public.accounts where id = '${saveA}'`);
    const [goal] = await t.as<{ account_id: string | null; user_id: string }>(A, `select account_id, user_id from public.savings_goals`);
    expect(goal).toEqual({ account_id: null, user_id: A });
  });

  it("feedback can be sent but not read back", async () => {
    await t.as(A, `insert into public.feedback (message, app_version, page) values ('ปุ่มบันทึกกดไม่ได้', '1.11.0', '/add')`);
    await expect(t.as(A, `select * from public.feedback`)).rejects.toThrow(/permission/);
    await expect(t.as(null, `insert into public.feedback (message) values ('x')`)).rejects.toThrow(/permission/);
    expect(await t.rows(`select message, user_id from public.feedback`)).toEqual([{ message: "ปุ่มบันทึกกดไม่ได้", user_id: A }]);
  });

  it("summarises last month early in the new month, once, with budgets that went over", async () => {
    await t.db.exec(`update public.goals set expense_budget = 1000, category_budgets = '{"food": 500, "travel": 900}' where user_id = '${A}'`);
    await t.as(
      A,
      `insert into public.transactions (type, amount, date, title, category, account_id) values
         ('in', 30000, '2026-09-01', 'เงินเดือน', 'salary', '${accA}'),
         ('out', 700, '2026-09-05', 'ข้าว', 'food', '${accA}'),
         ('out', 400, '2026-09-20', 'รถ', 'travel', '${accA}'),
         ('out', 999, '2026-10-01', 'เดือนใหม่', 'food', '${accA}')`,
    );
    await setToday("2026-10-02");
    const rows = await t.rows<{ user_id: string; month: string; income: string; expense: string; over_budget: string[] }>(`select * from public.pending_month_summaries()`);
    // B logged nothing in September, so gets no summary.
    expect(rows.map((r) => ({ ...r, income: Number(r.income), expense: Number(r.expense), over_budget: [...r.over_budget].sort() }))).toEqual([
      { user_id: A, month: "2026-09", income: 30000, expense: 1100, over_budget: ["food", "total"] },
    ]);

    await t.db.exec(`insert into public.month_summaries_sent (user_id, month) values ('${A}', '2026-09')`);
    expect(await t.rows(`select * from public.pending_month_summaries()`)).toEqual([]);
  });

  it("waits for the new month and respects the opt-out", async () => {
    await t.db.exec(`delete from public.month_summaries_sent`);
    await setToday("2026-10-04");
    expect(await t.rows(`select * from public.pending_month_summaries()`)).toEqual([]);
    await setToday("2026-10-01");
    await t.db.exec(`update public.profiles set settings = '{"monthlySummary": false}' where id = '${A}'`);
    expect(await t.rows(`select * from public.pending_month_summaries()`)).toEqual([]);
  });

  it("counts money paid back as less spending, not income", async () => {
    await t.db.exec(`update public.profiles set settings = '{}' where id = '${A}'; delete from public.month_summaries_sent;`);
    await t.as(A, `insert into public.transactions (type, amount, date, title, category, account_id) values ('in', 300, '2026-09-25', 'บอส คืนเงิน', 'repay', '${accA}')`);
    const [row] = await t.rows<{ income: string; expense: string; over_budget: string[] }>(`select * from public.pending_month_summaries()`);
    // 1,100 spent − 300 paid back; the 1,000 overall budget is no longer over, food (700 of 500) still is.
    expect({ income: Number(row.income), expense: Number(row.expense), over: [...row.over_budget] }).toEqual({ income: 30000, expense: 800, over: ["food"] });

    await setToday("2026-09-26");
    const alerts = await t.rows<{ budget_key: string; spent: string }>(`select budget_key, spent from public.pending_budget_alerts() where user_id = '${A}' order by budget_key`);
    expect(alerts.map((r) => [r.budget_key, Number(r.spent)])).toEqual([
      ["food", 700],
      ["total", 800],
    ]);
  });

  it("only the server can read pending summaries", async () => {
    await expect(t.as(A, `select * from public.pending_month_summaries()`)).rejects.toThrow(/permission/);
    await expect(t.as(A, `select * from public.month_summaries_sent`)).rejects.toThrow(/permission/);
  });
});
