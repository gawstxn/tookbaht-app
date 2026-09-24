"use client";

import { TabScreen } from "@/components/app";
import { MonthSwitcher } from "@/components/pickers";
import { Icon } from "@/components/ui/Icon";
import { Bar, Empty, HeroCard, IconButton, ListCard, TabHeader } from "@/components/ui/primitives";
import { categoryLabel } from "@/lib/constants";
import { baht, todayISO } from "@/lib/format";
import { daysLeftInMonth, monthPace, monthTransactions, spendByCategory, summarize } from "@/lib/selectors";
import { useStore } from "@/lib/store";

export default function GoalsPage() {
  const { transactions, goals, viewMonth } = useStore();
  const today = todayISO();
  const month = monthTransactions(transactions, viewMonth);
  const sum = summarize(month);
  const byCat = spendByCategory(month);
  const pace = monthPace(viewMonth, today);
  const left = daysLeftInMonth(viewMonth, today);

  const incomePct = goals.incomeTarget ? sum.income / goals.incomeTarget : 0;
  const expensePct = goals.expenseBudget ? sum.expense / goals.expenseBudget : 0;
  const plannedByNow = goals.expenseBudget * pace;
  const ahead = sum.expense - plannedByNow;
  const remaining = goals.expenseBudget - sum.expense;
  const perDay = left > 0 ? Math.max(0, remaining) / left : 0;

  const cats = Object.entries(goals.categoryBudgets)
    .filter(([, b]) => b > 0)
    .map(([key, budget]) => {
      const spent = byCat[key] ?? 0;
      const r = spent / budget;
      const over = r > 1;
      const fast = !over && r > pace && pace < 1;
      return { key, budget, spent, r, over, fast };
    })
    .sort((a, b) => b.r - a.r);

  const hasGoals = goals.incomeTarget > 0 || goals.expenseBudget > 0;

  return (
    <TabScreen>
      <TabHeader
        title="เป้าหมาย"
        subtitle={
          <span className="flex items-center gap-1">
            <MonthSwitcher />
            {left > 0 ? <span>· เหลืออีก {left} วัน</span> : null}
          </span>
        }
        actions={<IconButton href="/goals/edit" icon="pencil" label="ตั้งเป้าหมาย" variant="dark" />}
      />

      {hasGoals ? (
        <HeroCard label="สรุปเป้าหมายเดือนนี้" className="gap-[18px]">
          {goals.incomeTarget > 0 ? (
            <div className="flex flex-col gap-2">
              <MeterHead icon="in" color="var(--color-lime)" label="เป้ารายรับ" pct={incomePct} />
              <Amount value={sum.income} of={goals.incomeTarget} />
              <Bar value={incomePct} color="var(--color-lime)" />
              <span className="text-xs text-on-ink-muted">
                {sum.income >= goals.incomeTarget ? "ถึงเป้าแล้ว" : `ขาดอีก ${baht(goals.incomeTarget - sum.income)} ก็ถึงเป้า`}
              </span>
            </div>
          ) : null}
          {goals.expenseBudget > 0 ? (
            <div className={goals.incomeTarget > 0 ? "flex flex-col gap-2 border-t border-ink-line pt-4" : "flex flex-col gap-2"}>
              <MeterHead icon="out" color="var(--color-peach)" label="งบรายจ่าย" pct={expensePct} />
              <Amount value={sum.expense} of={goals.expenseBudget} />
              <Bar value={expensePct} color="var(--color-peach)" marker={pace > 0 && pace < 1 ? { at: pace, color: "var(--color-on-ink)" } : undefined} />
              <div className="flex items-center justify-between text-xs text-on-ink-muted">
                {remaining < 0 ? (
                  <span className="font-semibold text-peach">เกินงบ {baht(-remaining)}</span>
                ) : ahead > 0 && pace < 1 ? (
                  <span className="font-semibold text-peach">ใช้เร็วกว่าแผน {baht(ahead)}</span>
                ) : (
                  <span>เป็นไปตามแผน</span>
                )}
                {left > 0 && remaining > 0 ? <span>เหลือ ≈ {baht(perDay)}/วัน</span> : null}
              </div>
            </div>
          ) : null}
        </HeroCard>
      ) : (
        <Empty>ยังไม่ได้ตั้งเป้าหมาย — กดปุ่มดินสอเพื่อเริ่ม</Empty>
      )}

      {cats.length ? (
        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">งบตามหมวด</h2>
            {pace > 0 && pace < 1 ? <span className="text-xs text-muted">ขีดตั้ง = ควรใช้ถึงวันนี้</span> : null}
          </div>
          <ListCard className="py-1">
            {cats.map((c) => (
              <div key={c.key} className="flex flex-col gap-1.5 py-2.5">
                <div className="flex items-baseline justify-between text-sm">
                  <span className="font-medium">{categoryLabel(c.key)}</span>
                  <span className="font-mono text-[13px]">
                    <span className="font-semibold">{baht(c.spent)}</span>
                    <span className="text-muted"> / {baht(c.budget)}</span>
                  </span>
                </div>
                <Bar
                  value={c.r}
                  height={6}
                  track="var(--color-divider)"
                  color={c.over ? "var(--color-expense)" : c.fast ? "var(--color-warn)" : "var(--color-income)"}
                  marker={pace > 0 && pace < 1 ? { at: pace, color: "var(--color-ink)" } : undefined}
                />
                <span className={c.over ? "text-xs font-semibold text-danger" : "text-xs text-muted"}>
                  {c.over ? `เกินงบ ${baht(c.spent - c.budget)}` : `เหลือ ${baht(c.budget - c.spent)}${c.fast ? " · ใช้เร็วกว่าแผน" : ""}`}
                </span>
              </div>
            ))}
          </ListCard>
        </section>
      ) : null}
    </TabScreen>
  );
}

function MeterHead({ icon, color, label, pct }: { icon: "in" | "out"; color: string; label: string; pct: number }) {
  return (
    <div className="flex items-center justify-between text-[13px] text-on-ink-muted">
      <span className="flex items-center gap-1.5">
        <Icon name={icon} size={14} strokeWidth={2.2} style={{ color }} />
        {label}
      </span>
      <span className="font-mono font-semibold" style={{ color }}>
        {Math.round(pct * 100)}%
      </span>
    </div>
  );
}

function Amount({ value, of }: { value: number; of: number }) {
  return (
    <span className="font-mono text-[28px] font-semibold leading-tight tracking-tight">
      {baht(value)}
      <span className="text-[15px] text-on-ink-faint"> / {baht(of)}</span>
    </span>
  );
}
