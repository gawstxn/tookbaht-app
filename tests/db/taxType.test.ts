import { beforeAll, describe, expect, it } from "vitest"
import { migratedDb } from "./setup"

const A = "aaaaaaaa-0000-0000-0000-000000000001"
const ACC = "a0000000-0000-0000-0000-00000000000a"
let t: Awaited<ReturnType<typeof migratedDb>>

describe("tax deduction type on entries", () => {
  beforeAll(async () => {
    t = await migratedDb()
    await t.db.exec(`insert into auth.users (id, email) values ('${A}', 'a@x.com');
      insert into public.accounts (id, user_id, name, kind) values ('${ACC}', '${A}', 'bank', 'bank');`)
  })

  it("marks an expense with a known kind", async () => {
    await t.as(
      A,
      `insert into public.transactions (type, amount, date, account_id, category, tax_type) values ('out', 25000, '2026-03-01', '${ACC}', 'health', 'life')`,
    )
    expect(await t.as(A, `select tax_type from public.transactions`)).toEqual([{ tax_type: "life" }])
  })

  it("rejects unknown kinds and income", async () => {
    await expect(
      t.as(
        A,
        `insert into public.transactions (type, amount, date, account_id, category, tax_type) values ('out', 1, '2026-03-01', '${ACC}', 'food', 'lottery')`,
      ),
    ).rejects.toThrow(/check/)
    await expect(
      t.as(
        A,
        `insert into public.transactions (type, amount, date, account_id, category, tax_type) values ('in', 1, '2026-03-01', '${ACC}', 'salary', 'rmf')`,
      ),
    ).rejects.toThrow(/transactions_tax_out/)
  })
})
