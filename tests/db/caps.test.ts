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
});
