import { categoryLabel } from "./constants";
import { baht, monthKey } from "./format";
import { t } from "./i18n";
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
    ? { key: "total", label: t("cat.total"), budget: goals.expenseBudget, spent: expense, pct: expense / goals.expenseBudget }
    : null;
  return { cats, total };
}

export interface DailyAllowance {
  /** The budget left at the start of today, spread over the days left (today included). */
  perDay: number;
  spentToday: number;
  /** What can still be spent today; negative once today went over. */
  left: number;
}

/** Today's share of the monthly budget, for the current month only (null without an overall budget). */
export function dailyAllowance(goals: Goals, monthTxs: Transaction[], month: string, today: string): DailyAllowance | null {
  if (goals.expenseBudget <= 0 || monthKey(today) !== month) return null;
  const before = summarize(monthTxs.filter((t) => t.date < today)).expense;
  const spentToday = summarize(monthTxs.filter((t) => t.date === today)).expense;
  const perDay = Math.max(0, goals.expenseBudget - before) / (daysLeftInMonth(month, today) + 1);
  return { perDay, spentToday, left: perDay - spentToday };
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
    return { tone: "setup", title: t("banner.setupTitle"), detail: t("banner.setupDetail") };
  }
  const over = cats.filter((c) => c.spent > c.budget).sort((a, b) => b.spent - b.budget - (a.spent - a.budget));
  const near = cats.filter((c) => c.pct >= 0.8 && c.spent <= c.budget).sort((a, b) => b.pct - a.pct);
  const daysLeft = daysLeftInMonth(month, today);

  if (total && total.spent > total.budget) {
    return {
      tone: "critical",
      title: t("banner.totalOver"),
      amount: baht(total.spent - total.budget),
      detail: over.length ? t("banner.overIn", { count: over.length, label: over[0].label }) : t("banner.seeAllBudgets"),
      count: over.length || undefined,
    };
  }
  if (over.length >= 2) {
    const shown = over.slice(0, 2).map((c) => `${c.label} ${baht(c.spent - c.budget)}`);
    return {
      tone: "danger",
      title: t("banner.severalOver", { count: over.length }),
      amount: baht(over.reduce((a, c) => a + c.spent - c.budget, 0)),
      detail: [...shown, ...(over.length > 2 ? [t("banner.moreCats", { count: over.length - 2 })] : [])].join(" · "),
      count: over.length,
    };
  }
  if (over.length === 1) {
    const c = over[0];
    return {
      tone: "danger",
      title: t("banner.oneOver", { label: c.label }),
      amount: baht(c.spent - c.budget),
      detail:
        near.length >= 2
          ? t("banner.nearMore", { count: near.length })
          : near.length === 1
            ? t("banner.nearOne", { label: near[0].label, pct: pct(near[0]) })
            : t("banner.seeAllBudgets"),
      count: near.length >= 2 ? 1 + near.length : undefined,
    };
  }
  if (near.length >= 2) {
    const shown = near.slice(0, 2).map((c) => `${c.label} ${pct(c)}`);
    return {
      tone: "warn",
      title: t("banner.severalNear", { count: near.length }),
      detail: [...shown, ...(near.length > 2 ? [t("banner.moreCats", { count: near.length - 2 })] : [])].join(" · "),
      count: near.length,
    };
  }
  if (near.length === 1) {
    const c = near[0];
    return {
      tone: "warn",
      title: t("banner.oneNear", { label: c.label, pct: pct(c) }),
      detail: `${t("banner.leftFor", { amount: baht(c.budget - c.spent) })}${daysLeft ? t("banner.daysMore", { count: daysLeft }) : ""} · ${t("banner.seeAllBudgets")}`,
    };
  }
  const room = total ? total.budget - total.spent : 0;
  return {
    tone: "ok",
    title: t("banner.onPlan"),
    detail: total && daysLeft ? t("banner.perDayLeft", { amount: baht(room / (daysLeft + 1)) }) : t("banner.seeAllBudgets"),
  };
}
