import { addDays } from "./format"
import type { Transaction, TxType } from "./types"

/**
 * One typed line → an entry: "ข้าวมันไก่ 50", "grab 120 เมื่อวาน",
 * "+เงินเดือน 30000". Runs on the device; the category and account come from
 * the user's own past entries with the same name, else from common words.
 */
export interface QuickText {
  type: Extract<TxType, "in" | "out">
  amount?: number
  title: string
  date: string
  category?: string
  accountId?: string
}

const DAYS: [RegExp, number][] = [
  [/เมื่อวานซืน|day before yesterday/i, -2],
  [/เมื่อวาน|วานนี้|yesterday/i, -1],
  [/วันนี้|today/i, 0],
]

/** Last number in the line (with "," or "k" / "พัน"); the one after a name is usually the price. */
const AMOUNT = /฿?\s*(\d[\d,]*(?:\.\d{1,2})?)\s*(k|พัน)?\s*(?:บาท|baht|฿)?/gi

/** Common words per built-in category, for names the user hasn't logged before. */
const WORDS: [string, RegExp][] = [
  ["bill", /ค่าไฟ|ค่าน้ำ|ค่าเน็ต|ค่าโทร|ค่าเช่า|ค่าหอ|ค่าห้อง|อินเทอร์เน็ต|internet|rent|electric|ค่าส่วนกลาง/i],
  [
    "food",
    /ข้าว|กาแฟ|ชา|ก๋วยเตี๋ยว|อาหาร|ขนม|ชาบู|หมูกระทะ|ส้มตำ|บุฟเฟ่ต์|บุฟเฟต์|น้ำ(?!มัน)|ผลไม้|เบเกอรี่|pizza|coffee|lunch|dinner|breakfast|food|cafe|starbucks|kfc|mcdonald|grabfood|lineman|foodpanda|7-?11|เซเว่น/i,
  ],
  [
    "travel",
    /grab(?!food)|bolt|taxi|แท็กซี่|วิน|มอเตอร์ไซค์|bts|mrt|รถไฟ|รถเมล์|รถตู้|น้ำมัน|ทางด่วน|ที่จอดรถ|parking|เครื่องบิน|ตั๋ว|flight|train|bus/i,
  ],
  [
    "shop",
    /shopee|lazada|tiktok shop|เสื้อ|กางเกง|รองเท้า|กระเป๋า|ช้อป|ของใช้|uniqlo|ikea|big ?c|lotus|โลตัส|แม็คโคร|makro/i,
  ],
  ["health", /ยา|หมอ|คลินิก|โรงพยาบาล|ทำฟัน|หาหมอ|pharmacy|clinic|hospital|dentist|fitness|ฟิตเนส|วิตามิน/i],
  ["fun", /หนัง|ดูหนัง|คอนเสิร์ต|เกม|คาราโอเกะ|เที่ยว|movie|cinema|concert|game|steam|bar|บาร์/i],
]
const INCOME_WORDS: [string, RegExp][] = [
  ["salary", /เงินเดือน|salary/i],
  ["freelance", /ฟรีแลนซ์|freelance|ค่าจ้าง/i],
  ["interest", /ดอกเบี้ย|interest|ปันผล|dividend/i],
  ["gift", /อั่งเปา|ของขวัญ|gift/i],
]

const norm = (s: string) => s.trim().toLocaleLowerCase().replace(/\s+/g, " ")

export function parseQuickText(raw: string, today: string, history: Transaction[] = []): QuickText {
  let s = raw.trim()
  let type: QuickText["type"] = "out"
  if (s.startsWith("+")) {
    type = "in"
    s = s.slice(1)
  }
  let date = today
  for (const [re, days] of DAYS) {
    if (re.test(s)) {
      date = addDays(today, days)
      s = s.replace(re, " ")
      break
    }
  }
  let amount: number | undefined
  const matches = [...s.matchAll(AMOUNT)]
  const last = matches[matches.length - 1]
  if (last) {
    const n = parseFloat(last[1].replace(/,/g, "")) * (last[2] ? 1000 : 1)
    if (n > 0) {
      amount = Math.round(n * 100) / 100
      s = s.slice(0, last.index) + " " + s.slice(last.index! + last[0].length)
    }
  }
  const title = s.replace(/\s+/g, " ").trim()
  const key = norm(title)
  // "เงินเดือน 30000" is income even without the "+".
  if (/เงินเดือน|salary/i.test(title)) type = "in"

  // The user's own habit first: the latest entry with this name (or one that contains it).
  const past = history
    .filter((t) => t.type === type && !t.subscriptionId && t.category)
    .sort((a, b) => b.createdAt - a.createdAt)
  const name = (t: Transaction) => norm(t.note || t.title)
  const same = key ? past.find((t) => name(t) === key || norm(t.title) === key) : undefined
  const near =
    !same && key.length >= 2
      ? past.find((t) => name(t).length >= 2 && (name(t).includes(key) || key.includes(name(t))))
      : undefined
  const hit = same ?? near
  const words = type === "in" ? INCOME_WORDS : WORDS
  const category = hit?.category ?? words.find(([, re]) => re.test(title))?.[0]
  return { type, amount, title, date, category, accountId: hit?.accountId }
}
