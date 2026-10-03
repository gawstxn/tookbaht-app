import { describe, expect, it } from "vitest"
import { describeError, isReportable } from "@/lib/errorReport"
import { cleanPage, errorEmbed, errorRecord, fingerprint, scrub, trimStack, type ErrorInput } from "@/lib/errorText"

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1"
const STACK = `TypeError: Cannot read properties of undefined (reading 'amount')
    at total (https://tookbaht.gawstxn.dev/_next/static/chunks/app-1a2b3c4d5e6f.js?dpl=abc:1:2345)
    at Home (https://tookbaht.gawstxn.dev/_next/static/chunks/app-1a2b3c4d5e6f.js:1:9876)`
const input = (patch: Partial<ErrorInput> = {}): ErrorInput => ({
  source: "error",
  message: "TypeError: Cannot read properties of undefined (reading 'amount')",
  stack: STACK,
  page: "/subscriptions/0b0e7f0a-1c2d-4e5f-8a9b-0c1d2e3f4a5b/edit?from=home",
  appVersion: "1.45.0 (abc1234)",
  userAgent: IPHONE,
  ...patch,
})

describe("what the browser sends", () => {
  it("reads an Error, a database error and a string", () => {
    expect(describeError(new TypeError("x is not a function")).message).toBe("TypeError: x is not a function")
    expect(describeError({ message: "permission denied for table wishes", code: "42501", hint: null })).toEqual({
      message: "permission denied for table wishes [42501]",
      stack: "",
    })
    expect(describeError("boom")).toEqual({ message: "boom", stack: "" })
    expect(describeError(undefined).message).toBe("")
  })

  it("leaves out what isn't the app's doing", () => {
    expect(isReportable("TypeError: x is not a function", STACK)).toBe(true)
    for (const noise of [
      "",
      "Script error.",
      "TypeError: Failed to fetch",
      "TypeError: Load failed",
      "AbortError: The operation was aborted.",
      "ResizeObserver loop completed with undelivered notifications.",
      "ChunkLoadError: Loading chunk 12 failed.",
    ])
      expect(isReportable(noise, ""), noise).toBe(false)
    expect(isReportable("TypeError: x", "at foo (chrome-extension://abcdef/content.js:1:1)")).toBe(false)
  })
})

describe("what is kept of an error", () => {
  it("takes out what could be the user's own data", () => {
    expect(scrub('duplicate key value violates unique constraint "accounts_name" Key (name)=(ค่าไฟ บ้าน)')).toBe(
      'duplicate key value violates unique constraint "accounts_name" Key (name)=(…)',
    )
    expect(scrub("failed for somchai@example.com with 0812345678")).toBe("failed for [email] with [number]")
    expect(scrub("row 0b0e7f0a-1c2d-4e5f-8a9b-0c1d2e3f4a5b amount 1,250,000.50")).toBe("row [id] amount [number]")
    expect(scrub("ข้าวมันไก่ ร้านป้า is not valid")).toBe("… is not valid")
    // Short numbers (a status, a line number) say where, not who.
    expect(scrub("status 500 at line 42")).toBe("status 500 at line 42")
  })

  it("keeps the top of the stack, without the site's address", () => {
    expect(trimStack(STACK, "Cannot read properties of undefined (reading 'amount')")).toBe(
      "at total (/_next/static/chunks/app-1a2b3c4d5e6f.js:1:2345)\nat Home (/_next/static/chunks/app-1a2b3c4d5e6f.js:1:9876)",
    )
    expect(
      trimStack(Array.from({ length: 30 }, (_, i) => `at f${i} (a.js:1:${i})`).join("\n"), "x").split("\n"),
    ).toHaveLength(6)
  })

  it("keeps the path without ids or the query", () => {
    expect(cleanPage("/subscriptions/0b0e7f0a-1c2d-4e5f-8a9b-0c1d2e3f4a5b/edit?from=home")).toBe(
      "/subscriptions/[id]/edit",
    )
  })

  it("the same error has the same fingerprint across users, lines and builds", () => {
    const a = errorRecord(input())!
    const b = errorRecord(
      input({
        stack: STACK.replaceAll("1a2b3c4d5e6f", "ffffffffffff").replace(":1:2345", ":1:999"),
        page: "/",
        userAgent: "",
      }),
    )!
    expect(a.fingerprint).toMatch(/^[0-9a-f]{16}$/)
    expect(b.fingerprint).toBe(a.fingerprint)
    // A different error, or the same message from somewhere else, is another one.
    expect(errorRecord(input({ message: "TypeError: x is not a function" }))!.fingerprint).not.toBe(a.fingerprint)
    expect(fingerprint("error", "boom", "at a (x.js:1:1)")).not.toBe(fingerprint("error", "boom", "at b (x.js:1:1)"))
    // Numbers in the message don't split one error into many.
    expect(fingerprint("save", "row 12 too long", "")).toBe(fingerprint("save", "row 97 too long", ""))
  })

  it("is cleaned, cut to size and labelled with the device", () => {
    const r = errorRecord(input({ message: `bad value ${"x".repeat(500)} for somchai@example.com` }))!
    expect(r.message.length).toBeLessThanOrEqual(300)
    expect(r).toMatchObject({
      page: "/subscriptions/[id]/edit",
      device: "iPhone · Safari",
      appVersion: "1.45.0 (abc1234)",
    })
    expect(JSON.stringify(errorRecord(input({ message: "x somchai@example.com" })))).not.toMatch(
      /somchai|tookbaht\.gawstxn/,
    )
    expect(errorRecord(input({ message: "   " }))).toBeNull()
  })
})

describe("an error in Discord", () => {
  const record = errorRecord(input())!

  it("says what broke, where, and when", () => {
    const now = Date.now()
    const embed = errorEmbed(record, 1, 1, now)
    expect(embed.title).toBe("ข้อผิดพลาดใหม่")
    expect(embed.description).toContain("```\nTypeError: Cannot read properties of undefined (reading 'amount')\n```")
    expect(embed.description).toContain("at total (")
    expect(embed.footer).toEqual({ text: "/subscriptions/[id]/edit · v1.45.0 (abc1234) · iPhone · Safari" })
    expect(embed.fields).toBeUndefined()
    expect(embed.timestamp).toBe(new Date(now).toISOString())
  })

  it("a repeat says how often and to how many people", () => {
    const embed = errorEmbed(record, 1000, 12)
    expect(embed.title).toBe("ข้อผิดพลาดเกิดซ้ำ 1,000 ครั้งวันนี้")
    expect(embed.fields).toEqual([{ name: "ผู้ใช้ที่เจอ", value: "12 คน", inline: true }])
  })

  it("a message can't break out of its code block or go past Discord's limit", () => {
    const embed = errorEmbed(errorRecord(input({ message: "bad ``` value", stack: "at a\n".repeat(400) }))!, 1, 1)
    expect(embed.description?.match(/```/g)).toHaveLength(4)
    expect(embed.description!.length).toBeLessThanOrEqual(4096)
  })
})
