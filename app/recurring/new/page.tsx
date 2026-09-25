"use client";

import { useRouter } from "next/navigation";
import { RecurringForm } from "@/components/RecurringForm";
import { useTranslation } from "react-i18next";
import { useStore } from "@/lib/store";

export default function NewRecurringPage() {
  const router = useRouter();
  const add = useStore((s) => s.addSubscription);
  const { t } = useTranslation();
  return (
    <RecurringForm
      title={t("rec.add")}
      saveLabel={t("rec.save")}
      onBack={() => router.back()}
      onSave={(d) => {
        add(d);
        router.replace("/subscriptions");
      }}
    />
  );
}
