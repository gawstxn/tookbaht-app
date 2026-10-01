import { beforeAll, describe, expect, it } from "vitest"
import { migratedDb } from "./setup"

const A = "aaaaaaaa-0000-0000-0000-000000000001"
const B = "bbbbbbbb-0000-0000-0000-000000000002"
const ACC = "a0000000-0000-0000-0000-00000000000a"
const ACC_B = "b0000000-0000-0000-0000-00000000000a"
const W = "70000000-0000-0000-0000-000000000001"
let t: Awaited<ReturnType<typeof migratedDb>>

describe.sequential("wishlist", () => {
  beforeAll(async () => {
    t = await migratedDb()
    await t.db.exec(`insert into auth.users (id, email) values ('${A}', 'a@x.com'), ('${B}', 'b@x.com');
      insert into public.accounts (id, user_id, name, kind) values ('${ACC}', '${A}', 'bank', 'bank'), ('${ACC_B}', '${B}', 'bank', 'bank');`)
  })

  it("keeps wishes private to their owner", async () => {
    await t.as(A, `insert into public.wishes (id, name, price, decide_on) values ('${W}', 'หูฟัง', 3990, '2026-10-06')`)
    expect(await t.as(B, `select * from public.wishes`)).toEqual([])
    await t.as(B, `update public.wishes set status = 'skipped', decided_on = '2026-10-06'`)
    expect(await t.rows(`select status from public.wishes`)).toEqual([{ status: "waiting" }])
  })

  it("links a bought wish to its expense, and forgets the link if the expense is deleted", async () => {
    const [tx] = await t.as<{ id: string }>(
      A,
      `insert into public.transactions (type, amount, date, account_id, category) values ('out', 3990, '2026-10-06', '${ACC}', 'shop') returning id`,
    )
    await t.as(
      A,
      `update public.wishes set status = 'bought', decided_on = '2026-10-06', transaction_id = '${tx.id}' where id = '${W}'`,
    )
    await t.as(A, `delete from public.transactions where id = '${tx.id}'`)
    expect(await t.rows(`select status, transaction_id from public.wishes where id = '${W}'`)).toEqual([
      { status: "bought", transaction_id: null },
    ])
  })

  it("can't point at someone else's expense", async () => {
    const [tx] = await t.as<{ id: string }>(
      B,
      `insert into public.transactions (type, amount, date, account_id, category) values ('out', 1, '2026-10-06', '${ACC_B}', 'shop') returning id`,
    )
    await expect(t.as(A, `update public.wishes set transaction_id = '${tx.id}' where id = '${W}'`)).rejects.toThrow(
      /foreign key/,
    )
  })

  it("requires a decision date exactly when decided", async () => {
    await expect(
      t.as(A, `insert into public.wishes (name, price, decide_on, status) values ('x', 1, '2026-10-06', 'skipped')`),
    ).rejects.toThrow(/wishes_decided/)
    await expect(
      t.as(
        A,
        `insert into public.wishes (name, price, decide_on, decided_on) values ('x', 1, '2026-10-06', '2026-10-06')`,
      ),
    ).rejects.toThrow(/wishes_decided/)
    await expect(
      t.as(A, `insert into public.wishes (name, price, decide_on) values ('x', 0, '2026-10-06')`),
    ).rejects.toThrow(/check/)
  })

  it("can't be emptied or read signed out", async () => {
    await expect(t.as(A, `truncate public.wishes`)).rejects.toThrow(/permission/)
    await expect(t.as(null, `select * from public.wishes`)).rejects.toThrow(/permission/)
  })
})
