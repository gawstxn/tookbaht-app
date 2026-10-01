import { beforeAll, describe, expect, it } from "vitest"
import { migratedDb } from "./setup"

const A = "aaaaaaaa-0000-0000-0000-000000000001"
const LONG_GOOGLE_NAME = "Somchai Jaidee Supercalifragilisticexpialidocious"

let t: Awaited<ReturnType<typeof migratedDb>>
const name = async () => (await t.rows<{ name: string }>(`select name from public.profiles where id = '${A}'`))[0].name

describe.sequential("profile name", () => {
  beforeAll(async () => {
    t = await migratedDb()
    await t.db.exec(
      `insert into auth.users (id, email, raw_user_meta_data) values ('${A}', 'a@x.com', '{"full_name":"${LONG_GOOGLE_NAME}"}')`,
    )
  })

  it("keeps a long name from Google at sign-up, and other updates to that row still work", async () => {
    expect(await name()).toBe(LONG_GOOGLE_NAME)
    await t.as(A, `select public.merge_settings('{"avatar":"cat"}')`)
    expect(await name()).toBe(LONG_GOOGLE_NAME)
  })

  it("accepts a rename of up to 40 characters", async () => {
    await t.as(A, `update public.profiles set name = 'สมชาย ใจดี' where id = '${A}'`)
    expect(await name()).toBe("สมชาย ใจดี")
    await t.as(A, `update public.profiles set name = '${"a".repeat(40)}' where id = '${A}'`)
    expect(await name()).toHaveLength(40)
  })

  it("rejects a blank or too-long name", async () => {
    await expect(t.as(A, `update public.profiles set name = '   ' where id = '${A}'`)).rejects.toThrow(/1 to 40/)
    await expect(t.as(A, `update public.profiles set name = '${"a".repeat(41)}' where id = '${A}'`)).rejects.toThrow(
      /1 to 40/,
    )
    expect(await name()).toHaveLength(40)
  })
})
