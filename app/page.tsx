"use client";

import Link from "next/link";
import { useMemo } from "react";
import { SubMono, TabScreen, TxIcon, TxRow } from "@/components/app";
import { MonthSwitcher } from "@/components/pickers";
import { Icon } from "@/components/ui/Icon";
import { BudgetBannerCard } from "@/components/BudgetBanner";
import { NotificationBell } from "@/components/notifications";
import { Bar, Empty, HeroCard, ListCard, SectionHeader, TabHeader } from "@/components/ui/primitives";
import { budgetBanner } from "@/lib/budget";
import { formatMoney } from "@/lib/fx";
import { baht, splitDecimals, todayISO } from "@/lib/format";
import { isService, monthTransactions, summarize, upcomingSubscriptions } from "@/lib/selectors";
import { useTranslation } from "react-i18next";
import { useStore } from "@/lib/store";

export default function OverviewPage() {
  const { transactions, subscriptions, goals, viewMonth } = useStore();
  const { t: tr } = useTranslation();
  const today = todayISO();

  const month = useMemo(() => monthTransactions(transactions, viewMonth), [transactions, viewMonth]);
  const sum = useMemo(() => summarize(month), [month]);
  const upcoming = useMemo(() => upcomingSubscriptions(subscriptions.filter((s) => s.entryType !== "in"), today).slice(0, 3), [subscriptions, today]);
  const recent = useMemo(
    () => [...month].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt).slice(0, 5),
    [month],
  );
  const banner = budgetBanner(goals, month, viewMonth, today);
  const [whole, dec] = splitDecimals(sum.net);
  const incomePct = goals.incomeTarget ? sum.income / goals.incomeTarget : 0;
  const expensePct = goals.expenseBudget ? sum.expense / goals.expenseBudget : 0;

  return (
    <TabScreen>
      <TabHeader
        title={tr("overview.title")}
        subtitle={<MonthSwitcher />}
        actions={<NotificationBell />}
      />

      <HeroCard>
        <div className="flex flex-col gap-1">
          <span className="text-[13px] text-on-ink-muted">{tr("overview.leftThisMonth")}</span>
          <span className="font-mono text-4xl font-semibold leading-tight tracking-tight">
            {sum.net < 0 ? "−" : ""}
            {whole.replace("-", "")}
            <span className="text-xl text-on-ink-faint">{dec}</span>
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <GoalTile label={tr("type.in")} icon="in" iconColor="var(--color-lime)" amount={`+${baht(sum.income)}`} pct={incomePct} target={goals.incomeTarget ? tr("overview.target", { amount: baht(goals.incomeTarget) }) : tr("overview.noTarget")} barColor="var(--color-lime)" />
          <GoalTile label={tr("type.out")} icon="out" iconColor="var(--color-peach)" amount={`−${baht(sum.expense)}`} pct={expensePct} target={goals.expenseBudget ? tr("overview.budget", { amount: baht(goals.expenseBudget) }) : tr("overview.noBudget")} barColor="var(--color-peach)" />
        </div>
        <Link href="/goals" className="-mt-1 flex min-h-9 items-center justify-between border-t border-ink-line pt-2.5 text-xs text-on-ink-muted">
          <span>{tr("overview.moved", { amount: baht(sum.moved) })}</span>
          <span className="flex items-center gap-0.5 font-semibold text-lime">
            {tr("overview.seeGoals")}
            <Icon name="chevronRight" size={14} strokeWidth={2.2} />
          </span>
        </Link>
      </HeroCard>

      <BudgetBannerCard banner={banner} />

      <section className="flex flex-col gap-2.5">
        <SectionHeader title={tr("overview.upcoming")} href="/subscriptions" />
        {upcoming.length ? (
          <div className="grid grid-cols-3 gap-2">
            {upcoming.map(({ sub, days }) => (
              <Link key={sub.id} href={`/subscriptions/${sub.id}`} className="flex flex-col gap-2 rounded-2xl border border-line bg-card p-3">
                <div className="flex items-center justify-between">
                  {isService(sub) ? <SubMono s={sub} size={30} /> : <TxIcon type={sub.entryType} category={sub.category} size={30} />}
                  <span className="whitespace-nowrap rounded-full bg-chip px-2 py-px text-[11px] font-semibold" style={days <= 7 ? { background: "var(--color-lime)", color: "var(--color-on-lime)" } : undefined}>
                    {days <= 0 ? tr("common.today") : tr("common.days", { count: days })}
                  </span>
                </div>
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-[13px] font-medium">{sub.name}</span>
                  <span className="font-mono text-sm font-semibold">{formatMoney(sub.amount, sub.currency)}</span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <Empty>{tr("overview.noSubs")}</Empty>
        )}
      </section>

      <section className="flex flex-col gap-1.5">
        <SectionHeader title={tr("overview.recent")} href="/transactions" />
        {recent.length ? (
          <ListCard>
            {recent.map((t) => (
              <TxRow key={t.id} t={t} />
            ))}
          </ListCard>
        ) : (
          <Empty>{tr("overview.noTx")}</Empty>
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
