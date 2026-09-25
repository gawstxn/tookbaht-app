"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { PushScreen } from "@/components/app";
import { AccountSheet, DateSheet } from "@/components/pickers";
import { Icon } from "@/components/ui/Icon";
import { Chip, PrimaryButton, PushHeader, Segmented, cx } from "@/components/ui/primitives";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, TYPE_META } from "@/lib/constants";
import { addDays, shortDate, todayISO } from "@/lib/format";
import { accountBalance } from "@/lib/selectors";
import { useStore } from "@/lib/store";
import type { TxType } from "@/lib/types";

const COPY: Record<TxType, { amountLabel: string; save: string; acc: string; note: string }> = {
  out: { amountLabel: "จำนวนเงินที่จ่าย", save: "บันทึกรายจ่าย", acc: "จ่ายจาก", note: "เช่น มื้อกลางวันกับทีม" },
  in: { amountLabel: "จำนวนเงินที่ได้รับ", save: "บันทึกรายรับ", acc: "เข้าบัญชี", note: "เช่น ค่าจ้างงานเดือนนี้" },
  move: { amountLabel: "จำนวนเงินที่โอน", save: "บันทึกการโอน", acc: "", note: "เช่น เก็บเงินเที่ยวสิ้นปี" },
};

export default function AddPage() {
  return (
    <Suspense>
      <AddForm />
    </Suspense>
  );
}

