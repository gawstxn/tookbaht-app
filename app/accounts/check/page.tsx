"use client"

import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { AccountMark, PushScreen } from "@/components/app"
import { BahtInput } from "@/components/BahtInput"
import { PrimaryButton, PushHeader, SecondaryButton, cx } from "@/components/ui/primitives"
import { baht2, todayISO } from "@/lib/format"
import { checkEntries, checkMonth } from "@/lib/monthCheck"
import { useGoBack } from "@/lib/nav"
import { accountBalance, reconcileEntry } from "@/lib/selectors"
import { useStore } from "@/lib/store"

/** Month-end check: type each account's real balance; the differences are logged in one go. */
export default function MonthCheckPage() {
  const { t } = useTranslation()
  const goBack = useGoBack("/accounts")
  const accounts = useStore((s) => s.accounts)
  const txs = useStore((s) => s.transactions)
  const addTransactions = useStore((s) => s.addTransactions)
  const setSettings = useStore((s) => s.setSettings)
  const notify = useStore((s) => s.notify)
  const [actuals, setActuals] = useState<Record<string, string>>({})
  const today = todayISO()
  const title = t("accounts.reconcileTx")
  const entries = useMemo(
    () => checkEntries(accounts, txs, actuals, today, title),
    [accounts, txs, actuals, today, title],
  )

  // The month being checked: the one ending (or just ended) around today, else the current one.
  const finish = () => setSettings({ balanceCheckedMonth: checkMonth(today) ?? today.slice(0, 7) })

  return (
    <PushScreen>
      <PushHeader title={t("monthCheck.title")} backHref="/accounts" />
      <p className="text-sm text-muted">{t("monthCheck.lead")}</p>

      <div className="flex flex-col rounded-[20px] border border-line bg-card px-4 py-0.5 [&>*:not(:last-child)]:border-b [&>*:not(:last-child)]:border-divider">
        {accounts.map((a) => {
          const text = actuals[a.id] ?? ""
          const entry = text ? reconcileEntry(a, txs, parseFloat(text) || 0, today, title) : null
          return (
            <label key={a.id} className="flex flex-col gap-1.5 py-3">
              <span className="flex items-center gap-3">
                <AccountMark account={a} size={36} />
                <span className="flex min-w-0 grow flex-col">
                  <span className="truncate text-[15px] font-medium">{a.name}</span>
                  <span className="text-xs text-muted">
                    {t("accounts.inApp")} {baht2(accountBalance(a, txs))}
                  </span>
                </span>
                <span className="flex w-[132px] shrink-0 items-baseline justify-end gap-0.5 font-mono text-[18px] font-semibold">
                  ฿
                  <BahtInput
                    value={text}
                    onChange={(e) => setActuals((m) => ({ ...m, [a.id]: e.target.value.replace(/[^0-9.]/g, "") }))}
                    placeholder={t("monthCheck.placeholder")}
                    aria-label={`${a.name} ${t(a.kind === "credit" ? "accounts.actualCredit" : "accounts.actual")}`}
                    className="w-full min-w-0 bg-transparent text-right outline-none placeholder:font-sans placeholder:text-[13px] placeholder:font-normal placeholder:text-faint"
                  />
                </span>
              </span>
              {text ? (
                <span
                  className={cx(
                    "pl-12 text-xs font-semibold",
                    !entry && "text-muted",
                    entry?.type === "in" && "text-income",
                    entry?.type === "out" && "text-expense",
                  )}
                >
                  {entry
                    ? t(entry.type === "in" ? "accounts.willLogIn" : "accounts.willLogOut", {
                        amount: baht2(entry.amount),
                      })
                    : t("accounts.matches")}
                </span>
              ) : null}
            </label>
          )
        })}
      </div>

      <div className="mt-auto flex flex-col gap-2">
        <PrimaryButton
          once
          disabled={entries.length === 0}
          onClick={() => {
            addTransactions(entries)
            finish()
            goBack()
          }}
        >
          {t("monthCheck.save", { count: entries.length })}
        </PrimaryButton>
        {entries.length > 0 ? null : (
          <SecondaryButton
            onClick={() => {
              finish()
              notify(t("monthCheck.done"))
              goBack()
            }}
          >
            {t("monthCheck.allMatch")}
          </SecondaryButton>
        )}
      </div>
    </PushScreen>
  )
}
