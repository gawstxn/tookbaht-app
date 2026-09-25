"use client";

import { useState } from "react";
import { AccountSheet, CategorySheet, DateSheet } from "@/components/pickers";
import { Icon } from "@/components/ui/Icon";
import { Card, Chip, Empty, ListCard, PickerRow, PrimaryButton, PushHeader, Segmented, Sheet, SwitchRow } from "@/components/ui/primitives";
import { BrandMark, PushScreen, SubMono } from "@/components/app";
import { findBrand, normalizeName, suggestCategory } from "@/lib/brands";
import { MONO_TONES, POPULAR_SUBS, SUB_CATALOG, SUB_CATEGORIES } from "@/lib/constants";
import { baht, fromISO, monthlyEquivalent, shortDate, todayISO, TH_MONTHS_SHORT } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { Cycle, Subscription } from "@/lib/types";

export type SubDraft = Omit<Subscription, "id">;

/** Brand colour for known services, otherwise a stable colour per name. */
function toneFor(name: string) {
  const brand = findBrand(name);
  if (brand) return brand.color;
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
}: {
  title: string;
  initial?: SubDraft;
  onSave: (s: SubDraft) => void;
  onBack: () => void;
  saveLabel: string;
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
  const [sheet, setSheet] = useState<"" | "date" | "account" | "category" | "catalog">("");
  const pick = (n: string) => set({ name: n, category: suggestCategory(n) ?? d.category });
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
        {findBrand(d.name) ? (
          <SubMono s={{ name: d.name, tone: toneFor(d.name) }} size={56} />
        ) : (
          <span aria-hidden="true" className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-ink text-2xl font-bold text-lime">
            {(d.name.trim()[0] ?? "?").toUpperCase()}
          </span>
        )}
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
        {POPULAR_SUBS.map((n) => {
          const brand = findBrand(n);
          return (
            <Chip key={n} size="sm" on={d.name === n} onClick={() => pick(n)}>
              <span className="flex items-center gap-1.5">
                {brand ? <BrandMark brand={brand} size={18} /> : null}
                {n}
              </span>
            </Chip>
          );
        })}
        <Chip size="sm" on={false} onClick={() => setSheet("catalog")}>
          <span className="flex items-center gap-1">
            ดูทั้งหมด
            <Icon name="chevronRight" size={14} strokeWidth={2.2} />
          </span>
        </Chip>
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
        <PickerRow label="เริ่มตัดบัญชี" value={shortDate(d.startDate)} onClick={() => setSheet("date")} />
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
        <PrimaryButton
          once
          disabled={!canSave}
          onClick={() => {
            const name = d.name.trim();
            // Keep a custom colour on edit unless the name now matches a known service.
            const tone = findBrand(name) || !initial ? toneFor(name) : initial.tone;
            onSave({ ...d, name, tone });
          }}
        >
          {saveLabel}
        </PrimaryButton>
      </div>

      <DateSheet
        open={sheet === "date"}
        onClose={() => setSheet("")}
        title="เริ่มตัดบัญชี"
        value={d.startDate}
        onChange={(startDate) => set({ startDate })}
        hint={d.startDate < today ? `${hint} · รอบก่อนวันนี้จะไม่ถูกบันทึกย้อนหลัง` : hint}
      />
      <AccountSheet open={sheet === "account"} onClose={() => setSheet("")} title="ชำระจาก" value={d.accountId} onPick={(accountId) => set({ accountId })} />
      <CatalogSheet
        open={sheet === "catalog"}
        onClose={() => setSheet("")}
        onPick={(n) => {
          pick(n);
          setSheet("");
        }}
      />
      <CategorySheet open={sheet === "category"} onClose={() => setSheet("")} title="หมวดหมู่" options={SUB_CATEGORIES} value={d.category} onPick={(category) => set({ category })} />
    </PushScreen>
  );
}

/** Full list of known services, grouped, with search. */
function CatalogSheet({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (name: string) => void }) {
  const [q, setQ] = useState("");
  const query = normalizeName(q);
  const groups = SUB_CATALOG.map((g) => ({ ...g, names: g.names.filter((n) => !query || normalizeName(n).includes(query)) })).filter((g) => g.names.length);
  return (
    <Sheet open={open} onClose={onClose} title="เลือกบริการ">
      <label className="flex min-h-11 items-center gap-2 rounded-xl border border-line bg-card px-3">
        <Icon name="search" size={16} strokeWidth={2} className="text-faint" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหา เช่น Netflix, AIS" aria-label="ค้นหาบริการ" className="min-w-0 grow bg-transparent text-sm outline-none" />
      </label>
      {groups.length === 0 ? <Empty>ไม่พบ ลองพิมพ์ชื่อเองในช่องชื่อบริการได้เลย</Empty> : null}
      {groups.map((g) => (
        <section key={g.title} className="flex flex-col gap-1.5">
          <h3 className="text-[13px] font-semibold text-muted">{g.title}</h3>
          <ListCard>
            {g.names.map((n) => (
              <button key={n} type="button" onClick={() => onPick(n)} className="flex min-h-[52px] w-full items-center gap-3 text-left">
                <SubMono s={{ name: n, tone: toneFor(n) }} size={32} />
                <span className="grow text-[15px]">{n}</span>
              </button>
            ))}
          </ListCard>
        </section>
      ))}
    </Sheet>
  );
}
