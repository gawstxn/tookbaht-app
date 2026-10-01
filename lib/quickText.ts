import { addDays } from "./format"
import type { Transaction, TxType } from "./types"

/**
 * One typed line → an entry: "ข้าวมันไก่ 50", "grab 120 เมื่อวาน",
 * "+เงินเดือน 30000", "ค่าข้าว 50 เงินสด". Runs on the device; the account
 * comes from the line when it names one, and otherwise, like the category, from
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
  ["salary", /เงินเดือน|salary|โบนัส|bonus/i],
  ["freelance", /ฟรีแลนซ์|freelance|ค่าจ้าง/i],
  ["sell", /ขาย|sold/i],
  ["interest", /ดอกเบี้ย|interest|ปันผล|dividend/i],
  ["gift", /อั่งเปา|ของขวัญ|gift/i],
  ["repay", /คืน|refund|cashback|แคชแบ็ก/i],
]

/** Names that are money coming in even without the "+": "ขายของ 500", "ได้โบนัส 3000". */
const INCOME_START =
  /^(?:ได้|รับเงิน|รับค่า|ขาย|โบนัส|ปันผล|รายได้|ถูกหวย|ถูกรางวัล|เงินคืน|แคชแบ็ก|cashback|refund|bonus|sold|income)/i
/** Someone paid the user back: "เพื่อนคืนเงิน 200", "แม่คืน 500" (not "2 คืน", nights). */
const PAID_BACK = /[^\d\s]คืน(?:เงิน)?(?=\s|$|ให้|มา)/
const NIGHT = /(?:ค้าง|กลาง|ทั้ง|ข้าม|เมื่อ|ต่อ)คืน/
/** Names that are spending whatever else they contain: "จ่ายคืนเพื่อน 200", "โอนให้แม่ 500". */
const SPENT_START = /^(?:จ่าย|ใช้|ซื้อ|คืน|โอน)/

/** Words that introduce the account in a line: "ค่าข้าว 50 จ่ายด้วยเงินสด". */
const ACCOUNT_MARK = /(?:^|\s)(?:จ่ายด้วย|จ่ายผ่าน|ด้วย|จาก|ผ่าน|เข้า|with|by|from|via|into)\s*(\S.*)$/i

const norm = (s: string) => s.trim().toLocaleLowerCase().replace(/\s+/g, " ")

/**
 * The account a line names, and the name left without it: after a word like
 * "ด้วย" / "จาก", or as the last words of the line ("ค่าข้าว 50 เงินสด").
 * Something must be left to name the entry, so "เงินเดือน 30000" stays a name.
 */
function namedAccount(
  title: string,
  accounts: { id: string; name: string }[],
): { accountId: string; title: string } | undefined {
  if (!accounts.length) return undefined
  const marked = ACCOUNT_MARK.exec(title)
  if (marked) {
    const accountId = findAccount(marked[1], accounts)
    const rest = title.slice(0, marked.index).trim()
    if (accountId && rest) return { accountId, title: rest }
  }
  const names = accounts.map((a) => ({ id: a.id, name: squash(a.name) }))
  const words = title.split(" ")
  for (let n = Math.min(3, words.length - 1); n >= 1; n--) {
    const tail = squash(words.slice(-n).join(""))
    if (tail.length < 3) continue
    const hit =
      names.find((a) => a.name === tail) ??
      names.find((a) => a.name.startsWith(tail)) ??
      names.find((a) => a.name.includes(tail))
    if (hit) return { accountId: hit.id, title: words.slice(0, -n).join(" ") }
  }
  return undefined
}

export function parseQuickText(
  raw: string,
  today: string,
  history: Transaction[] = [],
  accounts: { id: string; name: string }[] = [],
): QuickText {
  let s = raw.trim()
  // "+" and "-" settle the type; otherwise the name decides.
  const sign = s[0] === "+" || s[0] === "-" ? s[0] : ""
  if (sign) s = s.slice(1)
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
  const named = namedAccount(s.replace(/\s+/g, " ").trim(), accounts)
  const title = named?.title ?? s.replace(/\s+/g, " ").trim()
  const key = norm(title)
  const income =
    /เงินเดือน|salary/i.test(title) ||
    (!SPENT_START.test(title) && (INCOME_START.test(title) || (PAID_BACK.test(title) && !NIGHT.test(title))))
  const type: QuickText["type"] = sign === "+" || (!sign && income) ? "in" : "out"

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
  return { type, amount, title, date, category, accountId: named?.accountId ?? hit?.accountId }
}

