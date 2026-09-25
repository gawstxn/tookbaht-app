import { categoryLabel } from "./constants";
import { baht } from "./format";
import { daysLeftInMonth, spendByCategory, summarize } from "./selectors";
import type { Goals, Transaction } from "./types";

export interface BudgetLine {
  key: string;
  label: string;
  budget: number;
  spent: number;
  pct: number;
}

/** Category budgets (plus the overall budget as "งบรวม") with this month's spend. */
export function budgetLines(goals: Goals, monthTxs: Transaction[]) {
  const spent = spendByCategory(monthTxs);
  const cats: BudgetLine[] = Object.entries(goals.categoryBudgets)
    .filter(([, b]) => b > 0)
    .map(([key, budget]) => ({ key, label: categoryLabel(key), budget, spent: spent[key] ?? 0, pct: (spent[key] ?? 0) / budget }));
  const expense = summarize(monthTxs).expense;
  const total: BudgetLine | null = goals.expenseBudget > 0
    ? { key: "total", label: "งบรวม", budget: goals.expenseBudget, spent: expense, pct: expense / goals.expenseBudget }
    : null;
  return { cats, total };
}

export type BannerTone = "critical" | "danger" | "warn" | "ok" | "setup";

export interface BudgetBanner {
  tone: BannerTone;
  title: string;
  /** Amount shown after the title in the tone colour. */
  amount?: string;
  detail: string;
  /** Number of categories needing attention. */
  count?: number;
}

const pct = (l: BudgetLine) => `${Math.round(l.pct * 100)}%`;

/**
 * One-line budget status for the overview, most urgent first:
 * total over → several over → one over (+ near) → several near → one near → on plan → no budget.
 */
export function budgetBanner(goals: Goals, monthTxs: Transaction[], month: string, today: string): BudgetBanner {
  const { cats, total } = budgetLines(goals, monthTxs);
  if (!total && !cats.length) {
    return { tone: "setup", title: "ตั้งงบรายเดือน", detail: "รู้ทันทีเมื่อใช้ใกล้เกินงบ" };
  }
  const over = cats.filter((c) => c.spent > c.budget).sort((a, b) => b.spent - b.budget - (a.spent - a.budget));
  const near = cats.filter((c) => c.pct >= 0.8 && c.spent <= c.budget).sort((a, b) => b.pct - a.pct);
  const daysLeft = daysLeftInMonth(month, today);

  if (total && total.spent > total.budget) {
    return {
      tone: "critical",
      title: "เกินงบรวมแล้ว",
      amount: baht(total.spent - total.budget),
      detail: over.length ? `เกินใน ${over.length} หมวด · ${over[0].label}เกินมากสุด` : "ดูงบทุกหมวด",
      count: over.length || undefined,
    };
  }
  if (over.length >= 2) {
    const shown = over.slice(0, 2).map((c) => `${c.label} ${baht(c.spent - c.budget)}`);
    return {
      tone: "danger",
      title: `เกินงบ ${over.length} หมวด`,
      amount: baht(over.reduce((a, c) => a + c.spent - c.budget, 0)),
      detail: [...shown, ...(over.length > 2 ? [`+${over.length - 2} หมวด`] : [])].join(" · "),
      count: over.length,
    };
  }
  if (over.length === 1) {
    const c = over[0];
    return {
      tone: "danger",
      title: `งบ${c.label}เกินแล้ว`,
      amount: baht(c.spent - c.budget),
      detail:
        near.length >= 2
          ? `ใกล้เต็มอีก ${near.length} หมวด · ดูทั้งหมด`
          : near.length === 1
            ? `${near[0].label}ใช้ไป ${pct(near[0])} · ดูงบทุกหมวด`
            : "ดูงบทุกหมวด",
      count: near.length >= 2 ? 1 + near.length : undefined,
    };
  }
  if (near.length >= 2) {
    const shown = near.slice(0, 2).map((c) => `${c.label} ${pct(c)}`);
    return {
      tone: "warn",
      title: `ใกล้เต็ม ${near.length} หมวด`,
      detail: [...shown, ...(near.length > 2 ? [`+${near.length - 2} หมวด`] : [])].join(" · "),
      count: near.length,
    };
  }
  if (near.length === 1) {
    const c = near[0];
    return {
      tone: "warn",
      title: `${c.label}ใช้ไป ${pct(c)} ของงบ`,
      detail: `เหลือ ${baht(c.budget - c.spent)}${daysLeft ? ` อีก ${daysLeft} วัน` : ""} · ดูงบทุกหมวด`,
    };
  }
  const room = total ? total.budget - total.spent : 0;
  return {
    tone: "ok",
    title: "ใช้จ่ายตามแผน",
    detail: total && daysLeft ? `ใช้ได้อีก ≈ ${baht(room / (daysLeft + 1))}/วัน จนสิ้นเดือน` : "ดูงบทุกหมวด",
  };
}
