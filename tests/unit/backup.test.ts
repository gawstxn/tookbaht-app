import { describe, expect, it } from "vitest"
import { BackupError, backupFileName, makeBackup, parseBackup, type BackupData } from "@/lib/backup"

const data: BackupData = {
  accounts: [
    { id: "a1", name: "เงินเดือน", kind: "bank", openingBalance: 1000, mono: "ง", tone: "#2f5b45", fxFeePct: 0 },
  ],
  transactions: [
    {
      id: "t1",
      type: "out",
      amount: 65,
      date: "2026-09-02",
      title: "ข้าว",
      category: "food",
      accountId: "a1",
      createdAt: 1,
    },
    { id: "t2", type: "move", amount: 500, date: "2026-09-03", title: "", fromId: "a1", toId: "a1b", createdAt: 2 },
  ],
  subscriptions: [
    {
      id: "s1",
      kind: "subscription",
      entryType: "out",
      name: "Netflix",
      amount: 419,
      currency: "THB",
      cycle: "month",
      startDate: "2026-08-06",
      accountId: "a1",
      category: "fun",
      remind: true,
      autoLog: true,
      paused: false,
      tone: "#000",
    },
  ],
  ious: [
    {
      id: "i1",
      person: "บอส",
      amount: 300,
      note: "หมูกระทะ",
      date: "2026-09-02",
      transactionId: "t1",
      settledOn: null,
      createdAt: 3,
    },
  ],
  savingsGoals: [
    {
      id: "g1",
      name: "เที่ยวญี่ปุ่น",
      target: 40000,
      saved: 5000,
      deadline: "2027-03-31",
      accountId: null,
      tone: "#33558f",
    },
  ],
  wishes: [
    {
      id: "w1",
      name: "หูฟัง",
      price: 3990,
      note: "",
      decideOn: "2026-10-06",
      status: "skipped",
      decidedOn: "2026-10-06",
      transactionId: null,
      createdAt: 5,
    },
  ],
  goals: { incomeTarget: 50000, expenseBudget: 30000, categoryBudgets: { food: 8000 }, alertAt80: true },
  settings: { faceLock: false },
}
const file = (patch: object = {}) => JSON.stringify({ ...makeBackup(data, new Date("2026-09-25T10:00:00Z")), ...patch })
const problem = (text: string) => {
  try {
    parseBackup(text)
  } catch (e) {
    return e instanceof BackupError ? e.problem : "other"
  }
  return null
}

describe("backup files", () => {
  it("round-trips the user's data", () => {
    expect(parseBackup(file())).toEqual(data)
  })

  it("reads files made before debts and savings goals existed", () => {
    const old = JSON.parse(file())
    delete old.ious
    delete old.savingsGoals
    delete old.wishes
    expect(parseBackup(JSON.stringify(old))).toMatchObject({ ious: [], savingsGoals: [], wishes: [] })
  })

  it("rejects a damaged debt or goal", () => {
    expect(problem(file({ ious: [{ id: "i", person: "", amount: 1, date: "2026-09-02" }] }))).toBe("damaged")
    expect(problem(file({ savingsGoals: [{ id: "g", name: "x", target: 0, saved: 0 }] }))).toBe("damaged")
    expect(problem(file({ wishes: [{ id: "w", name: "x", price: 1, status: "maybe", decideOn: "2026-10-06" }] }))).toBe(
      "damaged",
    )
  })

  it("names the file by date", () => {
    expect(backupFileName(new Date("2026-09-25T10:00:00Z"))).toBe("tookbaht-backup-2026-09-25.json")
  })

  it("fills fields added after older backups were made", () => {
    const old = JSON.parse(file())
    delete old.accounts[0].fxFeePct
    delete old.subscriptions[0].currency
    delete old.subscriptions[0].kind
    delete old.subscriptions[0].entryType
    const parsed = parseBackup(JSON.stringify(old))
    expect(parsed.accounts[0].fxFeePct).toBe(0)
    expect(parsed.subscriptions[0]).toMatchObject({ currency: "THB", kind: "subscription", entryType: "out" })
  })

  it("rejects files that aren't Tookbaht backups", () => {
    expect(problem("not json")).toBe("json")
    expect(problem(JSON.stringify({ accounts: [] }))).toBe("format")
    expect(problem(file({ app: "other" }))).toBe("format")
    expect(problem(file({ accounts: [] }))).toBe("format")
  })

  it("rejects backups from a newer version of the app", () => {
    expect(problem(file({ version: 99 }))).toBe("newer")
  })

  it("rejects the whole file when any row is damaged", () => {
    expect(problem(file({ transactions: [{ ...data.transactions[0], amount: -5 }] }))).toBe("damaged")
    expect(problem(file({ transactions: [{ ...data.transactions[0], date: "25/09/2026" }] }))).toBe("damaged")
    expect(problem(file({ subscriptions: [{ ...data.subscriptions[0], cycle: "daily" }] }))).toBe("damaged")
  })
})
