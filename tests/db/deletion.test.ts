import { beforeAll, describe, expect, it } from "vitest"
import { migratedDb } from "./setup"

const U = "aaaaaaaa-0000-0000-0000-000000000001"
let t: Awaited<ReturnType<typeof migratedDb>>
const signedIn = (ago: string) =>
  t.db.exec(`update auth.users set last_sign_in_at = now() - interval '${ago}' where id = '${U}'`)
const requested = async () =>
  (await t.rows<{ r: string | null }>(`select deletion_requested_at::text r from public.profiles where id = '${U}'`))[0]
    .r

describe.sequential("account deletion with a 30-day grace period", () => {
  beforeAll(async () => {
    t = await migratedDb()
    await t.db.exec(`insert into auth.users (id, email) values ('${U}', 'a@x.com');
      insert into public.accounts (user_id, name, kind) values ('${U}', 'A', 'bank');
      insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values ('${U}', 'https://web.push.apple.com/x', 'k', 'a');`)
  })

  it("needs a sign-in within the last 10 minutes", async () => {
    await signedIn("2 hours")
    await expect(t.as(U, `select public.request_account_deletion()`)).rejects.toThrow(/reauthentication required/)
    expect(await requested()).toBeNull()
  })

  it("closes the account for 30 days and stops push", async () => {
    await signedIn("1 minute")
    const [{ until }] = await t.as<{ until: string }>(
      U,
      `select (public.request_account_deletion() - now() > interval '29 days') until`,
    )
    expect(until).toBe(true)
    expect(await requested()).not.toBeNull()
    expect(await t.rows(`select count(*)::int n from public.push_subscriptions`)).toEqual([{ n: 0 }])
  })

  it("keeps the data until the 30 days are up", async () => {
    expect(await t.rows(`select public.purge_deleted_accounts() n`)).toEqual([{ n: 0 }])
    expect(await t.rows(`select count(*)::int n from auth.users`)).toEqual([{ n: 1 }])
  })

  it("can be cancelled by signing in again", async () => {
    await t.as(U, `select public.cancel_account_deletion()`)
    expect(await requested()).toBeNull()
  })

  it("removes the user and all their data after 30 days", async () => {
    await signedIn("1 minute")
    await t.as(U, `select public.request_account_deletion()`)
    await t.db.exec(`update public.profiles set deletion_requested_at = now() - interval '30 days 1 hour'`)
    expect(await t.rows(`select public.purge_deleted_accounts() n`)).toEqual([{ n: 1 }])
    expect(
      await t.rows(
        `select (select count(*)::int from auth.users) u, (select count(*)::int from public.accounts) a, (select count(*)::int from public.profiles) p`,
      ),
    ).toEqual([{ u: 0, a: 0, p: 0 }])
  })

  it("isn't available to anon, and purging isn't available to users", async () => {
    await expect(t.as(null, `select public.request_account_deletion()`)).rejects.toThrow(/permission denied/)
    await expect(t.as(U, `select public.purge_deleted_accounts()`)).rejects.toThrow(/permission denied/)
  })
})
