"use client"

import Link from "next/link"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { Icon } from "./ui/Icon"
import { baht, shortDate, todayISO } from "@/lib/format"
import { cashFlow, firstShortfall } from "@/lib/cashflow"
import { subTHB } from "@/lib/fx"
import { useStore } from "@/lib/store"

/** Every account's next 30 days, from the store. */
export function useCashFlow() {
  const accounts = useStore((s) => s.accounts)
  const txs = useStore((s) => s.transactions)
  const subs = useStore((s) => s.subscriptions)
  const usdRate = useStore((s) => s.usdRate)
  const today = todayISO()
  return useMemo(
    () => cashFlow(accounts, txs, subs, today, (s) => subTHB(s, accounts, usdRate) ?? s.amount),
    [accounts, txs, subs, today, usdRate],
  )
}

/** On Home: the first day an account won't cover what's due, linking to the day-by-day view. */
export function CashFlowAlert() {
  const { t } = useTranslation()
  const flows = useCashFlow()
  const short = useMemo(() => firstShortfall(flows), [flows])
  if (!short) return null
  return (
    <Link
      href="/cashflow"
      className="flex min-h-[68px] items-center gap-3 rounded-[20px] border border-expense-line bg-expense-tint px-3.5 py-3"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-danger text-on-hero">
        <Icon name="alert" size={20} strokeWidth={2} />
      </span>
      <span className="flex min-w-0 grow flex-col gap-0.5">
        <span className="text-[15px] leading-snug font-semibold">
          {t("cashflow.alertTitle", { date: shortDate(short.event.date, false), account: short.account.name })}
        </span>
        <span className="truncate text-xs text-muted">
          {t("cashflow.alertDetail", {
            what:
              short.event.kind === "card"
                ? t("cashflow.cardBill", { name: short.event.label })
                : short.event.label || t("cashflow.transfer"),
            amount: baht(short.by),
          })}
        </span>
      </span>
      <Icon name="chevronRight" size={16} strokeWidth={2} className="shrink-0 text-faint" />
    </Link>
  )
}
