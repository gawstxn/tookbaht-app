import { beforeAll, describe, expect, it } from "vitest";
import { migratedDb } from "./setup";

const A = "aaaaaaaa-0000-0000-0000-000000000001";
const ACC = "a0000000-0000-0000-0000-00000000000a";
let t: Awaited<ReturnType<typeof migratedDb>>;

const insert = (cur: string) =>
  t.as(A, `insert into public.transactions (type, amount, date, account_id, category, orig_amount, orig_currency, fx_rate) values ('out', 690.12, '2026-10-02', '${ACC}', 'food', 3000, '${cur}', 0.2255)`);

describe("entries in a trip's currency", () => {
  beforeAll(async () => {
    t = await migratedDb();
    await t.db.exec(`insert into auth.users (id, email) values ('${A}', 'a@x.com');
      insert into public.accounts (id, user_id, name, kind) values ('${ACC}', '${A}', 'bank', 'bank');`);
  });

  it("keeps the original amount in yen, won or euro", async () => {
    await insert("JPY");
    await insert("KRW");
    await insert("EUR");
    expect(await t.as(A, `select orig_currency from public.transactions order by orig_currency`)).toEqual([{ orig_currency: "EUR" }, { orig_currency: "JPY" }, { orig_currency: "KRW" }]);
  });

  it("rejects currencies without a published rate", async () => {
    await expect(insert("VND")).rejects.toThrow(/transactions_orig_currency_check/);
    await expect(insert("THB")).rejects.toThrow(/transactions_orig_currency_check/);
  });

  it("stores rates for trip currencies (server only) and reads them back", async () => {
    await t.db.exec(`insert into public.exchange_rates (currency, date, rate) values ('JPY', '2026-10-01', 0.2255)`);
    await expect(t.db.exec(`insert into public.exchange_rates (currency, date, rate) values ('VND', '2026-10-01', 0.0013)`)).rejects.toThrow(/exchange_rates_currency_check/);
    expect(await t.as(A, `select public.thb_rate('JPY', '2026-10-03') as rate`)).toEqual([{ rate: "0.22550000" }]);
    await expect(t.as(A, `insert into public.exchange_rates (currency, date, rate) values ('JPY', '2026-10-02', 1)`)).rejects.toThrow(/permission denied/);
  });
});

describe("small-unit rates", () => {
  it("keeps eight decimals for a rupiah", async () => {
    const db = await migratedDb();
    await db.db.exec(`insert into public.exchange_rates (currency, date, rate) values ('IDR', '2026-10-01', 0.00199123)`);
    expect((await db.db.query(`select rate from public.exchange_rates`)).rows).toEqual([{ rate: "0.00199123" }]);
  });
});
