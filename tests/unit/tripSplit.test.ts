import { describe, expect, it } from "vitest"
import { ME, settleUp, tripBalances, tripShares, type TripBill } from "@/lib/tripSplit"

const bill = (amount: number, payer: string, people: string[], id = String(amount)): TripBill => ({
  id,
  title: id,
  amount,
  payer,
  people,
})
const ALL = [ME, "บอส", "มิ้นท์", "แพร"]
const byFrom = <T extends { from: string }>(t: T[]) => [...t].sort((a, b) => (a.from < b.from ? -1 : 1))

describe("trip shares", () => {
  it("splits each bill evenly and keeps leftover satang so shares add up", () => {
    const s = tripShares([bill(100, ME, [ME, "บอส", "มิ้นท์"])])
    expect([...s.values()]).toEqual([3334, 3333, 3333])
    expect(s.get(ME)).toBe(3334)
  })

  it("gives nothing to people left out of a bill", () => {
    const s = tripShares([bill(900, "บอส", ["บอส", "มิ้นท์", "แพร"])])
    expect(s.has(ME)).toBe(false)
  })

  it("balances always sum to zero", () => {
    const bills = [
      bill(1234.57, ME, ALL, "a"),
      bill(333.33, "บอส", [ME, "บอส", "แพร"], "b"),
      bill(99.99, "แพร", ["มิ้นท์", "แพร"], "c"),
    ]
    expect([...tripBalances(bills).values()].reduce((a, b) => a + b, 0)).toBe(0)
  })
})

describe("settling up", () => {
  it("one payer: everyone pays them back their share", () => {
    expect(byFrom(settleUp([bill(4000, ME, ALL)]))).toEqual(
      byFrom([
        { from: "บอส", to: ME, amount: 1000 },
        { from: "มิ้นท์", to: ME, amount: 1000 },
        { from: "แพร", to: ME, amount: 1000 },
      ]),
    )
  })

  it("nets out bills paid by different people", () => {
    // Hotel 4,000 paid by me, dinner 2,000 paid by บอส, both shared by all four.
    const t = settleUp([bill(4000, ME, ALL, "hotel"), bill(2000, "บอส", ALL, "dinner")])
    // Each owes 1,500 in total: I paid 4,000 (+2,500), บอส paid 2,000 (+500), the others −1,500 each.
    expect(t).toHaveLength(3)
    const total = (p: string) =>
      t.filter((x) => x.to === p).reduce((a, x) => a + x.amount, 0) -
      t.filter((x) => x.from === p).reduce((a, x) => a + x.amount, 0)
    expect(total(ME)).toBe(2500)
    expect(total("บอส")).toBe(500)
    expect(total("มิ้นท์")).toBe(-1500)
    expect(total("แพร")).toBe(-1500)
  })

  it("needs no transfers when everyone paid their own share", () => {
    expect(settleUp([bill(100, ME, [ME, "บอส"], "a"), bill(100, "บอส", [ME, "บอส"], "b")])).toEqual([])
  })

  it("uses at most people − 1 transfers", () => {
    const bills = [
      bill(1234.57, ME, ALL, "a"),
      bill(333.33, "บอส", [ME, "บอส", "แพร"], "b"),
      bill(99.99, "แพร", ["มิ้นท์", "แพร"], "c"),
      bill(710, "มิ้นท์", ALL, "d"),
    ]
    const t = settleUp(bills)
    expect(t.length).toBeLessThanOrEqual(3)
    // Every transfer is in whole satang and they clear every balance.
    const net = tripBalances(bills)
    for (const x of t) {
      expect(Math.round(x.amount * 100)).toBe(x.amount * 100)
      net.set(x.from, net.get(x.from)! + Math.round(x.amount * 100))
      net.set(x.to, net.get(x.to)! - Math.round(x.amount * 100))
    }
    expect([...net.values()].every((v) => v === 0)).toBe(true)
  })

  it("ignores bills nobody shares", () => {
    expect(settleUp([bill(500, ME, [])])).toEqual([])
  })
})
