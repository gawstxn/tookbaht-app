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
