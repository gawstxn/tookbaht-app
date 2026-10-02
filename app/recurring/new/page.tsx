"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useState } from "react"
import { RecurringForm, type RecurringDraft } from "@/components/RecurringForm"
import { useTranslation } from "react-i18next"
import { MONO_TONES } from "@/lib/constants"
import { todayISO } from "@/lib/format"
import { recurringCandidates } from "@/lib/habits"
import { useGoBack } from "@/lib/nav"
import { useStore } from "@/lib/store"

export default function NewRecurringPage() {
  return (
    <Suspense>
      <NewRecurring />
    </Suspense>
  )
}

function NewRecurring() {
  const router = useRouter()
  const goBack = useGoBack("/subscriptions")
  const add = useStore((s) => s.addSubscription)
  const { t } = useTranslation()
  const params = useSearchParams()
  // Opened from a "looks like a monthly bill" suggestion: start from that bill.
  const [initial] = useState<RecurringDraft | undefined>(() => {
    const key = params.get("suggest")
    if (!key) return undefined
    const { transactions, subscriptions, accounts } = useStore.getState()
    const c = recurringCandidates(transactions, subscriptions, todayISO()).find((x) => x.key === key)
    if (!c) return undefined
    return {
      kind: "recurring",
      entryType: "out",
      name: c.title,
      amount: c.amount,
      currency: "THB",
      cycle: "month",
      startDate: c.next,
      accountId: c.accountId ?? accounts[0]?.id ?? "",
      toAccountId: null,
      installments: null,
      category: c.category ?? "bill",
      remind: true,
      autoLog: !c.variable,
      paused: false,
      tone: MONO_TONES[5],
      variable: c.variable,
    }
  })
  return (
    <RecurringForm
      title={t("rec.add")}
      saveLabel={t("rec.save")}
      initial={initial}
      onBack={() => goBack()}
      onSave={(d) => {
        add(d)
        router.replace("/subscriptions")
      }}
    />
  )
}
