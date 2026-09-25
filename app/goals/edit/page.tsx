"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PushScreen } from "@/components/app";
import { Icon } from "@/components/ui/Icon";
import { Card, ListCard, PrimaryButton, PushHeader, SwitchRow } from "@/components/ui/primitives";
import { EXPENSE_CATEGORIES } from "@/lib/constants";
import { baht } from "@/lib/format";
import { useTranslation } from "react-i18next";
import { useStore } from "@/lib/store";

const toNum = (s: string) => parseInt(s.replace(/[^0-9]/g, ""), 10) || 0;
const fmt = (n: number) => (n ? n.toLocaleString("en-US") : "");

export default function GoalEditPage() {
  const router = useRouter();
  const goals = useStore((s) => s.goals);
  const setGoals = useStore((s) => s.setGoals);
  const { t: tr } = useTranslation();
  const [income, setIncome] = useState(goals.incomeTarget);
  const [expense, setExpense] = useState(goals.expenseBudget);
  const [alert, setAlert] = useState(goals.alertAt80);
  const [budgets, setBudgets] = useState<Record<string, number>>(goals.categoryBudgets);

  const cats = EXPENSE_CATEGORIES.filter((c) => c.key !== "other");
  const allocated = Object.values(budgets).reduce((a, b) => a + b, 0);
  const over = expense > 0 && allocated > expense;
  const save = income - expense;

  return (
    <PushScreen>
      <PushHeader title={tr("goals.set")} onBack={() => router.back()} />

      <div className="grid grid-cols-2 gap-2.5">
        <MoneyField label={tr("goals.incomePerMonth")} icon="in" color="var(--color-income)" value={income} onChange={setIncome} />
        <MoneyField label={tr("goals.expensePerMonth")} icon="out" color="var(--color-expense)" value={expense} onChange={setExpense} />
      </div>

      <div className="flex items-center gap-2.5 rounded-2xl bg-ink px-4 py-3.5 text-[13px] text-on-ink">
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
      </section>

      <ListCard>
        <SwitchRow label={tr("goals.alert80")} hint={tr("goals.alert80Hint")} checked={alert} onChange={setAlert} />
      </ListCard>

      <div className="mt-auto">
        <PrimaryButton
          once
          onClick={() => {
            setGoals({ incomeTarget: income, expenseBudget: expense, categoryBudgets: budgets, alertAt80: alert });
            router.replace("/goals");
          }}
        >
          {tr("goals.save")}
        </PrimaryButton>
      </div>
    </PushScreen>
  );
}

function MoneyField({ label, icon, color, value, onChange }: { label: string; icon: "in" | "out"; color: string; value: number; onChange: (n: number) => void }) {
  return (
    <Card className="px-3.5 py-3">
      <label className="flex flex-col gap-1">
        <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color }}>
          <Icon name={icon} size={14} strokeWidth={2.2} />
          {label}
        </span>
        <span className="flex items-baseline gap-0.5 font-mono text-[22px] font-semibold">
          ฿
          <input inputMode="numeric" value={fmt(value)} placeholder="0" onChange={(e) => onChange(toNum(e.target.value))} className="min-h-8 w-full min-w-0 bg-transparent outline-none" />
        </span>
      </label>
    </Card>
  );
}
