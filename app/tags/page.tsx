"use client"

import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { PushScreen, TxRow } from "@/components/app"
import { CurrencySheet } from "@/components/CurrencySheet"
import { TxDetailSheet } from "@/components/TxDetailSheet"
import { Icon } from "@/components/ui/Icon"
import { Card, Empty, ListCard, PickerRow, PrimaryButton, PushHeader, Sheet } from "@/components/ui/primitives"
import { categoryLabel } from "@/lib/constants"
import { formatForeign, type FxCurrency } from "@/lib/currencies"
import { baht, shortDate } from "@/lib/format"
import { useGoBack } from "@/lib/nav"
import { spendByCategory } from "@/lib/selectors"
import { useStore } from "@/lib/store"
import { tagSummaries, type TagSummary } from "@/lib/tags"
import type { Transaction } from "@/lib/types"

/** Trips and projects: what each tag cost, over whatever months it spans. */
export default function TagsPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const goBack = useGoBack("/insights")
  const transactions = useStore((s) => s.transactions)
  const tags = useMemo(() => tagSummaries(transactions), [transactions])
  const [open, setOpen] = useState<TagSummary | null>(null)
  const [shown, setShown] = useState<TagSummary | null>(null)
  if (open && open !== shown) setShown(open)
  const [selected, setSelected] = useState<Transaction | null>(null)
  const entries = useMemo(
    () =>
      shown
        ? transactions
            .filter((x) => x.tag === shown.tag)
            .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
        : [],
    [transactions, shown],
  )
  const byCat = useMemo(() => Object.entries(spendByCategory(entries)).sort((a, b) => b[1] - a[1]), [entries])
  const tripCurrencies = useStore((s) => s.settings.tripCurrencies)
  const tripCur = shown ? tripCurrencies?.[shown.tag] : undefined
  const [pickingCur, setPickingCur] = useState(false)
  // What was logged in the trip's currency, in that currency.
  const origTotal = useMemo(
    () =>
      tripCur
        ? entries
            .filter((x) => x.type === "out" && x.origCurrency === tripCur)
            .reduce((a, x) => a + (x.origAmount ?? 0), 0)
        : 0,
    [entries, tripCur],
  )
  const setTripCur = (tag: string, c: FxCurrency | "") => {
    const { setSettings, notify } = useStore.getState()
    const before = tripCurrencies ?? {}
    const next = { ...before }
    if (c) next[tag] = c
    else delete next[tag]
    setSettings({ tripCurrencies: next })
    notify(c ? t("fxEntry.tripSet", { tag, currency: t(`currency.${c}`) }) : t("fxEntry.tripCleared", { tag }), {
      action: { label: t("common.undo"), run: () => useStore.getState().setSettings({ tripCurrencies: before }) },
    })
  }

  return (
    <PushScreen>
      <PushHeader title={t("tags.title")} onBack={goBack} />
      <p className="flex items-start gap-2 text-xs leading-relaxed text-muted">
        <Icon name="tag" size={16} strokeWidth={2} className="mt-px shrink-0" />
        {t("tags.hint")}
      </p>
      {tags.length ? (
        tags.map((g) => (
          <button key={g.tag} type="button" onClick={() => setOpen(g)} className="text-left">
            <Card className="flex items-center gap-3 px-4 py-3.5">
              <span className="flex min-w-0 grow flex-col">
                <span className="truncate text-[15px] font-semibold">{g.tag}</span>
                <span className="text-xs text-muted">
                  {g.from === g.to ? shortDate(g.from) : `${shortDate(g.from)} – ${shortDate(g.to)}`} ·{" "}
                  {t("common.items", { count: g.count })}
                </span>
              </span>
              <span className="font-mono text-[15px] font-semibold">{baht(g.spent)}</span>
              <Icon name="chevronRight" size={16} strokeWidth={2} className="text-faint" />
            </Card>
          </button>
        ))
      ) : (
        <Empty>{t("tags.empty")}</Empty>
      )}

      <Sheet open={!!open && !selected && !pickingCur} onClose={() => setOpen(null)} title={shown?.tag ?? ""}>
        {shown ? (
          <>
            <p className="text-sm text-muted">
              {t("tags.total", { amount: baht(shown.spent), count: shown.count })}
              {tripCur && origTotal ? (
                <>
                  <br />
                  {t("fxEntry.origTotal", { currency: tripCur, amount: formatForeign(origTotal, tripCur) })}
                </>
              ) : null}
            </p>
            {byCat.length ? (
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
                {byCat.map(([key, amount]) => (
                  <span key={key}>
                    {categoryLabel(key)} <span className="font-mono font-semibold text-ink">{baht(amount)}</span>
                  </span>
                ))}
              </div>
            ) : null}
            <div className="flex flex-col gap-1">
              <PickerRow
                label={t("fxEntry.tripCurrency")}
                value={tripCur ? `${tripCur} · ${t(`currency.${tripCur}`)}` : t("currency.THB")}
                onClick={() => setPickingCur(true)}
              />
              <span className="text-xs leading-relaxed text-muted">{t("fxEntry.tripCurrencyHint")}</span>
            </div>
            <PrimaryButton onClick={() => router.push(`/tags/split?tag=${encodeURIComponent(shown.tag)}`)}>
              <span className="flex items-center justify-center gap-2">
                <Icon name="users" size={18} strokeWidth={2} />
                {t("trip.open")}
              </span>
            </PrimaryButton>
            <ListCard>
              {entries.map((x) => (
                <TxRow key={x.id} t={x} onClick={() => setSelected(x)} />
              ))}
            </ListCard>
          </>
        ) : null}
      </Sheet>
      <TxDetailSheet tx={selected} onClose={() => setSelected(null)} />
      <CurrencySheet
        open={!!open && pickingCur}
        onClose={() => setPickingCur(false)}
        title={t("fxEntry.tripCurrency")}
        value={tripCur ?? ""}
        onPick={(c) => {
          if (shown && c !== (tripCur ?? "")) setTripCur(shown.tag, c)
        }}
      />
    </PushScreen>
  )
}
