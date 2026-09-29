import { beforeAll, describe, expect, it } from "vitest";
import { migratedDb } from "./setup";

const A = "aaaaaaaa-0000-0000-0000-000000000001";
const B = "bbbbbbbb-0000-0000-0000-000000000002";

let t: Awaited<ReturnType<typeof migratedDb>>;

describe.sequential("per-user row caps", () => {
  beforeAll(async () => {
    t = await migratedDb();
    await t.db.exec(`insert into auth.users (id, email) values ('${A}', 'a@x.com'), ('${B}', 'b@x.com')`);
  });

  it("allows up to the cap in one go (like restoring a backup)", async () => {
    await t.as(A, `insert into public.accounts (name, kind) select 'acc ' || g, 'cash' from generate_series(1, 100) g`);
    expect(await t.rows(`select count(*)::int n from public.accounts where user_id = '${A}'`)).toEqual([{ n: 100 }]);
  });

  it("refuses rows past the cap, the whole statement", async () => {
    await expect(t.as(A, `insert into public.accounts (name, kind) values ('one more', 'cash')`)).rejects.toThrow(/row limit/);
    await t.db.exec(`delete from public.accounts where user_id = '${A}' and name in ('acc 99', 'acc 100')`);
    await expect(t.as(A, `insert into public.accounts (name, kind) select 'x' || g, 'cash' from generate_series(1, 3) g`)).rejects.toThrow(/row limit/);
    expect(await t.rows(`select count(*)::int n from public.accounts where user_id = '${A}'`)).toEqual([{ n: 98 }]);
  });

  it("counts each user separately", async () => {
    await t.as(B, `insert into public.accounts (name, kind) values ('B', 'bank')`);
  });

  it("caps savings goals and debts too", async () => {
    await t.as(A, `insert into public.savings_goals (name, target) select 'g' || g, 1 from generate_series(1, 100) g`);
    await expect(t.as(A, `insert into public.savings_goals (name, target) values ('over', 1)`)).rejects.toThrow(/row limit/);
  });

  it("caps entries at 30,000 per user", async () => {
    const acc = (await t.rows<{ id: string }>(`select id from public.accounts where user_id = '${B}'`))[0].id;
    const add = (n: number) => t.as(B, `insert into public.transactions (type, amount, date, account_id, category) select 'out', 1, current_date, '${acc}', 'food' from generate_series(1, ${n})`);
    await add(30000);
    await expect(add(1)).rejects.toThrow(/row limit/);
  }, 60_000);

  it("caps problem reports at 100 in all", async () => {
    await t.db.exec(`insert into public.feedback (user_id, message, created_at) select '${A}', 'old', now() - interval '30 days' from generate_series(1, 100)`);
    await expect(t.as(A, `insert into public.feedback (message) values ('one more')`)).rejects.toThrow(/row limit/);
  });

  it("limits the size of free-form columns", async () => {
    const acc = (await t.rows<{ id: string }>(`select id from public.accounts where user_id = '${A}' limit 1`))[0].id;
    await expect(t.as(A, `insert into public.transactions (type, amount, date, account_id, category) values ('out', 1, current_date, '${acc}', repeat('x', 41))`)).rejects.toThrow(/category_length/);
    await expect(t.as(A, `update public.profiles set settings = jsonb_build_object('x', repeat('x', 300000)) where id = '${A}'`)).rejects.toThrow(/settings_size/);
    await t.as(A, `update public.profiles set settings = jsonb_build_object('noSpend', (select jsonb_agg(jsonb_build_object('d', d::date::text, 'at', d::date::text)) from generate_series(current_date - 3650, current_date, '1 day') d)) where id = '${A}'`);
    await expect(t.as(A, `insert into public.goals (category_budgets) values (jsonb_build_object('x', repeat('x', 20000)))`)).rejects.toThrow(/category_budgets_size/);
  });
});
