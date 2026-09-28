import { formatMoney } from "./fx";
import en from "./locales/en";
import th from "./locales/th";
import { baht } from "./money";

export type Lang = "th" | "en";

export interface PendingReminder {
  subscription_id: string;
  user_id: string;
  name: string;
  amount: number | string;
  currency: "THB" | "USD";
  due_date: string;
  account_name: string;
  kind: "subscription" | "recurring";
  installment_no: number;
  installments: number | null;
}
export interface PendingDue {
  account_id: string;
  user_id: string;
  name: string;
  owed: number | string;
  due_date: string;
}
export interface PendingBudget {
  user_id: string;
  month: string;
  budget_key: string;
  level: 80 | 100;
  spent: number | string;
  budget: number | string;
}
export interface PendingSummary {
  user_id: string;
  month: string;
  income: number | string;
  expense: number | string;
  over_budget: string[];
}
/* Push text in the user's language (the cron route has no i18n instance). */

export function chargeText(lang: Lang, r: PendingReminder) {
  const amount = formatMoney(Number(r.amount), r.currency ?? "THB");
  const plan = r.installments ? (lang === "en" ? ` (${r.installment_no} of ${r.installments})` : ` (งวด ${r.installment_no}/${r.installments})`) : "";
  if (r.kind === "recurring") {
    return lang === "en"
      ? { title: `${r.name}${plan} is due tomorrow`, body: `${amount} from ${r.account_name}` }
      : { title: `${r.name}${plan} ถึงกำหนดพรุ่งนี้`, body: `${amount} จาก${r.account_name}` };
  }
  return lang === "en"
    ? { title: `${r.name} bills tomorrow`, body: `${amount} from ${r.account_name}` }
    : { title: `${r.name} ตัดบัญชีพรุ่งนี้`, body: `${amount} จาก${r.account_name}` };
}

export function dueText(lang: Lang, r: PendingDue) {
  const owed = baht(Number(r.owed));
  return lang === "en" ? { title: `${r.name} payment is due tomorrow`, body: `Owed ${owed}` } : { title: `ครบกำหนดชำระ ${r.name} พรุ่งนี้`, body: `ยอดค้างจ่าย ${owed}` };
}

const MONTHS = {
  th: ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
};

/** Last month in one notification: in, out, what was left, and budgets that went over. */
export function summaryText(lang: Lang, r: PendingSummary) {
  const month = MONTHS[lang][Number(r.month.slice(5, 7)) - 1];
  const income = Number(r.income);
  const expense = Number(r.expense);
  const left = income - expense;
  const leftText = (left < 0 ? "−" : "") + baht(Math.abs(left));
  const cats = (lang === "en" ? en.cat : th.cat) as Record<string, string>;
  const over = r.over_budget.map((k) => cats[k] ?? k);
  if (lang === "en") {
    const body = `In ${baht(income)} · Out ${baht(expense)} · ${left < 0 ? "Short" : "Saved"} ${leftText}`;
    return { title: `Your ${month} summary`, body: over.length ? `${body}\nOver budget: ${over.join(", ")}` : body };
  }
  const body = `รับ ${baht(income)} · จ่าย ${baht(expense)} · ${left < 0 ? "ขาด" : "เหลือเก็บ"} ${leftText}`;
  return { title: `สรุปเดือน${month}`, body: over.length ? `${body}\nเกินงบ: ${over.join(", ")}` : body };
}

/** Where the user's streak stands for the evening nudge (see pending_log_reminders). */
export type StreakState = "keep" | "restore" | null;

/**
 * Evening nudge when nothing was logged today: keep a running streak, restore
 * a missed day, or (no streak yet) start one. Opens the add screen, or the
 * streak screen to restore.
 */
export function logReminderText(lang: Lang, streak = 0, state: StreakState = null) {
  const en = lang === "en";
  if (state === "keep") {
    return en
      ? { title: `${streak}-day streak`, body: "Log something today, or confirm you spent nothing, to keep it going", url: "/add" }
      : { title: `จดต่อเนื่องมา ${streak} วันแล้ว`, body: "จดสักรายการวันนี้ หรือกดยืนยันว่าไม่ได้ใช้เงิน เพื่อไม่ให้ขาด", url: "/add" };
  }
  if (state === "restore") {
    return en
      ? { title: "You missed a day", body: `Go back and log it to keep your ${streak}-day streak`, url: "/streak" }
      : { title: "มีวันที่ลืมจด", body: `ย้อนไปจดเพื่อรักษาความต่อเนื่อง ${streak} วันไว้`, url: "/streak" };
  }
  return en
    ? { title: "Anything to log today?", body: "Log today's spending and start a streak", url: "/add" }
    : { title: "วันนี้จดรายการหรือยัง?", body: "จดรายจ่ายของวันนี้ แล้วเริ่มนับวันจดต่อเนื่อง", url: "/add" };
}

export function budgetText(lang: Lang, r: PendingBudget) {
  const cats = (lang === "en" ? en.cat : th.cat) as Record<string, string>;
  const label = r.budget_key === "total" ? (lang === "en" ? "Overall budget" : "งบรวม") : (cats[r.budget_key] ?? r.budget_key);
  const spent = baht(Number(r.spent));
  const budget = baht(Number(r.budget));
  if (r.level === 100) {
    const over = baht(Number(r.spent) - Number(r.budget));
    return lang === "en" ? { title: `${label} is over by ${over}`, body: `Spent ${spent} of ${budget}` } : { title: `${label} เกินงบแล้ว ${over}`, body: `ใช้ไป ${spent} จากงบ ${budget}` };
  }
  const pct = Math.round((Number(r.spent) / Number(r.budget)) * 100);
  return lang === "en" ? { title: `${label} at ${pct}% of budget`, body: `Spent ${spent} of ${budget}` } : { title: `${label} ใช้ไปแล้ว ${pct}% ของงบ`, body: `ใช้ไป ${spent} จากงบ ${budget}` };
}
