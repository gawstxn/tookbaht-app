"use client"

import { useTranslation } from "react-i18next"
import Link from "next/link"
import { useState } from "react"
import { AccountMark, PushScreen } from "@/components/app"
import { AccountEditSheet, MAX_ACCOUNTS } from "@/components/AccountEditSheet"
import { ReconcileSheet } from "@/components/ReconcileSheet"
import { Icon } from "@/components/ui/Icon"
import { IconButton, ListCard, PushHeader } from "@/components/ui/primitives"
import { CASHFLOW_DAYS } from "@/lib/cashflow"
import { baht, shortDate, todayISO } from "@/lib/format"
import { accountBalance, accountDeleteBlock, accountDue, creditSummary } from "@/lib/selectors"
import { deleteBlockedText } from "@/components/accountDeleteText"
import { useStore } from "@/lib/store"

export default function AccountsPage() {
  const { t } = useTranslation()
  const { accounts, transactions, subscriptions, addAccount, updateAccount, removeAccount, notify } = useStore()
  // "" = closed, "new" = adding, otherwise the account id being edited.
  const [editing, setEditing] = useState("")
  const current = accounts.find((a) => a.id === editing)
  const today = todayISO()
  /** "ครบกำหนด 5 ต.ค. · ค้างจ่าย ฿1,000" for cards and pay-later with a due day and something owed. */
  const dueLine = (a: (typeof accounts)[number]) => {
    const d = accountDue(a, transactions, today, subscriptions)
    return d && d.owed > 0 ? t("accounts.dueLine", { date: shortDate(d.due, false), amount: baht(d.owed) }) : null
  }
  const [reconciling, setReconciling] = useState("")
  const addNew = () => {
    if (accounts.length >= MAX_ACCOUNTS) notify(t("accounts.full", { count: MAX_ACCOUNTS }), { tone: "error" })
    else setEditing("new")
  }

  return (
    <PushScreen>
      <PushHeader
        title={t("accounts.title")}
        backHref="/profile"
        action={<IconButton icon="plus" label={t("accounts.add")} onClick={addNew} />}
      />

      <ListCard>
        {accounts.map((a) => {
          const row = (
            <>
              <AccountMark account={a} size={38} />
              <span className="flex min-w-0 grow flex-col">
                <span className="truncate text-[15px] font-medium">{a.name}</span>
                <span className="text-xs text-muted">
                  {dueLine(a) ?? t(a.kind === "saving" ? "kind.savingLong" : `kind.${a.kind}`)}
                </span>
              </span>
              {a.kind === "credit" ? (
                <span className="flex flex-col items-end">
                  <span className="font-mono text-sm font-semibold">
                    {baht(creditSummary(a, transactions, subscriptions, today).available)}
                  </span>
                  <span className="text-[11px] text-muted">{t("pay.available")}</span>
                </span>
              ) : (
                <span className="font-mono text-sm font-semibold">{baht(accountBalance(a, transactions))}</span>
              )}
              <Icon name="chevronRight" size={16} strokeWidth={2} className="text-faint" />
            </>
          )
          const cls = "flex min-h-[64px] w-full items-center gap-3 text-left"
          // Cards and pay-later open their own page (credit, bill, installments); the rest edit in place.
          return a.kind === "credit" ? (
            <Link key={a.id} href={`/accounts/${a.id}`} className={cls}>
              {row}
            </Link>
          ) : (
            <button key={a.id} type="button" onClick={() => setEditing(a.id)} className={cls}>
              {row}
            </button>
          )
        })}
      </ListCard>
      <p className="text-center text-xs text-muted">{t("accounts.deleteHint")}</p>

      <Link
        href="/cashflow"
        className="flex min-h-[64px] items-center gap-3 rounded-[20px] border border-line bg-card px-4"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-chip">
          <Icon name="calendar" size={17} strokeWidth={2} />
        </span>
        <span className="flex min-w-0 grow flex-col">
          <span className="text-[15px] font-semibold">{t("cashflow.open")}</span>
          <span className="text-xs text-muted">{t("cashflow.openHint", { count: CASHFLOW_DAYS })}</span>
        </span>
        <Icon name="chevronRight" size={16} strokeWidth={2} className="text-faint" />
      </Link>

      <AccountEditSheet
        open={editing !== ""}
        onClose={() => setEditing("")}
        initial={current}
        onSave={(a) => {
          if (current) updateAccount(current.id, a)
          else addAccount(a)
          setEditing("")
        }}
        onReconcile={
          current
            ? () => {
                setEditing("")
                setReconciling(current.id)
              }
            : undefined
        }
        deleteBlocked={
          current ? deleteBlockedText(accountDeleteBlock(current.id, accounts, transactions, subscriptions)) : null
        }
        onDelete={
          current
            ? () => {
                setEditing("")
                void removeAccount(current.id)
              }
            : undefined
        }
      />
      <ReconcileSheet account={accounts.find((a) => a.id === reconciling)} onClose={() => setReconciling("")} />
    </PushScreen>
  )
}
