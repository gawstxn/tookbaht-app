import { describe, expect, it } from "vitest"
import { customSplit, debtsByPerson, knownPeople, owedTotal, splitShare } from "@/lib/ious"
import type { Iou } from "@/lib/types"

let seq = 0
const iou = (p: Partial<Iou>): Iou => ({
  id: `i${++seq}`,
  person: "บอส",
  amount: 100,
  note: "",
  date: "2026-09-10",
  createdAt: seq,
  ...p,
})

describe("money friends owe", () => {
  it("groups unpaid debts by friend, largest first", () => {
    const list = [
      iou({ person: "บอส", amount: 300 }),
      iou({ person: "มิ้นท์", amount: 450 }),
      iou({ person: "บอส ", amount: 200 }),
      iou({ person: "มิ้นท์", amount: 99, settledOn: "2026-09-12" }),
    ]
    expect(debtsByPerson(list).map((d) => [d.person, d.total, d.items.length])).toEqual([
      ["บอส", 500, 2],
      ["มิ้นท์", 450, 1],
    ])
    expect(owedTotal(list)).toBe(950)
  })

  it("matches names regardless of case and spaces", () => {
    expect(debtsByPerson([iou({ person: "Boss" }), iou({ person: " boss" })])).toHaveLength(1)
  })

  it("splits a bill evenly, keeping leftover satang", () => {
    expect(splitShare(1200, 4)).toBe(300)
    expect(splitShare(100, 3)).toBe(33.33)
    expect(splitShare(100, 1)).toBe(0)
  })

  it("suggests names used before, newest first, once each", () => {
    expect(knownPeople([iou({ person: "บอส" }), iou({ person: "มิ้นท์" }), iou({ person: "บอส" })])).toEqual([
      "บอส",
      "มิ้นท์",
    ])
  })
})

describe("splitting by amount", () => {
  it("leaves the rest of the bill to the user", () => {
    expect(customSplit(1200, [450, 380.5])).toEqual({ friends: 830.5, yours: 369.5, ok: true })
    expect(customSplit(0.3, [0.1, 0.2])).toEqual({ friends: 0.3, yours: 0, ok: true })
  })

  it("rejects missing amounts and more than the bill", () => {
    expect(customSplit(1200, [450, 0]).ok).toBe(false)
    expect(customSplit(1200, [450, NaN]).ok).toBe(false)
    expect(customSplit(1200, [900, 400])).toEqual({ friends: 1300, yours: -100, ok: false })
    expect(customSplit(1200, []).ok).toBe(false)
  })
})