function AddForm() {
  const router = useRouter();
  const params = useSearchParams();
  const initialType = (["in", "out", "move"].includes(params.get("type") ?? "") ? params.get("type") : "out") as TxType;

  const accounts = useStore((s) => s.accounts);
  const txs = useStore((s) => s.transactions);
  const addTransaction = useStore((s) => s.addTransaction);
  const today = todayISO();

  const [type, setType] = useState<TxType>(initialType);
  const [amount, setAmount] = useState("");
  const [cat, setCat] = useState(initialType === "in" ? INCOME_CATEGORIES[0].key : EXPENSE_CATEGORIES[0].key);
  const [acc, setAcc] = useState(accounts[0]?.id ?? "");
  const [from, setFrom] = useState(accounts[0]?.id ?? "");
  const [to, setTo] = useState(accounts[1]?.id ?? "");
  const [date, setDate] = useState(today);
  const [note, setNote] = useState("");
  const [sheet, setSheet] = useState<"" | "acc" | "from" | "to" | "date">("");

  const cats = type === "in" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES.filter((c) => c.key !== "sub");
  const meta = TYPE_META[type];
  const copy = COPY[type];
  const value = parseFloat(amount) || 0;
  const accountOf = (id: string) => accounts.find((a) => a.id === id);
  const canSave = value > 0 && (type !== "move" || (from && to && from !== to));

  const changeType = (t: TxType) => {
    setType(t);
    if (t === "in") setCat(INCOME_CATEGORIES[0].key);
    if (t === "out") setCat(EXPENSE_CATEGORIES[0].key);
  };

  const press = (k: string) => {
    setAmount((a) => {
      if (k === "del") return a.slice(0, -1);
      if (k === ".") return a.includes(".") ? a : (a || "0") + ".";
      const dot = a.indexOf(".");
      if (dot !== -1 && a.length - dot > 2) return a;
      if (a.replace(".", "").length >= 9) return a;
      return a === "0" ? k : a + k;
    });
  };

  const [intPart, decPart] = (amount || "0").split(".");
  const amountText = Number(intPart).toLocaleString("en-US") + (decPart !== undefined ? "." + decPart : "");

  const save = () => {
    if (!canSave) return;
    const catLabel = cats.find((c) => c.key === cat)?.label ?? "";
    const title = note.trim() || (type === "move" ? `โอนเข้า${accountOf(to)?.name ?? ""}` : catLabel);
    addTransaction(
      type === "move"
        ? { type, amount: value, date, title, fromId: from, toId: to }
        : { type, amount: value, date, title, note: note.trim() || undefined, category: cat, accountId: acc },
    );
    router.push("/");
  };

  const dateText = date === today ? `วันนี้, ${shortDate(date, false)}` : date === addDays(today, -1) ? `เมื่อวาน, ${shortDate(date, false)}` : shortDate(date);

  return (
    <PushScreen className="gap-3">
      <PushHeader title="เพิ่มรายการ" backIcon="close" onBack={() => router.back()} />

      <Segmented
        label="ประเภทรายการ"
        value={type}
        onChange={changeType}
        options={[
          { value: "out", label: "รายจ่าย" },
          { value: "in", label: "รายรับ" },
          { value: "move", label: "โอน" },
        ]}
        colorFor={(v) => TYPE_META[v].color}
      />

      <output aria-live="polite" className="flex flex-col items-center gap-0.5 py-2">
        <span className="text-[13px] text-muted">{copy.amountLabel}</span>
        <span className="font-mono text-[44px] font-semibold leading-tight tracking-tight" style={{ color: meta.color }}>
          {meta.sign}฿{amountText}
        </span>
      </output>

      {type !== "move" ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {cats.map((c) => (
              <Chip key={c.key} on={c.key === cat} onClick={() => setCat(c.key)}>
                <span className="flex items-center gap-1.5">
                  <Icon name={c.icon} size={15} strokeWidth={2} />
                  {c.label}
                </span>
              </Chip>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <FieldButton label={copy.acc} value={accountOf(acc)?.name ?? "เลือกบัญชี"} onClick={() => setSheet("acc")} />
            <FieldButton label="วันที่" value={dateText} onClick={() => setSheet("date")} />
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="relative flex flex-col gap-1.5">
            <TransferRow label="จากบัญชี" name={accountOf(from)?.name} balance={accountOf(from) ? accountBalance(accountOf(from)!, txs) : 0} onClick={() => setSheet("from")} />
            <TransferRow label="ไปยังบัญชี" name={accountOf(to)?.name} balance={accountOf(to) ? accountBalance(accountOf(to)!, txs) : 0} onClick={() => setSheet("to")} />
            <button
              type="button"
              aria-label="สลับบัญชีต้นทางและปลายทาง"
              onClick={() => {
                setFrom(to);
                setTo(from);
              }}
              className="absolute right-[120px] top-11 flex h-9 w-9 items-center justify-center rounded-full border-[3px] border-paper bg-transfer text-white"
            >
              <Icon name="swap" size={16} strokeWidth={2.2} />
            </button>
          </div>
          <FieldButton label="วันที่" value={dateText} onClick={() => setSheet("date")} />
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor="note" className="pl-0.5 text-[11px] text-muted">
          โน้ต
        </label>
        <input
          id="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={copy.note}
          className="min-h-11 w-full rounded-xl border border-line bg-card px-3 text-sm outline-none"
        />
      </div>

      <div className="mt-auto grid grid-cols-3 gap-1.5">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "del"].map((k) => (
          <button
            key={k}
            type="button"
            aria-label={k === "del" ? "ลบ" : k}
            onClick={() => press(k)}
            className={cx("flex min-h-[50px] items-center justify-center rounded-xl font-mono text-[22px] font-medium", k === "del" || k === "." ? "bg-chip" : "bg-card")}
          >
            {k === "del" ? <Icon name="del" size={24} /> : k}
          </button>
        ))}
      </div>

      <PrimaryButton once onClick={save} disabled={!canSave}>
        {copy.save}
      </PrimaryButton>

      <AccountSheet open={sheet === "acc"} onClose={() => setSheet("")} title={copy.acc || "บัญชี"} value={acc} onPick={setAcc} />
      <AccountSheet open={sheet === "from"} onClose={() => setSheet("")} title="โอนจากบัญชี" value={from} exclude={to} onPick={setFrom} />
      <AccountSheet open={sheet === "to"} onClose={() => setSheet("")} title="โอนไปยังบัญชี" value={to} exclude={from} onPick={setTo} />
      <DateSheet
        open={sheet === "date"}
        onClose={() => setSheet("")}
        title="เลือกวันที่"
        value={date}
        onChange={setDate}
        max={today}
        quick={[
          { label: "วันนี้", value: today },
          { label: "เมื่อวาน", value: addDays(today, -1) },
        ]}
      />
    </PushScreen>
  );
}

function FieldButton({ label, value, onClick }: { label: string; value: string; onClick: () => void }) {
  return (
    <button type="button" aria-haspopup="dialog" onClick={onClick} className="flex min-h-[52px] flex-col items-start justify-center rounded-[14px] border border-line bg-card px-3 text-left">
      <span className="text-[11px] text-muted">{label}</span>
      <span className="text-sm font-semibold">{value}</span>
    </button>
  );
}

function TransferRow({ label, name, balance, onClick }: { label: string; name?: string; balance: number; onClick: () => void }) {
  return (
    <button type="button" aria-haspopup="dialog" onClick={onClick} className="flex min-h-[60px] items-center justify-between rounded-[14px] border border-line bg-card px-3.5 text-left">
      <span className="flex flex-col">
        <span className="text-[11px] text-muted">{label}</span>
        <span className="text-[15px] font-semibold">{name ?? "เลือกบัญชี"}</span>
      </span>
      <span className="font-mono text-[13px] text-muted">฿{balance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
    </button>
  );
}
