import { beforeAll, describe, expect, it } from "vitest";
import { migratedDb } from "./setup";

const A = "aaaaaaaa-0000-0000-0000-000000000001";
const B = "bbbbbbbb-0000-0000-0000-000000000002";
const accA = "a0000000-0000-0000-0000-00000000000a";

let t: Awaited<ReturnType<typeof migratedDb>>;
const pending = () => t.rows<{ user_id: string }>(`select user_id from public.pending_log_reminders() order by user_id`).then((r) => r.map((x) => x.user_id));

describe.sequential("evening reminder to log", () => {
  beforeAll(async () => {
    t = await migratedDb();
    await t.db.exec(`insert into auth.users (id, email) values ('${A}', 'a@x.com'), ('${B}', 'b@x.com')`);
    await t.db.exec(`update public.profiles set settings = '{"dailyReminder": true}' where id = '${A}'`);
    await t.as(A, `insert into public.accounts (id, name, kind) values ('${accA}', 'เงินสด', 'cash')`);
  });

  it("reminds only users who turned it on and logged nothing today", async () => {
    expect(await pending()).toEqual([A]);
  });

  it("an automatic charge today doesn't count as logging", async () => {
    await t.as(A, `insert into public.subscriptions (id, name, amount, cycle, start_date, account_id, category) values ('a5000000-0000-0000-0000-000000000001', 'Netflix', 419, 'month', current_date, '${accA}', 'fun')`);
    await t.db.exec(`insert into public.transactions (user_id, type, amount, date, account_id, category, subscription_id) values ('${A}', 'out', 419, current_date, '${accA}', 'sub', 'a5000000-0000-0000-0000-000000000001')`);
    expect(await pending()).toEqual([A]);
  });

  it("stops once the user logs something, or was already reminded", async () => {
    await t.as(A, `insert into public.transactions (type, amount, date, account_id, category) values ('out', 65, current_date, '${accA}', 'food')`);
    expect(await pending()).toEqual([]);
    await t.db.exec(`delete from public.transactions where subscription_id is null`);
    await t.db.exec(`insert into public.log_reminders_sent (user_id, date) select id, public.user_today(timezone) from public.profiles where id = '${A}'`);
    expect(await pending()).toEqual([]);
  });

  it("is for the server only", async () => {
    await expect(t.as(A, `select * from public.pending_log_reminders()`)).rejects.toThrow(/permission/);
    await expect(t.as(A, `select * from public.log_reminders_sent`)).rejects.toThrow(/permission/);
  });
});
