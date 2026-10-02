"use client"

import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { AccountSheet, DateSheet } from "@/components/pickers"
import { Card, ListCard, PickerRow, PrimaryButton, SecondaryButton, Sheet, cx } from "@/components/ui/primitives"
import { billAverage, openBills, type OpenBill } from "@/lib/bills"
import { baht, relativeDue, shortDate, todayISO } from "@/lib/format"
import { t as translate } from "@/lib/i18n"
import { useStore } from "@/lib/store"
import type { Subscription } from "@/lib/types"
import { TxIcon } from "./app"
import { BahtInput } from "./BahtInput"
import { Icon } from "./ui/Icon"

/* Bills whose amount changes every time (lib/bills.ts): asking for them, and logging what was paid. */

/** Bills waiting to be paid, the most overdue first. */
export function useOpenBills(): OpenBill[] {
  const subscriptions = useStore((s) => s.subscriptions)
  const transactions = useStore((s) => s.transactions)
  const skipped = useStore((s) => s.settings.billSkipped)
  const today = todayISO()
  return useMemo(
    () => openBills(subscriptions, transactions, today, skipped),
    [subscriptions, transactions, today, skipped],
  )
}

/** "ครบกำหนดพรุ่งนี้" / "เลยกำหนดมา 3 วัน" */
export function billStatus(days: number): string {
  return days < 0
    ? translate("bill.lateShort", { count: -days })
    : translate("bill.dueShort", { rel: relativeDue(days) })
}

/** Home: one row per bill that is due, opening the sheet to log what it came to. */
export function BillsDue() {
  const { t } = useTranslation()
  const bills = useOpenBills()
  const [picked, setPicked] = useState<OpenBill | null>(null)
  return (
    <>
      {bills.map((b) => (
        <button
          key={b.sub.id}
          type="button"
          onClick={() => setPicked(b)}
          className="flex min-h-[60px] w-full items-center gap-3 rounded-2xl border border-line bg-card px-4 py-2.5 text-left"
        >
          <TxIcon type="out" category={b.sub.category} size={36} />
          <span className="flex min-w-0 grow flex-col">
            <span className="truncate text-[15px] font-semibold">{b.sub.name}</span>
            <span className={cx("truncate text-xs", b.days < 0 ? "font-semibold text-danger" : "text-muted")}>
              {billStatus(b.days)} · {t("bill.tapToLog")}
            </span>
          </span>
          <Icon name="chevronRight" size={16} strokeWidth={2} className="shrink-0 text-faint" />
        </button>
      ))}
      <BillSheet sub={picked?.sub ?? null} due={picked?.due} onClose={() => setPicked(null)} />
    </>
  )
}

/**
 * Log what a bill came to this time. With `due` (a round that is waiting) it
 * also offers to skip that round.
 */
export function BillSheet({ sub, due, onClose }: { sub: Subscription | null; due?: string; onClose: () => void }) {
  const { t } = useTranslation()
  return (
    <Sheet open={!!sub} onClose={onClose} title={sub ? t("bill.payTitle", { name: sub.name }) : ""}>
      {/* Remount per bill so the fields start empty. */}
      {sub ? <BillFields key={`${sub.id}:${due ?? ""}`} sub={sub} due={due} onDone={onClose} /> : null}
    </Sheet>
  )
}

function BillFields({ sub, due, onDone }: { sub: Subscription; due?: string; onDone: () => void }) {
  const { t } = useTranslation()
  const accounts = useStore((s) => s.accounts)
  const transactions = useStore((s) => s.transactions)
  const payBill = useStore((s) => s.payBill)
  const skipBill = useStore((s) => s.skipBill)
  const today = todayISO()
  const [text, setText] = useState("")
  const [accountId, setAccountId] = useState(sub.accountId)
  const [date, setDate] = useState(today)
  const [sheet, setSheet] = useState<"" | "account" | "date">("")
  const value = parseFloat(text) || 0
  const average = useMemo(() => billAverage(sub, transactions), [sub, transactions])

  return (
    <>
      {due ? <p className="text-sm text-muted">{t("bill.payLead", { date: shortDate(due) })}</p> : null}
      <Card className="flex flex-col gap-1 px-4 py-3">
        <label className="flex items-baseline gap-2">
          <span className="shrink-0 text-[13px] text-muted">{t("bill.amount")}</span>
          <span className="flex grow items-baseline justify-end gap-0.5 font-mono text-[26px] font-semibold">
            ฿
            <BahtInput
              value={text}
              onChange={(e) => setText(e.target.value.replace(/[^0-9.]/g, ""))}
              placeholder="0"
              aria-label={t("bill.amount")}
              className="w-full min-w-0 bg-transparent text-right outline-none"
            />
          </span>
        </label>
        <span className="text-right text-xs text-muted">
          {average === null
            ? t("bill.estimate", { amount: baht(sub.amount) })
            : t("bill.lastAndAverage", { last: baht(sub.amount), average: baht(average) })}
        </span>
      </Card>
      <ListCard>
        <PickerRow
          label={t("rec.payFrom")}
          value={accounts.find((a) => a.id === accountId)?.name ?? t("common.selectAccount")}
          onClick={() => setSheet("account")}
        />
        <PickerRow
          label={t("bill.paidOn")}
          value={date === today ? t("common.today") : shortDate(date)}
          onClick={() => setSheet("date")}
        />
      </ListCard>
      <PrimaryButton
        disabled={!value || !accountId}
        onClick={() => {
          if (payBill(sub.id, { amount: value, accountId, date })) onDone()
        }}
      >
        {t("bill.save")}
      </PrimaryButton>
      {due ? (
        <SecondaryButton
          onClick={() => {
            skipBill(sub.id, due)
            onDone()
          }}
        >
          {t("bill.skip")}
        </SecondaryButton>
      ) : null}
      <AccountSheet
        open={sheet === "account"}
        onClose={() => setSheet("")}
        title={t("rec.payFrom")}
        value={accountId}
        onPick={setAccountId}
      />
      <DateSheet
        open={sheet === "date"}
        onClose={() => setSheet("")}
        title={t("bill.paidOn")}
        value={date}
        max={today}
        onChange={setDate}
      />
    </>
  )
}
