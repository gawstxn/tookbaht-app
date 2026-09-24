"use client";

import { useState } from "react";
import { AccountSheet, CategorySheet, DateSheet } from "@/components/pickers";
import { Card, Chip, ListCard, PickerRow, PrimaryButton, PushHeader, Segmented, SwitchRow } from "@/components/ui/primitives";
import { PushScreen } from "@/components/app";
import { MONO_TONES, POPULAR_SUBS, SUB_CATEGORIES } from "@/lib/constants";
import { baht, fromISO, monthlyEquivalent, shortDate, todayISO, TH_MONTHS_SHORT } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { Cycle, Subscription } from "@/lib/types";

export type SubDraft = Omit<Subscription, "id">;

/** Stable colour per service name. */
function toneFor(name: string) {
  let h = 0;
  for (const ch of name.trim().toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return MONO_TONES[h % MONO_TONES.length];
}

export function SubscriptionForm({
  title,
  initial,
  onSave,
  onBack,
  saveLabel,
  lockStart,
}: {
  title: string;
  initial?: SubDraft;
  onSave: (s: SubDraft) => void;
  onBack: () => void;
  saveLabel: string;
  /** When editing, allow past start dates. */
  lockStart?: boolean;
}) {
  const accounts = useStore((s) => s.accounts);
  const today = todayISO();
  const [d, setD] = useState<SubDraft>(
    initial ?? {
      name: "",
      amount: 0,
      cycle: "month",
      startDate: today,
      accountId: accounts.find((a) => a.kind === "credit")?.id ?? accounts[0]?.id ?? "",
      category: "fun",
      remind: true,
      autoLog: true,
      paused: false,
      tone: MONO_TONES[0],
    },
  );
  const [amountText, setAmountText] = useState(initial ? String(initial.amount) : "");
  const [sheet, setSheet] = useState<"" | "date" | "account" | "category">("");
  const set = (p: Partial<SubDraft>) => setD((x) => ({ ...x, ...p }));

  const monthly = monthlyEquivalent(d.amount, d.cycle);
  const canSave = d.name.trim().length > 0 && d.amount > 0 && !!d.accountId;
  const start = fromISO(d.startDate);
  const hint =
    d.cycle === "week"
      ? "หลังจากนั้นตัดบัญชีทุกสัปดาห์"
      : d.cycle === "year"
        ? `หลังจากนั้นตัดบัญชีทุกปี วันที่ ${start.getDate()} ${TH_MONTHS_SHORT[start.getMonth()]}`
        : `หลังจากนั้นตัดบัญชีทุกวันที่ ${start.getDate()} ของเดือน`;

  return (
    <PushScreen className="gap-3.5">
      <PushHeader title={title} backIcon="close" onBack={onBack} />

      <div className="flex items-center gap-3.5">
        <span aria-hidden="true" className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-ink text-2xl font-bold text-lime">
          {(d.name.trim()[0] ?? "?").toUpperCase()}
        </span>
        <div className="flex min-w-0 grow flex-col gap-0.5">
          <label htmlFor="subname" className="text-xs text-muted">
            ชื่อบริการ
          </label>
          <input
            id="subname"
            value={d.name}
            onChange={(e) => set({ name: e.target.value })}
            placeholder="เช่น Netflix, ค่ายิม"
            className="min-h-9 w-full border-b border-[#d0cbbf] bg-transparent pb-1 font-serif text-[22px] font-bold outline-none"
          />
        </div>
      </div>

      <div aria-label="เลือกจากบริการยอดนิยม" className="flex flex-wrap gap-1.5">
        {POPULAR_SUBS.map((n) => (
          <Chip key={n} size="sm" on={d.name === n} onClick={() => set({ name: n })}>
            {n}
          </Chip>
        ))}
      </div>

      <Card className="flex flex-col gap-3 px-4 py-3.5">
        <label className="flex items-baseline gap-2">
          <span className="shrink-0 text-[13px] text-muted">ราคา</span>
          <span className="flex grow items-baseline gap-0.5 font-mono text-[30px] font-semibold">
            ฿
            <input
              inputMode="decimal"
              value={amountText}
              onChange={(e) => {
                const v = e.target.value.replace(/[^0-9.]/g, "");
                setAmountText(v);
                set({ amount: parseFloat(v) || 0 });
              }}
              placeholder="0"
              className="w-full min-w-0 bg-transparent outline-none"
            />
          </span>
        </label>
        <Segmented<Cycle>
          size="sm"
          label="รอบการชำระ"
          value={d.cycle}
          onChange={(cycle) => set({ cycle })}
          options={[
            { value: "week", label: "รายสัปดาห์" },
            { value: "month", label: "รายเดือน" },
            { value: "year", label: "รายปี" },
          ]}
        />
      </Card>

      <ListCard>
        <PickerRow label={lockStart ? "เริ่มตัดบัญชี" : "ตัดบัญชีครั้งแรก"} value={shortDate(d.startDate)} onClick={() => setSheet("date")} />
        <PickerRow label="ชำระจาก" value={accounts.find((a) => a.id === d.accountId)?.name ?? "เลือกบัญชี"} onClick={() => setSheet("account")} />
        <PickerRow label="หมวดหมู่" value={SUB_CATEGORIES.find((c) => c.key === d.category)?.label ?? ""} onClick={() => setSheet("category")} />
      </ListCard>

      <ListCard>
        <SwitchRow label="แจ้งเตือนก่อนตัดบัญชี 1 วัน" checked={d.remind} onChange={(remind) => set({ remind })} />
        <SwitchRow label="บันทึกเป็นรายจ่ายอัตโนมัติ" checked={d.autoLog} onChange={(autoLog) => set({ autoLog })} />
      </ListCard>

      <div className="mt-auto flex flex-col gap-2.5">
        <p className="flex justify-center gap-1.5 text-[13px] text-muted">
          เฉลี่ย <span className="font-mono font-semibold text-ink">{baht(monthly)}</span> / เดือน ·
          <span className="font-mono font-semibold text-ink">{baht(monthly * 12)}</span> / ปี
        </p>
        <PrimaryButton disabled={!canSave} onClick={() => onSave({ ...d, name: d.name.trim(), tone: initial?.tone ?? toneFor(d.name) })}>
          {saveLabel}
        </PrimaryButton>
      </div>

      <DateSheet
        open={sheet === "date"}
        onClose={() => setSheet("")}
        title={lockStart ? "เริ่มตัดบัญชี" : "ตัดบัญชีครั้งแรก"}
        value={d.startDate}
        onChange={(startDate) => set({ startDate })}
        min={lockStart ? undefined : today}
        hint={hint}
      />
      <AccountSheet open={sheet === "account"} onClose={() => setSheet("")} title="ชำระจาก" value={d.accountId} onPick={(accountId) => set({ accountId })} />
      <CategorySheet open={sheet === "category"} onClose={() => setSheet("")} title="หมวดหมู่" options={SUB_CATEGORIES} value={d.category} onPick={(category) => set({ category })} />
    </PushScreen>
  );
}