/* ---------- several entries in one message ---------- */

/** A token that is a price on its own: "50", "1,500", "85.50", "2k", "120บาท". */
const PRICE = /^฿?\d[\d,]*(?:\.\d{1,2})?(?:k|พัน|บาท|baht|฿)?$/i
/** After a number these make it a quantity, a size or a model, not a price: "ข้าว 2 จาน 120". */
const UNIT =
  /^(?:บาท|baht|k|พัน|จาน|แก้ว|ชิ้น|อัน|ขวด|กล่อง|ถุง|คน|ที่|ชุด|ตัว|ใบ|ลูก|แพ็ค|แพค|ห่อ|ซอง|กระป๋อง|ถ้วย|ชาม|ไม้|คู่|เล่ม|ม้วน|เม็ด|แผ่น|ก้อน|โหล|กิโล|กก\.?|ลิตร|ขีด|เดือน|วัน|ชั่วโมง|ชม\.?|คืน|ครั้ง|รอบ|เที่ยว|นิ้ว|x|pcs?|kg|g|ml|l|gb|tb|inch|pro|max|plus|mini|ultra)$/i

/**
 * The entries in one message: one per line or comma, and "ค่าข้าว 50 กาแฟ 65"
 * is two (a name and its price, then the next name). A day word applies to all
 * of them. Transfers are never cut up.
 */
export function splitQuickText(raw: string, max = 10): string[] {
  const out: string[] = []
  // A comma inside a number ("6,500") isn't a separator.
  for (const part of raw.split(/\n+|;|,(?!\d{3}(?!\d))/)) {
    const line = part.trim()
    if (!line) continue
    if (TRANSFER.test(line)) {
      out.push(line)
      continue
    }
    let day = ""
    let body = line
    for (const [re] of DAYS) {
      const m = re.exec(body)
      if (m) {
        day = m[0]
        body = body.replace(re, " ")
        break
      }
    }
    const tokens = body.split(/\s+/).filter(Boolean)
    const price = tokens.map((tok) => PRICE.test(tok))
    const groups: string[][] = []
    let group: string[] = []
    let hasName = false
    tokens.forEach((tok, i) => {
      group.push(tok)
      if (!price[i]) {
        hasName = true
        return
      }
      const next = tokens[i + 1]
      // Another name with its own price follows: this entry ends here.
      if (hasName && next !== undefined && !price[i + 1] && !UNIT.test(next) && price.slice(i + 1).some(Boolean)) {
        groups.push(group)
        group = []
        hasName = false
      }
    })
    if (group.length) groups.push(group)
    if (groups.length <= 1) out.push(line)
    else for (const g of groups) out.push(day ? `${g.join(" ")} ${day}` : g.join(" "))
  }
  return out.slice(0, max)
}

/**
 * What a typed line saves as. A category or account the line didn't settle
 * (or that no longer exists) falls back to the user's usual one; null when
 * there's no amount to save.
 */
export function quickTextEntry(
  q: QuickText,
  known: { categories: { key: string; label: string }[]; accountIds: string[] },
  fallback: { category: string; accountId: string },
): Omit<Transaction, "id" | "createdAt"> | null {
  const accountId = q.accountId && known.accountIds.includes(q.accountId) ? q.accountId : fallback.accountId
  if (!q.amount || !accountId) return null
  const category = known.categories.some((c) => c.key === q.category) ? q.category! : fallback.category
  const label = known.categories.find((c) => c.key === category)?.label ?? ""
  return {
    type: q.type,
    amount: q.amount,
    date: q.date,
    title: q.title || label,
    note: q.title || undefined,
    category,
    accountId,
  }
}

/* ---------- transfers ---------- */

/**
 * A typed transfer: "โอน 500 ไป ออมทรัพย์", "โอน 500 จาก กสิกร ไป ออมทรัพย์",
 * "transfer 500 to savings". Accounts are found by name, part of a name is
 * enough. `fromGiven` / `toGiven` say the line named that side, whether or not
 * an account matched.
 */
export interface TransferText {
  amount?: number
  date: string
  fromId?: string
  toId?: string
  fromGiven: boolean
  toGiven: boolean
}

