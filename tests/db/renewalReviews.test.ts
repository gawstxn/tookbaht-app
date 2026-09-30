import { beforeAll, describe, expect, it } from "vitest";
import { migratedDb } from "./setup";

const A = "aaaaaaaa-0000-0000-0000-000000000001";
const ACC = "a0000000-0000-0000-0000-00000000000a";

let t: Awaited<ReturnType<typeof migratedDb>>;
const pending = () => t.rows<{ name: string; days: number }>(`select name, days from public.pending_renewal_reviews() order by name`);
/** A yearly service first billed a year before `current_date + n`, so it renews in n days. */
const yearly = (name: string, n: number, flags = { remind: true, paused: false }) =>
  t.as(
    A,
    `insert into public.subscriptions (name, amount, cycle, start_date, account_id, category, remind, paused)
     values ('${name}', 350, 'year', (current_date + ${n} - interval '1 year')::date, '${ACC}', 'work', ${flags.remind}, ${flags.paused})`,
  );

describe.sequential("renewal review pushes", () => {
  beforeAll(async () => {
    t = await migratedDb();
    await t.db.exec(`insert into auth.users (id, email) values ('${A}', 'a@x.com')`);
    await t.as(A, `insert into public.accounts (id, name, kind) values ('${ACC}', 'บัตร', 'bank')`);
  });

  it("asks about yearly services renewing in 2 to 7 days", async () => {
    await yearly("a-week", 7);
    await yearly("b-late", 3);
    await yearly("c-tomorrow", 1);
    await yearly("d-far", 8);
    expect(await pending()).toEqual([
      { name: "a-week", days: 7 },
      { name: "b-late", days: 3 },
    ]);
  });

  it("skips services with reminders off, paused ones and monthly ones", async () => {
    await t.db.exec(`delete from public.subscriptions`);
    await yearly("off", 5, { remind: false, paused: false });
    await yearly("paused", 5, { remind: true, paused: true });
    await t.as(A, `insert into public.subscriptions (name, amount, cycle, start_date, account_id, category) values ('monthly', 99, 'month', current_date + 5, '${ACC}', 'fun')`);
    expect(await pending()).toEqual([]);
  });

  it("asks once per renewal", async () => {
    await t.db.exec(`delete from public.subscriptions`);
    await yearly("domain", 6);
    const [row] = await t.rows<{ subscription_id: string; due_date: string }>(`select subscription_id, due_date::text from public.pending_renewal_reviews()`);
    await t.db.exec(`insert into public.renewal_reviews_sent (subscription_id, due_date) values ('${row.subscription_id}', '${row.due_date}')`);
    expect(await pending()).toEqual([]);
  });

  it("is only for the service role", async () => {
    await expect(t.as(A, `select * from public.pending_renewal_reviews()`)).rejects.toThrow();
    await expect(t.as(A, `select * from public.renewal_reviews_sent`)).rejects.toThrow();
  });
});
