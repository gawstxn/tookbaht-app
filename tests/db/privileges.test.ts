import { beforeAll, describe, expect, it } from "vitest";
import { migratedDb } from "./setup";

const A = "aaaaaaaa-0000-0000-0000-000000000001";
const B = "bbbbbbbb-0000-0000-0000-000000000002";

let t: Awaited<ReturnType<typeof migratedDb>>;

describe.sequential("table privileges", () => {
  beforeAll(async () => {
    t = await migratedDb();
    await t.db.exec(`insert into auth.users (id, email) values ('${A}', 'a@x.com'), ('${B}', 'b@x.com')`);
  });

  it("no one can empty a table through the API roles (TRUNCATE skips row-level security)", async () => {
    for (const table of ["transactions", "accounts", "profiles", "ious", "savings_goals", "feedback", "goals", "subscriptions"]) {
      await expect(t.as(A, `truncate public.${table} cascade`), table).rejects.toThrow(/permission/);
    }
  });

  it("users change only their name and settings on the profile", async () => {
    await t.as(A, `update public.profiles set name = 'Alice', settings = '{"lang":"en"}' where id = '${A}'`);
    expect(await t.rows(`select name, settings->>'lang' lang from public.profiles where id = '${A}'`)).toEqual([{ name: "Alice", lang: "en" }]);
    await expect(t.as(A, `update public.profiles set email = 'x@evil.com' where id = '${A}'`)).rejects.toThrow(/permission/);
    await expect(t.as(A, `update public.profiles set deletion_requested_at = now() where id = '${A}'`)).rejects.toThrow(/permission/);
    await expect(t.as(A, `update public.profiles set timezone = 'UTC' where id = '${A}'`)).rejects.toThrow(/permission/);
    await expect(t.as(A, `delete from public.profiles where id = '${A}'`)).rejects.toThrow(/permission/);
  });

  it("signed-out visitors get nothing", async () => {
    for (const table of ["transactions", "profiles", "exchange_rates", "feedback"]) {
      await expect(t.as(null, `select * from public.${table}`), table).rejects.toThrow(/permission/);
    }
  });

  it("the app's own reads and writes still work", async () => {
    await t.as(A, `insert into public.accounts (name, kind) values ('เงินสด', 'cash')`);
    const [acc] = await t.as<{ id: string }>(A, `select id from public.accounts`);
    await t.as(A, `insert into public.transactions (type, amount, date, account_id, category) values ('out', 50, '2026-09-26', '${acc.id}', 'food')`);
    await t.as(A, `insert into public.ious (person, amount, date) values ('บอส', 10, '2026-09-26')`);
    await t.as(A, `insert into public.savings_goals (name, target) values ('เที่ยว', 1000)`);
    await t.as(A, `insert into public.goals (user_id, expense_budget) values ('${A}', 1) on conflict (user_id) do update set expense_budget = 1`);
    await t.as(A, `select * from public.exchange_rates`);
    await t.as(A, `delete from public.push_subscriptions where endpoint = 'x'`);
    expect(await t.as(B, `select * from public.transactions`)).toEqual([]);
  });

  it("tables added later start closed", async () => {
    await t.db.exec(`create table public.later (id int)`);
    await expect(t.as(A, `select * from public.later`)).rejects.toThrow(/permission/);
  });

  it("caps problem reports at 20 a day per user", async () => {
    for (let i = 0; i < 20; i++) await t.as(A, `insert into public.feedback (message) values ('report ${i}')`);
    await expect(t.as(A, `insert into public.feedback (message) values ('one more')`)).rejects.toThrow(/feedback limit/);
    // Someone else isn't affected, and yesterday's reports don't count.
    await t.as(B, `insert into public.feedback (message) values ('hi')`);
    await t.db.exec(`update public.feedback set created_at = now() - interval '2 days' where user_id = '${A}'`);
    await t.as(A, `insert into public.feedback (message) values ('next day')`);
  });
});
