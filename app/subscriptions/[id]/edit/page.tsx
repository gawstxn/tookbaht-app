"use client";

import { useParams, useRouter } from "next/navigation";
import { SubscriptionForm } from "@/components/SubscriptionForm";
import { Empty } from "@/components/ui/primitives";
import { useStore } from "@/lib/store";

export default function EditSubscriptionPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const sub = useStore((s) => s.subscriptions.find((x) => x.id === id));
  const update = useStore((s) => s.updateSubscription);
  if (!sub) return <Empty>ไม่พบ subscription นี้</Empty>;
  const { id: _omit, ...initial } = sub;
  void _omit;
  return (
    <SubscriptionForm
      title="แก้ไข subscription"
      saveLabel="บันทึกการแก้ไข"
      initial={initial}
      lockStart
      onBack={() => router.back()}
      onSave={(s) => {
        update(sub.id, s);
        router.replace(`/subscriptions/${sub.id}`);
      }}
    />
  );
}
