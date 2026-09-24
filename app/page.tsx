"use client";

import Link from "next/link";
import { useMemo } from "react";
import { SubMono, TabScreen, TxRow } from "@/components/app";
import { MonthSwitcher } from "@/components/pickers";
import { Icon } from "@/components/ui/Icon";
import { Bar, Empty, HeroCard, IconButton, ListCard, SectionHeader, TabHeader } from "@/components/ui/primitives";
import { baht, splitDecimals, todayISO } from "@/lib/format";
import { monthTransactions, summarize, upcomingSubscriptions } from "@/lib/selectors";
import { useStore } from "@/lib/store";

export default function OverviewPage() {
  const { user, transactions, subscriptions, goals, viewMonth } = useStore();
  const today = todayISO();

  const month = useMemo(() => monthTransactions(transactions, viewMonth), [transactions, viewMonth]);
  const sum = useMemo(() => summarize(month), [month]);
  const upcoming = useMemo(() => upcomingSubscriptions(subscriptions, today).slice(0, 3), [subscriptions, today]);
  const recent = useMemo(
    () => [...month].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt).slice(0, 3),
    [month],
  );
  const [whole, dec] = splitDecimals(sum.net);
  const incomePct = goals.incomeTarget ? sum.income / goals.incomeTarget : 0;
  const expensePct = goals.expenseBudget ? sum.expense / goals.expenseBudget : 0;

  return (
    <TabScreen>
      <TabHeader
        title="ภาพรวม"
        subtitle={<MonthSwitcher />}
        actions={
          <>
            <IconButton icon="bell" label="การแจ้งเตือน" />
            <Link
              href="/profile"
              aria-label="โปรไฟล์"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-ink text-[17px] font-bold text-lime"
            >
              {(user?.name.trim()[0] ?? "?").toUpperCase()}
            </Link>
          </>
        }
      />

      <HeroCard>
        <div className="flex flex-col gap-1">
          <span className="text-[13px] text-on-ink-muted">คงเหลือเดือนนี้</span>
          <span className="font-mono text-4xl font-semibold leading-tight tracking-tight">
            {sum.net < 0 ? "−" : ""}
            {whole.replace("-", "")}
            <span className="text-xl text-on-ink-faint">{dec}</span>
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <GoalTile label="รายรับ" icon="in" iconColor="var(--color-lime)" amount={`+${baht(sum.income)}`} pct={incomePct} target={goals.incomeTarget ? `เป้า ${baht(goals.incomeTarget)}` : "ยังไม่ตั้งเป้า"} barColor="var(--color-lime)" />
          <GoalTile label="รายจ่าย" icon="out" iconColor="var(--color-peach)" amount={`−${baht(sum.expense)}`} pct={expensePct} target={goals.expenseBudget ? `งบ ${baht(goals.expenseBudget)}` : "ยังไม่ตั้งงบ"} barColor="var(--color-peach)" />
        </div>
        <Link href="/goals" className="-mt-1 flex min-h-9 items-center justify-between border-t border-ink-line pt-2.5 text-xs text-on-ink-muted">
          <span>โอนระหว่างบัญชี {baht(sum.moved)}</span>
          <span className="flex items-center gap-0.5 font-semibold text-lime">
            ดูเป้าหมาย
            <Icon name="chevronRight" size={14} strokeWidth={2.2} />
          </span>
        </Link>
      </HeroCard>

      <nav aria-label="เพิ่มรายการด่วน" className="grid grid-cols-3 gap-2">
        {(
          [
            ["in", "รายรับ", "var(--color-income)"],
            ["out", "รายจ่าย", "var(--color-expense)"],
            ["move", "โอน", "var(--color-transfer)"],
          ] as const
        ).map(([type, label, color]) => (
          <Link
            key={type}
            href={`/add?type=${type}`}
            className="flex min-h-12 items-center justify-center gap-1.5 rounded-[14px] border border-line bg-card text-sm font-semibold"
            style={{ color }}
          >
            <Icon name={type} size={16} strokeWidth={2.2} />
            {label}
          </Link>
        ))}
      </nav>

      <section className="flex flex-col gap-2.5">
        <SectionHeader title="ใกล้ตัดบัญชี" href="/subscriptions" />
        {upcoming.length ? (
          <div className="grid grid-cols-3 gap-2">
            {upcoming.map(({ sub, days }) => (
              <Link key={sub.id} href={`/subscriptions/${sub.id}`} className="flex flex-col gap-2 rounded-2xl border border-line bg-card p-3">
                <div className="flex items-center justify-between">
                  <SubMono s={sub} size={30} />
                  <span className="whitespace-nowrap rounded-full bg-chip px-2 py-px text-[11px] font-semibold" style={days <= 7 ? { background: "var(--color-lime)" } : undefined}>
                    {days <= 0 ? "วันนี้" : `${days} วัน`}
                  </span>
                </div>
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-[13px] font-medium">{sub.name}</span>
                  <span className="font-mono text-sm font-semibold">{baht(sub.amount)}</span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <Empty>ยังไม่มี subscription</Empty>
        )}
      </section>

      <section className="flex flex-col gap-1.5">
        <SectionHeader title="รายการล่าสุด" href="/transactions" />
        {recent.length ? (
          <ListCard>
            {recent.map((t) => (
              <TxRow key={t.id} t={t} />
            ))}
          </ListCard>
        ) : (
          <Empty>ยังไม่มีรายการในเดือนนี้</Empty>
        )}
      </section>
    </TabScreen>
  );
}

function GoalTile({
  label,
  icon,
  iconColor,
  amount,
  pct,
  target,
  barColor,
}: {
  label: string;
  icon: "in" | "out";
  iconColor: string;
  amount: string;
  pct: number;
  target: string;
  barColor: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-[14px] bg-ink-2 p-3">
      <div className="flex items-center justify-between text-xs text-on-ink-muted">
        <span className="flex items-center gap-1.5">
          <Icon name={icon} size={14} strokeWidth={2.2} style={{ color: iconColor }} />
          {label}
        </span>
        {pct > 0 ? <span>{Math.round(pct * 100)}%</span> : null}
      </div>
      <span className="font-mono text-[17px] font-semibold">{amount}</span>
      <div className="mt-1">
        <Bar value={pct} color={barColor} height={4} />
      </div>
      <span className="text-[11px] text-on-ink-faint">{target}</span>
    </div>
  );
}
