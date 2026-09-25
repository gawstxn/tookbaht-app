import { beforeAll, describe, expect, it } from "vitest";
import { migratedDb } from "./setup";

// Two users; B must never see or change anything of A's.
const A = "aaaaaaaa-0000-0000-0000-000000000001";
const B = "bbbbbbbb-0000-0000-0000-000000000002";
const accA = "a0000000-0000-0000-0000-00000000000a";
const acc2A = "a0000000-0000-0000-0000-00000000000b";
const accB = "b0000000-0000-0000-0000-00000000000a";
const subA = "a5000000-0000-0000-0000-000000000001";

let t: Awaited<ReturnType<typeof migratedDb>>;

// The steps build on each other, so they run in order on one database.
describe.sequential("schema and row-level security", () => {
  beforeAll(async () => {
    t = await migratedDb();
    await t.db.exec(`insert into auth.users (id, email, raw_user_meta_data) values ('${A}', 'a@x.com', '{"full_name":"Alice"}'), ('${B}', 'b@x.com', '{}')`);
  });

  it("sign-up trigger creates a profile and goals", async () => {
    const rows = await t.rows(`select p.name, p.email, g.alert_at_80 from public.profiles p join public.goals g on g.user_id = p.id order by p.email`);
    expect(rows).toEqual([
      { name: "Alice", email: "a@x.com", alert_at_80: true },
      { name: "b", email: "b@x.com", alert_at_80: true },
    ]);
  });

  it("new rows belong to the signed-in user", async () => {
    await t.as(A, `insert into public.accounts (id, name, kind, opening_balance, mono, tone) values ('${accA}', 'เงินเดือน', 'bank', 20000, 'ง', '#2f5b45'), ('${acc2A}', 'ออม', 'saving', 0, 'อ', '#33558f')`);
    await t.as(B, `insert into public.accounts (id, name, kind) values ('${accB}', 'B bank', 'bank')`);
    const rows = await t.as<{ user_id: string }>(A, `select user_id from public.accounts`);
    expect(rows.map((r) => r.user_id)).toEqual([A, A]);
  });

  it("accepts income, expense and transfer rows", async () => {
    await t.asExec(
      A,
      `insert into public.transactions (type, amount, date, title, category, account_id) values
         ('in', 45000, '2026-09-01', 'เงินเดือน', 'salary', '${accA}'),
         ('out', 65.5, '2026-09-02', 'ข้าว', 'food', '${accA}');
       insert into public.transactions (type, amount, date, title, from_id, to_id) values ('move', 5000, '2026-09-02', 'โอน', '${accA}', '${acc2A}');`,
    );
  });

  it("rejects malformed transactions", async () => {
    await expect(t.as(A, `insert into public.transactions (type, amount, date, from_id, to_id) values ('move', 1, '2026-09-02', '${accA}', '${accA}')`)).rejects.toThrow(/transactions_shape/);
    await expect(t.as(A, `insert into public.transactions (type, amount, date) values ('out', 1, '2026-09-02')`)).rejects.toThrow(/transactions_shape/);
    await expect(t.as(A, `insert into public.transactions (type, amount, date, account_id) values ('out', 0, '2026-09-02', '${accA}')`)).rejects.toThrow(/check/);
  });

  it("logs a subscription charge at most once per date", async () => {
    await t.as(A, `insert into public.subscriptions (id, name, amount, cycle, start_date, account_id, category) values ('${subA}', 'Spotify', 149, 'month', '2026-08-05', '${accA}', 'music')`);
    const log = `insert into public.transactions (type, amount, date, title, category, account_id, subscription_id) values ('out', 149, '2026-09-05', 'Spotify', 'sub', '${accA}', '${subA}')`;
    await t.as(A, `${log} on conflict (subscription_id, date) do nothing`);
    await t.as(A, `${log} on conflict (subscription_id, date) do nothing`);
    expect(await t.as(A, `select count(*)::int n from public.transactions where subscription_id = '${subA}'`)).toEqual([{ n: 1 }]);
    await expect(t.as(A, log)).rejects.toThrow(/unique|duplicate/);
  });

  it("B sees none of A's rows", async () => {
    for (const table of ["accounts", "transactions", "subscriptions"]) {
      expect(await t.as(B, `select count(*)::int n from public.${table} where user_id = '${A}'`)).toEqual([{ n: 0 }]);
    }
    expect(await t.as(B, `select count(*)::int n from public.profiles`)).toEqual([{ n: 1 }]);
    expect(await t.as(B, `select count(*)::int n from public.goals`)).toEqual([{ n: 1 }]);
  });

  it("B cannot write to A's data", async () => {
    await expect(t.as(B, `insert into public.transactions (type, amount, date, account_id) values ('out', 10, '2026-09-02', '${accA}')`)).rejects.toThrow(/foreign key/);
    await expect(t.as(B, `insert into public.accounts (user_id, name, kind) values ('${A}', 'hack', 'cash')`)).rejects.toThrow(/row-level security/);
    await t.as(B, `update public.goals set income_target = 1 where user_id = '${A}'`);
    expect(await t.rows(`select income_target from public.goals where user_id = '${A}'`)).toEqual([{ income_target: "0.00" }]);
    await t.as(B, `delete from public.transactions`);
    expect(await t.rows(`select count(*)::int n from public.transactions where user_id = '${A}'`)).toEqual([{ n: 4 }]);
  });

  it("A edits own goals and profile, but not the profile email", async () => {
    await t.as(A, `update public.goals set income_target = 50000, category_budgets = '{"food": 8000}' where user_id = '${A}'`);
    expect(await t.as(A, `select income_target from public.goals`)).toEqual([{ income_target: "50000.00" }]);
    await t.as(A, `update public.profiles set name = 'Al', settings = '{"faceLock": true}' where id = '${A}'`);
    await expect(t.as(A, `update public.profiles set email = 'x@y.com' where id = '${A}'`)).rejects.toThrow(/permission denied/);
  });

  it("anon can do nothing", async () => {
    await expect(t.as(null, `select * from public.accounts`)).rejects.toThrow(/permission denied/);
    await expect(t.as(null, `select public.delete_my_account()`)).rejects.toThrow(/permission denied/);
  });

  it("deleting a subscription keeps its logged expense", async () => {
    await t.as(A, `delete from public.subscriptions where id = '${subA}'`);
    expect(await t.as(A, `select subscription_id, user_id from public.transactions where title = 'Spotify'`)).toEqual([{ subscription_id: null, user_id: A }]);
  });

  it("delete_my_account removes everything of A and nothing of B", async () => {
    await t.as(A, `select public.delete_my_account()`);
    const [counts] = await t.rows(`select (select count(*)::int from public.accounts) a, (select count(*)::int from public.transactions) t,
      (select count(*)::int from public.profiles) p, (select count(*)::int from public.goals) g, (select count(*)::int from auth.users) u`);
    expect(counts).toEqual({ a: 1, t: 0, p: 1, g: 1, u: 1 });
  });
});
