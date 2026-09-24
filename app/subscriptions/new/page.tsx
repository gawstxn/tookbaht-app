"use client";

import { useRouter } from "next/navigation";
import { SubscriptionForm } from "@/components/SubscriptionForm";
import { useStore } from "@/lib/store";

export default function NewSubscriptionPage() {
  const router = useRouter();
  const add = useStore((s) => s.addSubscription);
  return (
    <SubscriptionForm
      title="เพิ่ม subscription"
      saveLabel="บันทึก subscription"
      onBack={() => router.back()}
      onSave={(s) => {
        add(s);
        router.replace("/subscriptions");
      }}
    />
  );
}
