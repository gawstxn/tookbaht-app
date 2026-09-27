import { beforeAll, describe, expect, it } from "vitest";
import { migratedDb } from "./setup";

const U = "aaaaaaaa-0000-0000-0000-000000000001";
const OTHER = "bbbbbbbb-0000-0000-0000-000000000002";
const CARD = "a0000000-0000-0000-0000-00000000000a";
const NETFLIX = "51000000-0000-0000-0000-000000000001";
const SALARY = "51000000-0000-0000-0000-000000000002";

let t: Awaited<ReturnType<typeof migratedDb>>;
let today: string;
const owed = () => t.rows<{ person: string; amount: string; note: string; linked: boolean }>(
  `select person, amount::text, note, transaction_id is not null linked from public.ious where user_id = '${U}' order by person`,
);

describe.sequential("shared subscriptions", () => {
  beforeAll(async () => {
    t = await migratedDb();
    await t.db.exec(`insert into auth.users (id, email) values ('${U}', 'a@x.com'), ('${OTHER}', 'b@x.com');
      insert into public.accounts (id, user_id, name, kind) values ('${CARD}', '${U}', 'บัตร', 'credit');`);
    [{ d: today }] = await t.rows<{ d: string }>(`select public.user_today('Asia/Bangkok')::text d`);
  });

  it("each logged charge records what every friend owes, leftover satang staying with the user", async () => {
    await t.as(U, `insert into public.subscriptions (id, name, amount, cycle, start_date, account_id, category, split_with)
      values ('${NETFLIX}', 'Netflix', 419, 'month', '${today}', '${CARD}', 'fun', '{บอส,มิ้นท์,แพร}')`);
    await t.as(U, `select * from public.run_my_auto_log()`);
    expect(await owed()).toEqual([
      { person: "บอส", amount: "104.75", note: "Netflix", linked: true },
      { person: "มิ้นท์", amount: "104.75", note: "Netflix", linked: true },
      { person: "แพร", amount: "104.75", note: "Netflix", linked: true },
    ].sort((a, b) => (a.person < b.person ? -1 : 1)));
    // Running again logs nothing new, so no new debts either.
    await t.as(U, `select * from public.run_my_auto_log()`);
    expect(await owed()).toHaveLength(3);
  });

  it("leaves unshared subscriptions, income and hand-typed entries alone", async () => {
    await t.db.exec(`delete from public.ious`);
    await t.as(U, `insert into public.subscriptions (id, kind, entry_type, name, amount, cycle, start_date, account_id, category, split_with)
      values ('${SALARY}', 'recurring', 'in', 'เงินเดือน', 30000, 'month', '${today}', '${CARD}', 'salary', '{บอส}')`);
    await t.as(U, `select * from public.run_my_auto_log()`);
    await t.as(U, `insert into public.transactions (type, amount, date, account_id, category) values ('out', 99, '${today}', '${CARD}', 'food')`);
    expect(await owed()).toEqual([]);
  });

  it("doesn't add debts again for old charges brought back from a backup", async () => {
    await t.as(U, `insert into public.transactions (type, amount, date, title, account_id, category, subscription_id, created_at)
      values ('out', 419, '2026-01-01', 'Netflix', '${CARD}', 'sub', '${NETFLIX}', '2026-01-01T10:00:00Z')`);
    expect(await owed()).toEqual([]);
  });

  it("caps the list of friends", async () => {
    const many = Array.from({ length: 20 }, (_, i) => `f${i}`).join(",");
    await expect(t.as(U, `update public.subscriptions set split_with = '{${many}}' where id = '${NETFLIX}'`)).rejects.toThrow(/check/);
  });

  it("isn't callable directly", async () => {
    await expect(t.as(U, `select public.split_shared_charge()`)).rejects.toThrow();
  });
});
