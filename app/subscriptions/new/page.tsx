"use client"

import { useRouter } from "next/navigation"
import { SubscriptionForm } from "@/components/SubscriptionForm"
import { useTranslation } from "react-i18next"
import { useGoBack } from "@/lib/nav"
import { useStore } from "@/lib/store"

export default function NewSubscriptionPage() {
  const router = useRouter()
  const goBack = useGoBack("/subscriptions")
  const add = useStore((s) => s.addSubscription)
  const { t: tr } = useTranslation()
  return (
    <SubscriptionForm
      title={tr("subs.add")}
      saveLabel={tr("subs.save")}
      onBack={() => goBack()}
      onSave={(s) => {
        add(s)
        router.replace("/subscriptions")
      }}
    />
  )
}
