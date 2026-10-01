/*
 * Pull the useful fields out of a Thai bank transfer slip's text (as read by
 * on-device OCR). Slips differ between banks and OCR drops or swaps
 * characters, so every field is a best guess the user checks before saving.
 */

import type { Transaction } from "./types"

export interface SlipFields {
  amount?: number
  /** YYYY-MM-DD */
  date?: string
  /** Who received the money (a person, shop or company). */
  receiver?: string
  /** The memo typed on the transfer ("บันทึกช่วยจำ"). */
  memo?: string
}

const THAI_MONTHS: [string, number][] = [
  ["มกราคม", 1],
  ["กุมภาพันธ์", 2],
  ["มีนาคม", 3],
  ["เมษายน", 4],
  ["พฤษภาคม", 5],
  ["มิถุนายน", 6],
  ["กรกฎาคม", 7],
  ["สิงหาคม", 8],
  ["กันยายน", 9],
  ["ตุลาคม", 10],
  ["พฤศจิกายน", 11],
  ["ธันวาคม", 12],
  ["มค", 1],
  ["กพ", 2],
  ["มีค", 3],
  ["เมย", 4],
  ["พค", 5],
  ["มิย", 6],
  ["กค", 7],
  ["สค", 8],
  ["กย", 9],
  ["ตค", 10],
  ["พย", 11],
  ["ธค", 12],
]
const EN_MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]

