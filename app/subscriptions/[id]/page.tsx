"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { PushScreen, SubMono } from "@/components/app";
import { Empty, ListCard, PrimaryButton, PushHeader, SecondaryButton, Sheet, SwitchRow } from "@/components/ui/primitives";
import { SUB_CATEGORIES } from "@/lib/constants";
import { baht2, cycleLabel, cyclePer, diffDays, dueDatesUntil, fromISO, nextDueDate, relativeDue, shortDate, todayISO } from "@/lib/format";
import { useStore } from "@/lib/store";

export default function SubscriptionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const sub = useStore((s) => s.subscriptions.find((x) => x.id === id));
  const accounts = useStore((s) => s.accounts);
  const update = useStore((s) => s.updateSubscription);
  const remove = useStore((s) => s.deleteSubscription);
  const [confirm, setConfirm] = useState(false);
  const today = todayISO();

  if (!sub) {
    return (
      <PushScreen>
        <PushHeader backHref="/subscriptions" />
        <Empty>ไม่พบ subscription นี้</Empty>
      </PushScreen>
    );
  }

  const due = nextDueDate(sub.startDate, sub.cycle, today);
  const days = diffDays(due, today);
  const history = dueDatesUntil(sub.startDate, sub.cycle, today).reverse().slice(0, 3);
  const start = fromISO(sub.startDate);
  const dayRule = sub.cycle === "week" ? "ทุกสัปดาห์" : sub.cycle === "year" ? `ทุกปี ${shortDate(sub.startDate, false)}` : `ทุกวันที่ ${start.getDate()}`;

  return (
    <PushScreen>
      <PushHeader
        backHref="/subscriptions"
        action={
          <Link href={`/subscriptions/${sub.id}/edit`} className="flex min-h-11 items-center rounded-full border border-line bg-card px-4 text-sm font-semibold">
            แก้ไข
          </Link>
        }
      />

      <section className="flex flex-col items-center gap-1.5 py-1">
        <SubMono s={sub} size={64} />
        <h1 className="mt-1 font-serif text-2xl font-bold">{sub.name}</h1>
        <span className="font-mono text-[30px] font-semibold tracking-tight">
          {baht2(sub.amount).replace(".00", "")}
          <span className="font-sans text-[15px] font-medium tracking-normal text-muted"> {cyclePer(sub.cycle)}</span>
        </span>
        <span className="rounded-full bg-chip px-3 py-1 text-[13px] font-semibold">
          {sub.paused ? "หยุดชั่วคราวอยู่" : `ตัดบัญชีครั้งถัดไป ${shortDate(due)} · ${relativeDue(days)}`}
        </span>
      </section>

      <ListCard>
        <Row label="รอบการชำระ" value={cycleLabel(sub.cycle)} />
        <Row label="วันที่ตัดบัญชี" value={dayRule} />
        <Row label="ชำระจาก" value={accounts.find((a) => a.id === sub.accountId)?.name ?? "—"} />
        <Row label="หมวดหมู่" value={SUB_CATEGORIES.find((c) => c.key === sub.category)?.label ?? "—"} />
      </ListCard>

      <ListCard>
        <SwitchRow label="แจ้งเตือนก่อนตัดบัญชี" hint="ล่วงหน้า 1 วัน" checked={sub.remind} onChange={(remind) => update(sub.id, { remind })} />
        <SwitchRow label="บันทึกเป็นรายจ่ายอัตโนมัติ" hint="เพิ่มในรายการเมื่อถึงวันตัดบัญชี" checked={sub.autoLog} onChange={(autoLog) => update(sub.id, { autoLog })} />
      </ListCard>

      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold">ประวัติการชำระ</h2>
        {history.length ? (
          <ListCard>
            {history.map((d) => (
              <div key={d} className="flex min-h-11 items-center justify-between text-sm">
                <span>{shortDate(d)}</span>
                <span className="font-mono font-semibold text-expense">−{baht2(sub.amount)}</span>
              </div>
            ))}
          </ListCard>
        ) : (
          <Empty>ยังไม่ถึงรอบตัดบัญชีแรก</Empty>
        )}
      </section>

      <div className="mt-auto grid grid-cols-2 gap-2">
        <SecondaryButton onClick={() => update(sub.id, { paused: !sub.paused })}>{sub.paused ? "ใช้งานต่อ" : "หยุดชั่วคราว"}</SecondaryButton>
        <SecondaryButton tone="danger" onClick={() => setConfirm(true)}>
          ยกเลิกการสมัคร
        </SecondaryButton>
      </div>

      <Sheet open={confirm} onClose={() => setConfirm(false)} title={`ยกเลิก ${sub.name}?`}>
        <p className="text-sm text-muted">ลบ subscription นี้ออกจากรายการ รายจ่ายที่บันทึกไปแล้วยังอยู่ในประวัติ</p>
        <PrimaryButton
          tone="danger"
          onClick={() => {
            remove(sub.id);
            router.replace("/subscriptions");
          }}
        >
          ยกเลิกการสมัคร
        </PrimaryButton>
        <SecondaryButton onClick={() => setConfirm(false)}>เก็บไว้</SecondaryButton>
      </Sheet>
    </PushScreen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-11 items-center justify-between text-sm">
      <span className="text-muted">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