const TRANSFER = /^\s*(?:โอนเงิน|โอน|(?:transfer|move)\b)\s*/i
/** Paying someone, not moving money between the user's accounts: "โอนให้แม่ 500", "โอนค่าเช่า 6000". */
const PAYMENT = /^\s*โอน(?:เงิน)?\s*(?:ให้|ค่า|จ่าย|คืน)/
const FROM = /จาก|\bfrom\b/i
const TO = /ไปยัง|ไปที่|ไป|เข้า|->|→|\bto\b/i

const squash = (s: string) => s.toLocaleLowerCase().replace(/\s+/g, "")

/** The account the words name: its exact name first, then one that starts with or contains them. */
function findAccount(text: string, accounts: { id: string; name: string }[]): string | undefined {
  const q = squash(text)
  if (!q) return undefined
  const names = accounts.map((a) => ({ id: a.id, name: squash(a.name) }))
  return (
    names.find((a) => a.name === q) ??
    names.find((a) => a.name.startsWith(q)) ??
    names.find((a) => a.name.includes(q)) ??
    names.find((a) => a.name.length >= 2 && q.includes(a.name))
  )?.id
}

/** Reads a line that starts with "โอน" / "transfer"; null for any other line. */
export function parseTransferText(
  raw: string,
  today: string,
  accounts: { id: string; name: string }[],
): TransferText | null {
  if (!TRANSFER.test(raw) || PAYMENT.test(raw)) return null
  let s = raw.replace(TRANSFER, "")
  let date = today
  for (const [re, days] of DAYS) {
    if (re.test(s)) {
      date = addDays(today, days)
      s = s.replace(re, " ")
      break
    }
  }
  const from = FROM.exec(s)
  const to = TO.exec(s)
  const marks = [from, to].filter((m): m is RegExpExecArray => !!m).sort((a, b) => a.index - b.index)
  // Text after a marker, up to the next marker.
  const after = (m: RegExpExecArray | null) => {
    if (!m) return ""
    const next = marks.find((x) => x.index > m.index)
    return s.slice(m.index + m[0].length, next?.index)
  }
  let head = s.slice(0, marks[0]?.index)
  let fromText = after(from)
  // With no "ไป" / "จาก", what follows the amount is where the money goes: "โอน 500 ออมทรัพย์".
  let toText = after(to)

  // The amount usually comes right after "โอน"; otherwise it's the last number in the line.
  let amount: number | undefined
  const take = (text: string, last: boolean): string => {
    const matches = [...text.matchAll(AMOUNT)]
    const m = last ? matches[matches.length - 1] : matches[0]
    if (!m || amount !== undefined) return text
    const n = parseFloat(m[1].replace(/,/g, "")) * (m[2] ? 1000 : 1)
    if (!(n > 0)) return text
    amount = Math.round(n * 100) / 100
    return text.slice(0, m.index) + " " + text.slice(m.index! + m[0].length)
  }
  head = take(head, false)
  toText = take(toText, true)
  fromText = take(fromText, true)
  if (!marks.length) toText = head

  return {
    amount,
    date,
    fromId: findAccount(fromText, accounts),
    toId: findAccount(toText, accounts),
    fromGiven: !!squash(fromText),
    toGiven: !!squash(toText),
  }
}

/**
 * The two accounts a typed transfer moves money between, or what's wrong with
 * it. A side the line didn't name comes from the user's usual transfer, then
 * (for the source) any other account. A side it named but that matches no
 * account is an error: nothing is guessed.
 */
export function transferRoute(
  q: Pick<TransferText, "fromId" | "toId" | "fromGiven" | "toGiven">,
  usual: { fromId?: string; toId?: string },
  accountIds: string[],
): { fromId: string; toId: string } | "to" | "from" | "same" {
  if (q.toGiven && !q.toId) return "to"
  if (q.fromGiven && !q.fromId) return "from"
  const known = (id?: string): id is string => !!id && accountIds.includes(id)
  if (q.fromId && q.fromId === q.toId) return "same"
  const toId = q.toId ?? (known(usual.toId) && usual.toId !== q.fromId ? usual.toId : undefined)
  if (!toId) return "to"
  const fromId =
    q.fromId ?? (known(usual.fromId) && usual.fromId !== toId ? usual.fromId : accountIds.find((id) => id !== toId))
  if (!fromId) return "from"
  return { fromId, toId }
}