const pad = (n: number) => String(n).padStart(2, "0")
/** Dots, commas, below-vowels (ุ ู ฺ) and quote marks OCR scatters through abbreviations. */
const MANGLED = /[.,'`\u0e38\u0e39\u0e3a]/g

/** 69 → 2026, 2569 → 2026, 2026 → 2026. */
function toYear(raw: string, today: string): number | null {
  let y = Number(raw)
  if (raw.length <= 2) {
    // Two digits are the Buddhist Era year on Thai slips ("69" = 2569); fall back to CE if that's implausible.
    const be = 2500 + y - 543
    const ce = 2000 + y
    const now = Number(today.slice(0, 4))
    y = Math.abs(be - now) <= Math.abs(ce - now) ? be : ce
  } else if (y > 2400) y -= 543
  return y >= 2000 && y <= 2100 ? y : null
}

function validDate(y: number, m: number, d: number): string | undefined {
  const dt = new Date(y, m - 1, d)
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d
    ? `${y}-${pad(m)}-${pad(d)}`
    : undefined
}

/** The first date on the slip: "26 ก.ย. 69", "26 กันยายน 2569", "26 Sep 2026" or "26/09/2026". */
export function findDate(text: string, today: string): string | undefined {
  // Thai month names. OCR mangles the dots in "ก.ย." (dropped, or read as a
  // below-vowel: "กุย."), so compare with dots, below-vowels and marks removed.
  const squashed = text.replace(MANGLED, "")
  for (const m of squashed.matchAll(/(\d{1,2})\s*([\u0e01-\u0e4e]{2,9})\s*(\d{2,4})/g)) {
    const month = THAI_MONTHS.find(([name]) => m[2].startsWith(name.replace(MANGLED, "")))?.[1]
    const y = toYear(m[3], today)
    if (month && y) {
      const d = validDate(y, month, Number(m[1]))
      if (d) return d
    }
  }
  for (const m of text.matchAll(/(\d{1,2})\s+([A-Za-z]{3})[a-z]*\.?\s+(\d{2,4})/g)) {
    const month = EN_MONTHS.indexOf(m[2].toLowerCase()) + 1
    const y = toYear(m[3], today)
    if (month && y) {
      const d = validDate(y, month, Number(m[1]))
      if (d) return d
    }
  }
  for (const m of text.matchAll(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/g)) {
    const y = toYear(m[3], today)
    if (y) {
      const d = validDate(y, Number(m[2]), Number(m[1]))
      if (d) return d
    }
  }
  return undefined
}

const MONEY = /(\d{1,3}(?:[,\s]\d{3})+|\d+)[.,](\d{2})(?!\d)/g
const toNumber = (int: string, dec: string) => Number(`${int.replace(/[,\s]/g, "")}.${dec}`)

/**
 * The amount transferred: a number with satang on the line that says so
 * ("จำนวน", "Amount") or ends in "บาท"; fees are skipped.
 */
export function findAmount(text: string): number | undefined {
  let best: { score: number; value: number } | undefined
  const lines = text.split(/\n/)
  lines.forEach((line, i) => {
    const context = `${lines[i - 1] ?? ""} ${line}`
    if (/ค่าธรรมเนียม|fee/i.test(line)) return
    for (const m of line.matchAll(MONEY)) {
      const value = toNumber(m[1], m[2])
      if (!(value > 0) || value > 10_000_000) continue
      let score = 0
      if (/จำนวน|ยอด|amount|total/i.test(context)) score += 3
      if (/บาท|thb|฿/i.test(line)) score += 2
      if (!best || score > best.score || (score === best.score && value > best.value)) best = { score, value }
    }
  })
  return best?.value
}

const NAME = /^(นาย|นาง|น\.ส\.|นางสาว|ด\.?[ชญ]\.?|บจก|บริษัท|บมจ|หจก|ร้าน|mr\.?|mrs\.?|ms\.?|miss)\s*/i

/** Receiver: the line after "ไปยัง" / "ผู้รับ" / "To", else the second name on the slip (the first is the sender). */
export function findReceiver(text: string): string | undefined {
  const lines = text
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  // \b doesn't work after Thai letters, so look for a colon, a space or the end instead.
  const to = lines.findIndex((l) => /^(ไปยัง|ถึง|ผู้รับ|to)(?=[:\s]|$)/i.test(l))
  if (to !== -1) {
    const rest = lines[to].replace(/^(ไปยัง|ถึง|ผู้รับ|to)[:\s]*/i, "").trim()
    if (rest) return clean(rest)
    if (lines[to + 1]) return clean(lines[to + 1])
  }
  // With only one name it's usually the payer (e.g. paying a shop by QR), so don't guess.
  const names = lines.filter((l) => NAME.test(l))
  return names.length >= 2 ? clean(names[1]) : undefined
}

/** The memo ("บันทึกช่วยจำ: ค่าข้าว"). */
export function findMemo(text: string): string | undefined {
  const m = text.match(/(?:บันทึกช่วยจำ|บันทึก|memo|note)\s*[:：]?\s*(.+)/i)
  const memo = m?.[1]?.trim()
  return memo ? clean(memo) : undefined
}

const clean = (s: string) =>
  s
    .replace(/\s{2,}/g, " ")
    .replace(/[|_]+/g, "")
    .trim()
    .slice(0, 60)

/**
 * OCR often writes "ำ" as nikhahit + sara aa; put it back so words match, and
 * read Thai digits (๐–๙) as 0–9.
 */
const normalize = (text: string) =>
  text
    .normalize("NFC")
    .replace(/\u0e4d\u0e32/g, "\u0e33")
    .replace(/[\u0e50-\u0e59]/g, (d) => String(d.charCodeAt(0) - 0x0e50))

/** Everything we can find; `today` bounds two-digit years and future dates. */
export function parseSlip(raw: string, today: string): SlipFields {
  const text = normalize(raw)
  const date = findDate(text, today)
  return {
    amount: findAmount(text),
    date: date && date <= today ? date : undefined,
    receiver: findReceiver(text),
    memo: findMemo(text),
  }
}

/** An expense with the slip's amount on the slip's date is already logged (the slip was likely entered before). */
export function slipLogged(txs: Pick<Transaction, "type" | "amount" | "date">[], slip: SlipFields): boolean {
  return (
    !!slip.amount &&
    !!slip.date &&
    txs.some((t) => t.type === "out" && t.amount === slip.amount && t.date === slip.date)
  )
}
