import { beforeAll, describe, expect, it } from "vitest";
import { migratedDb } from "./setup";

const A = "aaaaaaaa-0000-0000-0000-000000000001";
const accA = "a0000000-0000-0000-0000-00000000000a";
let t: Awaited<ReturnType<typeof migratedDb>>;

describe.sequential("tags and debt direction", () => {
  beforeAll(async () => {
    t = await migratedDb();
    await t.db.exec(`insert into auth.users (id, email) values ('${A}', 'a@x.com')`);
    await t.as(A, `insert into public.accounts (id, name, kind) values ('${accA}', 'เงินสด', 'cash')`);
  });

  it("stores a tag on an entry, and rejects an empty or long one", async () => {
    await t.as(A, `insert into public.transactions (type, amount, date, category, account_id, tag) values ('out', 500, '2026-09-26', 'food', '${accA}', 'เที่ยวญี่ปุ่น')`);
    expect(await t.as(A, `select tag from public.transactions`)).toEqual([{ tag: "เที่ยวญี่ปุ่น" }]);
    await expect(t.as(A, `insert into public.transactions (type, amount, date, category, account_id, tag) values ('out', 1, '2026-09-26', 'food', '${accA}', '')`)).rejects.toThrow(/check/);
    await expect(t.as(A, `insert into public.transactions (type, amount, date, category, account_id, tag) values ('out', 1, '2026-09-26', 'food', '${accA}', '${"x".repeat(41)}')`)).rejects.toThrow(/check/);
  });

  it("debts default to friends owing the user, and can go the other way", async () => {
    await t.as(A, `insert into public.ious (person, amount, date) values ('บอส', 100, '2026-09-26')`);
    await t.as(A, `insert into public.ious (person, amount, date, direction) values ('มิ้นท์', 250, '2026-09-26', 'i_owe')`);
    expect(await t.as(A, `select person, direction from public.ious order by person`)).toEqual([
      { person: "บอส", direction: "owed_to_me" },
      { person: "มิ้นท์", direction: "i_owe" },
    ]);
    await expect(t.as(A, `insert into public.ious (person, amount, date, direction) values ('x', 1, '2026-09-26', 'sideways')`)).rejects.toThrow(/check/);
  });
});
