import { beforeAll, describe, expect, it } from "vitest";
import { migratedDb } from "./setup";

const A = "aaaaaaaa-0000-0000-0000-000000000001";
const B = "bbbbbbbb-0000-0000-0000-000000000002";

let t: Awaited<ReturnType<typeof migratedDb>>;
const settings = async (uid: string) => (await t.rows<{ s: Record<string, unknown> }>(`select settings s from public.profiles where id = '${uid}'`))[0].s;

describe.sequential("merging settings", () => {
  beforeAll(async () => {
    t = await migratedDb();
    await t.db.exec(`insert into auth.users (id, email) values ('${A}', 'a@x.com'), ('${B}', 'b@x.com')`);
    await t.db.exec(`update public.profiles set settings = '{"lang":"th","customCategories":[{"key":"c-1","label":"สัตว์เลี้ยง"}]}' where id = '${A}'`);
  });

  it("changes only the keys in the patch, so another device's older copy can't wipe the rest", async () => {
    // A second device that never saw the categories turns a switch on.
    await t.as(A, `select public.merge_settings('{"dailyReminder":true}')`);
    expect(await settings(A)).toEqual({ lang: "th", dailyReminder: true, customCategories: [{ key: "c-1", label: "สัตว์เลี้ยง" }] });
  });

  it("replaces a key's value and removes keys set to null", async () => {
    await t.as(A, `select public.merge_settings('{"promptPayId":"0812345678","lang":"en"}')`);
    await t.as(A, `select public.merge_settings('{"promptPayId":null}')`);
    const s = await settings(A);
    expect(s.lang).toBe("en");
    expect("promptPayId" in s).toBe(false);
  });

  it("returns the merged settings", async () => {
    const [{ merge_settings }] = await t.as<{ merge_settings: Record<string, unknown> }>(A, `select public.merge_settings('{"keypadMath":false}')`);
    expect(merge_settings.keypadMath).toBe(false);
    expect(merge_settings.lang).toBe("en");
  });

  it("only ever touches the caller's own profile", async () => {
    await t.as(B, `select public.merge_settings('{"lang":"th"}')`);
    expect((await settings(A)).lang).toBe("en");
    expect((await settings(B)).lang).toBe("th");
    await expect(t.as(null, `select public.merge_settings('{"lang":"th"}')`)).rejects.toThrow(/permission/);
  });

  it("ignores a patch that isn't an object", async () => {
    await t.as(A, `select public.merge_settings('[1,2]')`);
    expect((await settings(A)).lang).toBe("en");
  });
});
