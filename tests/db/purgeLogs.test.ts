import { beforeAll, describe, expect, it } from "vitest";
import { migratedDb } from "./setup";

const A = "aaaaaaaa-0000-0000-0000-000000000001";
const ACC = "a0000000-0000-0000-0000-00000000000a";
const SUB = "a5000000-0000-0000-0000-000000000001";

let t: Awaited<ReturnType<typeof migratedDb>>;
const count = async (table: string) => (await t.rows<{ n: number }>(`select count(*)::int n from public.${table}`))[0].n;

describe.sequential("purging old push logs", () => {
  beforeAll(async () => {
    t = await migratedDb();
    await t.db.exec(`insert into auth.users (id, email) values ('${A}', 'a@x.com');
      insert into public.accounts (id, user_id, name, kind, due_day) values ('${ACC}', '${A}', 'บัตร', 'credit', 5);
      insert into public.subscriptions (id, user_id, name, amount, cycle, start_date, account_id, category)
        values ('${SUB}', '${A}', 'Netflix', 419, 'month', current_date - 400, '${ACC}', 'fun');
      insert into public.reminders_sent (subscription_id, due_date) values ('${SUB}', current_date - 30), ('${SUB}', current_date + 1);
      insert into public.due_reminders_sent (account_id, due_date) values ('${ACC}', current_date - 30), ('${ACC}', current_date + 1);
      insert into public.log_reminders_sent (user_id, date) values ('${A}', current_date - 30), ('${A}', current_date);
      insert into public.budget_alerts_sent (user_id, month, budget_key, level) values
        ('${A}', to_char(current_date - 365, 'YYYY-MM'), 'total', 80), ('${A}', to_char(current_date, 'YYYY-MM'), 'total', 80),
        ('${A}', to_char(current_date - 31, 'YYYY-MM'), 'total', 80);
      insert into public.month_summaries_sent (user_id, month) values
        ('${A}', to_char(current_date - 365, 'YYYY-MM')), ('${A}', to_char(current_date - 31, 'YYYY-MM'));`);
    await t.db.exec(`select public.purge_old_logs()`);
  });

  it("drops rows no reminder check reads any more", async () => {
    expect(await count("reminders_sent")).toBe(1);
    expect(await count("due_reminders_sent")).toBe(1);
    expect(await count("log_reminders_sent")).toBe(1);
  });

  it("keeps this month's and last month's alerts and summaries", async () => {
    expect(await count("budget_alerts_sent")).toBe(2);
    expect(await count("month_summaries_sent")).toBe(1);
  });

  it("only the service role can run it", async () => {
    await expect(t.as(A, `select public.purge_old_logs()`)).rejects.toThrow(/permission denied/);
  });
});
