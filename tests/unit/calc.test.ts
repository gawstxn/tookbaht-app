import { describe, expect, it } from "vitest"
import { evaluate, formatExpr, hasOperator, pressKey, type CalcKey } from "@/lib/calc"

const type = (keys: string, from = "") => [...keys].reduce((e, k) => pressKey(e, k as CalcKey), from)

describe("keypad calculator", () => {
  it("adds, subtracts and multiplies", () => {
    expect(evaluate(type("120+85"))).toBe(205)
    expect(evaluate(type("500-120"))).toBe(380)
    expect(evaluate(type("65*3"))).toBe(195)
  })

  it("multiplies before adding", () => {
    expect(evaluate(type("100+65*2"))).toBe(230)
    expect(evaluate(type("10*2-5*3"))).toBe(5)
  })

  it("rounds to satang", () => {
    expect(evaluate(type("0.1+0.2"))).toBe(0.3)
    expect(evaluate(type("33.33*3"))).toBe(99.99)
  })

  it("ignores a trailing operator or dot", () => {
    expect(evaluate("120+")).toBe(120)
    expect(evaluate("120.")).toBe(120)
    expect(evaluate("")).toBe(0)
  })

  it("replaces an operator typed twice and ignores a leading one", () => {
    expect(type("5+-3")).toBe("5-3")
    expect(type("+5")).toBe("5")
    expect(type("5.+")).toBe("5+")
  })

  it("keeps each number to two decimals and nine digits", () => {
    expect(type("1.234")).toBe("1.23")
    expect(type("1234567890")).toBe("123456789")
    expect(type("1.5+2.555")).toBe("1.5+2.55")
    expect(type("1..5")).toBe("1.5")
    expect(type("5+.")).toBe("5+0.")
  })

  it("replaces a lone leading zero", () => {
    expect(type("05")).toBe("5")
    expect(type("5+07")).toBe("5+7")
  })

  it("deletes the last character", () => {
    expect(pressKey("120+", "del")).toBe("120")
  })

  it("formats for display", () => {
    expect(formatExpr("1200+85.5*2")).toBe("1,200 + 85.5 × 2")
    expect(hasOperator("1200")).toBe(false)
    expect(hasOperator("1200-5")).toBe(true)
  })
})
