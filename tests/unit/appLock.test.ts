import { describe, expect, it } from "vitest";
import { checkPin, hashPin, makeLock } from "@/lib/appLock";

describe("app lock PIN", () => {
  it("accepts the PIN it was set with and nothing else", async () => {
    const lock = await makeLock("2468");
    expect(await checkPin(lock, "2468")).toBe(true);
    expect(await checkPin(lock, "2469")).toBe(false);
    expect(await checkPin(lock, "")).toBe(false);
  });

  it("never stores the PIN itself, and salts each lock differently", async () => {
    const a = await makeLock("1234");
    const b = await makeLock("1234");
    expect(JSON.stringify(a)).not.toContain("1234");
    expect(a.salt).not.toBe(b.salt);
    expect(a.pinHash).not.toBe(b.pinHash);
  });

  it("hashes deterministically for a given salt", async () => {
    expect(await hashPin("1234", "s")).toBe(await hashPin("1234", "s"));
    expect(await hashPin("1234", "s")).toMatch(/^[0-9a-f]{64}$/);
  });
});
