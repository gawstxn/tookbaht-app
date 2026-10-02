"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { SubMono, TabScreen, TxIcon, TxRow } from "@/components/app"
import { MonthSwitcher } from "@/components/pickers"
import { Icon } from "@/components/ui/Icon"
import { BillsDue } from "@/components/bills"
import { BudgetBannerCard } from "@/components/BudgetBanner"
import { LeftoverCard } from "@/components/LeftoverCard"
import { CashFlowAlert } from "@/components/cashflow"
import { NotificationBell } from "@/components/notifications"
import { StreakChip, StreakSync } from "@/components/streak"
import { TxDetailSheet } from "@/components/TxDetailSheet"
import { WhatsNew } from "@/components/WhatsNew"
import { Bar, Empty, HeroCard, ListCard, SectionHeader, TabHeader, cx } from "@/components/ui/primitives"
import { budgetBanner, dailyAllowance, rolloverCarry, withCarry } from "@/lib/budget"
import { formatMoney } from "@/lib/fx"
import { baht, splitDecimals, todayISO } from "@/lib/format"
import { debtsByPerson } from "@/lib/ious"
import { isService, monthTransactions, summarize, upcomingSubscriptions } from "@/lib/selectors"
import { useTranslation } from "react-i18next"
import { useStore, useViewPeriod } from "@/lib/store"
import { setAmountsHidden, useAmountsHidden } from "@/lib/hideAmounts"
import type { Transaction } from "@/lib/types"

