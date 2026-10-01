"use client"

import Link from "next/link"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { baht, todayISO } from "@/lib/format"
import { recurringCandidates } from "@/lib/habits"
import { useStore } from "@/lib/store"
import { TxIcon } from "./app"
import { Card } from "./ui/primitives"

/** "Looks like a monthly bill": expenses logged by hand every month, offered as recurring entries. */
export function RecurringSuggestions() {
  const { t } = useTranslation()
  const txs = useStore((s) => s.transactions)
  const subs = useStore((s) => s.subscriptions)
  const dismissed = useStore((s) => s.settings.dismissedRecurring)
  const setSettings = useStore((s) => s.setSettings)
  const notify = useStore((s) => s.notify)
  const today = todayISO()
  const list = useMemo(
    () => recurringCandidates(txs, subs, today, dismissed).slice(0, 2),
    [txs, subs, today, dismissed],
  )
  if (!list.length) return null

  const dismiss = (key: string, title: string) => {
    const before = dismissed ?? []
    setSettings({ dismissedRecurring: [...before, key].slice(-100) })
    notify(t("suggest.dismissed", { name: title }), {
      action: { label: t("common.undo"), run: () => setSettings({ dismissedRecurring: before }) },
    })
  }

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-base font-semibold">{t("suggest.title")}</h2>
      {list.map((c) => (
        <Card key={c.key} className="flex flex-col gap-3 px-4 py-3.5">
          <div className="flex items-center gap-3">
            <TxIcon type="out" category={c.category} size={36} />
            <span className="flex min-w-0 grow flex-col">
              <span className="truncate text-[15px] font-semibold">{c.title}</span>
              <span className="text-xs text-muted">{t("suggest.detail", { day: c.day, count: c.months })}</span>
            </span>
            <span className="font-mono text-[15px] font-semibold">{baht(c.amount)}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => dismiss(c.key, c.title)}
              className="min-h-10 rounded-xl border border-line bg-card text-[13px] font-semibold"
            >
              {t("suggest.no")}
            </button>
            <Link
              href={`/recurring/new?suggest=${encodeURIComponent(c.key)}`}
              className="flex min-h-10 items-center justify-center rounded-xl bg-ink text-[13px] font-semibold text-on-ink"
            >
              {t("suggest.yes")}
            </Link>
          </div>
        </Card>
      ))}
    </section>
  )
}
