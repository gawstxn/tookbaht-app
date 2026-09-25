"use client";

import { useParams, useRouter } from "next/navigation";
import { RecurringForm } from "@/components/RecurringForm";
import { SubscriptionForm } from "@/components/SubscriptionForm";
import { Empty } from "@/components/ui/primitives";
import { useTranslation } from "react-i18next";
import { useStore } from "@/lib/store";

export default function EditSubscriptionPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const sub = useStore((s) => s.subscriptions.find((x) => x.id === id));
  const update = useStore((s) => s.updateSubscription);
  const { t: tr } = useTranslation();
  if (!sub) return <Empty>{tr("subs.notFound")}</Empty>;
  const { id: _omit, ...initial } = sub;
  void _omit;
  const save = (patch: Partial<typeof initial>) => {
    update(sub.id, patch);
    router.replace(`/subscriptions/${sub.id}`);
  };
  if (sub.kind === "recurring") {
    return <RecurringForm title={tr("rec.edit")} saveLabel={tr("subs.saveEdit")} initial={initial} onBack={() => router.back()} onSave={save} />;
  }
  return (
    <SubscriptionForm
      title={tr("subs.edit")}
      saveLabel={tr("subs.saveEdit")}
      initial={initial}
      onBack={() => router.back()}
      onSave={save}
    />
  );
}