export default function OverviewPage() {
  const { transactions, subscriptions, goals, ious } = useStore()
  const period = useViewPeriod()
  const owed = useMemo(() => debtsByPerson(ious), [ious])
  const owing = useMemo(() => debtsByPerson(ious, "i_owe"), [ious])
  const [selected, setSelected] = useState<Transaction | null>(null)
  const { t: tr } = useTranslation()
  const hidden = useAmountsHidden()
  const today = todayISO()

  const month = useMemo(() => monthTransactions(transactions, period), [transactions, period])
  const sum = useMemo(() => summarize(month), [month])
  const upcoming = useMemo(
    () =>
      upcomingSubscriptions(
        subscriptions.filter((s) => s.entryType !== "in"),
        today,
      ).slice(0, 3),
    [subscriptions, today],
  )
  const recent = useMemo(
    () => [...month].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt).slice(0, 5),
    [month],
  )
  const monthGoals = useMemo(
    () => withCarry(goals, rolloverCarry(goals, transactions, period)),
    [goals, transactions, period],
  )
  const banner = budgetBanner(monthGoals, month, period, today)
  const allowance = useMemo(() => dailyAllowance(goals, month, period, today), [goals, month, period, today])
  const [whole, dec] = splitDecimals(sum.net)
  const incomePct = goals.incomeTarget ? sum.income / goals.incomeTarget : 0
  const expensePct = goals.expenseBudget ? sum.expense / goals.expenseBudget : 0

  return (
    <TabScreen>
      <TabHeader
        title={tr("overview.title")}
        subtitle={<MonthSwitcher />}
        actions={
          <>
            <StreakChip />
            <NotificationBell />
          </>
        }
      />
      <StreakSync />

      <HeroCard>
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-on-ink-muted">{tr("overview.leftThisMonth")}</span>
            <button
              type="button"
              aria-pressed={hidden}
              aria-label={tr(hidden ? "overview.showAmounts" : "overview.hideAmounts")}
              onClick={() => {
                setAmountsHidden(!hidden)
                useStore.getState().notify(tr(hidden ? "overview.amountsShown" : "overview.amountsHidden"))
              }}
              className="-my-3 -mr-3 flex h-11 w-11 items-center justify-center text-on-ink-muted"
            >
              <Icon name={hidden ? "eyeOff" : "eye"} size={18} strokeWidth={2} />
            </button>
          </div>
          <span className="font-mono text-4xl leading-tight font-semibold tracking-tight">
            {sum.net < 0 && !hidden ? "−" : ""}
            {whole.replace("-", "")}
            <span className="text-xl text-on-ink-faint">{dec}</span>
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <GoalTile
            label={tr("type.in")}
            icon="in"
            iconColor="var(--color-lime)"
            amount={`+${baht(sum.income)}`}
            pct={incomePct}
            target={
              goals.incomeTarget ? tr("overview.target", { amount: baht(goals.incomeTarget) }) : tr("overview.noTarget")
            }
            barColor="var(--color-lime)"
          />
          <GoalTile
            label={tr("type.out")}
            icon="out"
            iconColor="var(--color-peach)"
            amount={`−${baht(sum.expense)}`}
            pct={expensePct}
            target={
              goals.expenseBudget
                ? tr("overview.budget", { amount: baht(goals.expenseBudget) })
                : tr("overview.noBudget")
            }
            barColor="var(--color-peach)"
          />
        </div>
        <Link
          href="/goals"
          className="-mt-1 flex min-h-9 items-center justify-between border-t border-ink-line pt-2.5 text-xs text-on-ink-muted"
        >
          <span>{tr("overview.moved", { amount: baht(sum.moved) })}</span>
          <span className="flex items-center gap-0.5 font-semibold text-lime">
            {tr("overview.seeGoals")}
            <Icon name="chevronRight" size={14} strokeWidth={2.2} />
          </span>
        </Link>
      </HeroCard>

      {allowance ? (
        <Link href="/goals" className="flex flex-col gap-2 rounded-[20px] border border-line bg-card px-4 py-3.5">
          <div className="flex items-end justify-between gap-3">
            <span className="flex flex-col">
              <span className="flex items-center gap-0.5 text-[13px] text-muted">
                {allowance.left >= 0 ? tr("allowance.left") : tr("allowance.over")}
                <Icon name="chevronRight" size={14} strokeWidth={2} className="text-faint" />
              </span>
              <span
                className={cx(
                  "font-mono text-[24px] leading-tight font-semibold",
                  allowance.left < 0 && "text-expense",
                )}
              >
                {baht(Math.abs(allowance.left))}
              </span>
            </span>
            <span className="text-right text-xs text-muted">
              {tr("allowance.spent", { spent: baht(allowance.spentToday), perDay: baht(allowance.perDay) })}
            </span>
          </div>
          <Bar
            value={allowance.perDay > 0 ? allowance.spentToday / allowance.perDay : allowance.spentToday > 0 ? 1 : 0}
            height={6}
            track="var(--color-divider)"
            color={allowance.left < 0 ? "var(--color-expense)" : "var(--color-income)"}
          />
        </Link>
      ) : null}

      {/* "On plan" repeats the allowance card's per-day figure; show the banner only when it adds something. */}
      {allowance && banner.tone === "ok" ? null : <BudgetBannerCard banner={banner} />}
      <CashFlowAlert />
      <BillsDue />
      <LeftoverCard />

      {owed.length ? (
        <Link
          href="/ious"
          className="flex min-h-[60px] items-center gap-3 rounded-2xl border border-line bg-card px-4 py-2.5"
        >
          <span
            aria-hidden="true"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-income-tint text-income"
          >
            <Icon name="users" size={18} strokeWidth={2} />
          </span>
          <span className="flex min-w-0 grow flex-col">
            <span className="text-[15px] font-semibold">
              {tr("ious.homeTitle", { amount: baht(owed.reduce((s, p) => s + p.total, 0)) })}
            </span>
            <span className="truncate text-xs text-muted">{owed.map((p) => p.person).join(", ")}</span>
          </span>
          <Icon name="chevronRight" size={16} strokeWidth={2} className="text-faint" />
        </Link>
      ) : null}

      {owing.length ? (
        <Link
          href="/ious"
          className="flex min-h-[60px] items-center gap-3 rounded-2xl border border-line bg-card px-4 py-2.5"
        >
          <span
            aria-hidden="true"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-expense-tint text-expense"
          >
            <Icon name="users" size={18} strokeWidth={2} />
          </span>
          <span className="flex min-w-0 grow flex-col">
            <span className="text-[15px] font-semibold">
              {tr("ious.homeIOwe", { amount: baht(owing.reduce((s, p) => s + p.total, 0)) })}
            </span>
            <span className="truncate text-xs text-muted">{owing.map((p) => p.person).join(", ")}</span>
          </span>
          <Icon name="chevronRight" size={16} strokeWidth={2} className="text-faint" />
        </Link>
      ) : null}

      <section className="flex flex-col gap-2.5">
        <SectionHeader title={tr("overview.upcoming")} href="/subscriptions" />
        {upcoming.length ? (
          <div className="grid grid-cols-3 gap-2">
            {upcoming.map(({ sub, days }) => (
              <Link
                key={sub.id}
                href={`/subscriptions/${sub.id}`}
                className="flex flex-col gap-2 rounded-2xl border border-line bg-card p-3"
              >
                <div className="flex items-center justify-between">
                  {isService(sub) ? (
                    <SubMono s={sub} size={30} />
                  ) : (
                    <TxIcon type={sub.entryType} category={sub.category} size={30} />
                  )}
                  <span
                    className="rounded-full bg-chip px-2 py-px text-[11px] font-semibold whitespace-nowrap"
                    style={days <= 7 ? { background: "var(--color-lime)", color: "var(--color-on-lime)" } : undefined}
                  >
                    {days <= 0 ? tr("common.today") : tr("common.days", { count: days })}
                  </span>
                </div>
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-[13px] font-medium">{sub.name}</span>
                  <span className="font-mono text-sm font-semibold">
                    {sub.variable ? "≈ " : ""}
                    {formatMoney(sub.amount, sub.currency)}
                  </span>
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
              <TxRow key={t.id} t={t} onClick={() => setSelected(t)} />
            ))}
          </ListCard>
        ) : (
          <Empty>{tr("overview.noTx")}</Empty>
        )}
      </section>

      <TxDetailSheet tx={selected} onClose={() => setSelected(null)} />
      <WhatsNew />
    </TabScreen>
  )
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
  label: string
  icon: "in" | "out"
  iconColor: string
  amount: string
  pct: number
  target: string
  barColor: string
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
  )
}
