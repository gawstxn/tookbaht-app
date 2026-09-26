"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PushScreen } from "@/components/app";
import { MoneyField } from "@/components/MoneyField";
import { Icon } from "@/components/ui/Icon";
import { ListCard, PrimaryButton, PushHeader, SwitchRow, cx } from "@/components/ui/primitives";
import { EXPENSE_CATEGORIES } from "@/lib/constants";
import { baht } from "@/lib/format";
import { useTranslation } from "react-i18next";
import { useGoBack } from "@/lib/nav";
import { useStore } from "@/lib/store";

const toNum = (s: string) => parseInt(s.replace(/[^0-9]/g, ""), 10) || 0;
const fmt = (n: number) => (n ? n.toLocaleString("en-US") : "");

export default function GoalEditPage() {
  const router = useRouter();
  const goBack = useGoBack("/goals");
  const goals = useStore((s) => s.goals);
  const setGoals = useStore((s) => s.setGoals);
  const { t: tr } = useTranslation();
  const [income, setIncome] = useState(goals.incomeTarget);
  const [expense, setExpense] = useState(goals.expenseBudget);
  const [alert, setAlert] = useState(goals.alertAt80);
  const [budgets, setBudgets] = useState<Record<string, number>>(goals.categoryBudgets);
  const [rollover, setRollover] = useState<string[]>(goals.rolloverKeys ?? []);

  const cats = EXPENSE_CATEGORIES.filter((c) => c.key !== "other");
  const allocated = Object.values(budgets).reduce((a, b) => a + b, 0);
  const over = expense > 0 && allocated > expense;
  const save = income - expense;

  return (
    <PushScreen>
      <PushHeader title={tr("goals.set")} onBack={() => goBack()} />

      <div className="grid grid-cols-2 gap-2.5">
        <MoneyField label={tr("goals.incomePerMonth")} icon="in" color="var(--color-income)" value={income} onChange={setIncome} />
        <MoneyField label={tr("goals.expensePerMonth")} icon="out" color="var(--color-expense)" value={expense} onChange={setExpense} />
      </div>

      <div className="flex items-center gap-2.5 rounded-2xl bg-hero px-4 py-3.5 text-[13px] text-on-hero">
        <span className="h-2 w-2 shrink-0 rounded-full bg-lime" />
        <span className="grow">{tr("goals.saving")}</span>
        <span className="font-mono text-[15px] font-semibold text-lime">
          {save < 0 ? "−" : ""}
          {baht(Math.abs(save))} {tr("common.perMonth")}
        </span>
      </div>

      <section className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <h2 className="text-base font-semibold">{tr("goals.perCategory")}</h2>
          <span className={over ? "text-xs font-medium text-danger" : "text-xs font-medium text-muted"}>
            {over ? tr("goals.overTotal", { amount: baht(allocated - expense) }) : tr("goals.allocated", { amount: baht(allocated) }) + (expense ? tr("goals.allocatedOf", { amount: baht(expense) }) : "")}
          </span>
        </div>
        <ListCard>
          {cats.map((c) => (
            <label key={c.key} className="flex min-h-[52px] items-center gap-3">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c.dot }} />
              <span className="grow text-sm">{c.label}</span>
              {budgets[c.key] ? (
                <button
                  type="button"
                  aria-pressed={rollover.includes(c.key)}
                  aria-label={tr("goals.rolloverFor", { label: c.label })}
                  onClick={(e) => {
                    e.preventDefault();
                    setRollover((r) => (r.includes(c.key) ? r.filter((k) => k !== c.key) : [...r, c.key]));
                  }}
                  className={cx(
                    "flex h-9 shrink-0 items-center gap-1 rounded-full px-2.5 text-xs font-semibold",
                    rollover.includes(c.key) ? "bg-ink text-on-ink" : "border border-line text-muted",
                  )}
                >
                  <Icon name="repeat" size={13} strokeWidth={2.2} />
                  {tr("goals.rollover")}
                </button>
              ) : null}
              <span className="flex min-h-9 items-center gap-0.5 rounded-[10px] bg-paper px-2.5 font-mono text-sm font-semibold">
                ฿
                <input
                  inputMode="numeric"
                  aria-label={tr("goals.budgetFor", { label: c.label })}
                  value={fmt(budgets[c.key] ?? 0)}
                  placeholder="0"
                  onChange={(e) => setBudgets((b) => ({ ...b, [c.key]: toNum(e.target.value) }))}
                  className="w-[72px] bg-transparent text-right outline-none"
                />
              </span>
            </label>
          ))}
        </ListCard>
        <p className="text-xs leading-relaxed text-muted">{tr("goals.rolloverHint")}</p>
      </section>

      <ListCard>
        <SwitchRow label={tr("goals.alert80")} hint={tr("goals.alert80Hint")} checked={alert} onChange={setAlert} />
      </ListCard>

      <div className="mt-auto">
        <PrimaryButton
          once
          onClick={() => {
            setGoals({ incomeTarget: income, expenseBudget: expense, categoryBudgets: budgets, alertAt80: alert, rolloverKeys: rollover.filter((k) => (budgets[k] ?? 0) > 0) });
            router.replace("/goals");
          }}
        >
          {tr("goals.save")}
        </PrimaryButton>
      </div>
    </PushScreen>
  );
}
