import { beforeAll, describe, expect, it } from "vitest";
import { migratedDb } from "./setup";

const A = "aaaaaaaa-0000-0000-0000-000000000001";
const ACC = "a0000000-0000-0000-0000-00000000000a";

let t: Awaited<ReturnType<typeof migratedDb>>;
/** A trial that began a month ago and ends (first charge) in n days. */
const trial = (name: string, n: number, cycle = "month", flags = { remind: true, paused: false }) =>
  t.as(
    A,
    `insert into public.subscriptions (name, amount, cycle, start_date, trial_from, account_id, category, remind, paused)
     values ('${name}', 750, '${cycle}', current_date + ${n}, current_date + ${n} - 30, '${ACC}', 'tools', ${flags.remind}, ${flags.paused})`,
  );
const reviews = () => t.rows<{ name: string; days: number; trial: boolean }>(`select name, days, trial from public.pending_renewal_reviews() order by name`);

describe.sequential("free trials", () => {
  beforeAll(async () => {
    t = await migratedDb();
    await t.db.exec(`insert into auth.users (id, email) values ('${A}', 'a@x.com')`);
    await t.as(A, `insert into public.accounts (id, name, kind) values ('${ACC}', 'บัตร', 'bank')`);
  });

  it("must start before the first charge, on services only", async () => {
    await expect(
      t.as(A, `insert into public.subscriptions (name, amount, cycle, start_date, trial_from, account_id, category) values ('same-day', 1, 'month', current_date, current_date, '${ACC}', 'fun')`),
    ).rejects.toThrow(/subscriptions_trial/);
    await expect(
      t.as(
        A,
        `insert into public.subscriptions (kind, entry_type, name, amount, cycle, start_date, trial_from, account_id, category)
         values ('recurring', 'out', 'rent', 1, 'month', current_date + 5, current_date, '${ACC}', 'home')`,
      ),
    ).rejects.toThrow(/subscriptions_trial/);
  });

  it("logs nothing during the trial and the first charge on the day it ends", async () => {
    // Began a month ago, ends today: only today's charge is logged.
    await trial("ends-today", 0);
    await trial("still-free", 10);
    await t.rows(`select * from public.log_due_subscriptions()`);
    expect(await t.rows(`select title, date = current_date as today from public.transactions order by title`)).toEqual([{ title: "ends-today", today: true }]);
  });

  it("asks 3 days before a trial ends (2 when added late), in any cycle", async () => {
    await t.db.exec(`delete from public.subscriptions; delete from public.transactions`);
    await trial("a-three", 3);
    await trial("b-two", 2, "week");
    await trial("c-tomorrow", 1);
    await trial("d-four", 4, "year");
    await trial("e-off", 3, "month", { remind: false, paused: false });
    await trial("f-paused", 3, "month", { remind: true, paused: true });
    expect(await reviews()).toEqual([
      { name: "a-three", days: 3, trial: true },
      { name: "b-two", days: 2, trial: true },
    ]);
  });

  it("still asks about yearly renewals a week ahead, not as trials", async () => {
    await t.db.exec(`delete from public.subscriptions`);
    await t.as(
      A,
      `insert into public.subscriptions (name, amount, cycle, start_date, account_id, category)
       values ('domain', 350, 'year', (current_date + 6 - interval '1 year')::date, '${ACC}', 'work')`,
    );
    // After a yearly trial, the next renewal is an ordinary one.
    await t.as(
      A,
      `insert into public.subscriptions (name, amount, cycle, start_date, trial_from, account_id, category)
       values ('ai-pro', 750, 'year', (current_date + 5 - interval '1 year')::date, (current_date + 5 - interval '2 years')::date, '${ACC}', 'tools')`,
    );
    expect(await reviews()).toEqual([
      { name: "ai-pro", days: 5, trial: false },
      { name: "domain", days: 6, trial: false },
    ]);
  });

  it("flags the day-before reminder of the first charge after a trial", async () => {
    await t.db.exec(`delete from public.subscriptions`);
    await trial("first", 1);
    await t.as(A, `insert into public.subscriptions (name, amount, cycle, start_date, account_id, category) values ('plain', 99, 'month', current_date + 1, '${ACC}', 'fun')`);
    expect(await t.rows(`select name, trial from public.pending_reminders() order by name`)).toEqual([
      { name: "first", trial: true },
      { name: "plain", trial: false },
    ]);
  });

  it("keeps the reminder functions for the service role only", async () => {
    await expect(t.as(A, `select * from public.pending_reminders()`)).rejects.toThrow();
    await expect(t.as(A, `select * from public.pending_renewal_reviews()`)).rejects.toThrow();
  });
});
