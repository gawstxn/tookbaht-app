"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { PushScreen } from "@/components/app";
import { QuickEntries } from "@/components/QuickEntries";
import { AccountSheet, DateSheet } from "@/components/pickers";
import { Icon } from "@/components/ui/Icon";
import { Chip, PrimaryButton, PushHeader, Segmented, cx } from "@/components/ui/primitives";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, TYPE_META } from "@/lib/constants";
import { evaluate, formatExpr, hasOperator, pressKey, type CalcKey } from "@/lib/calc";
import { addDays, shortDate, todayISO } from "@/lib/format";
import { entryDefaults } from "@/lib/quick";
import { accountBalance } from "@/lib/selectors";
import { useTranslation } from "react-i18next";
import { formatMoney } from "@/lib/fx";
import { useGoBack } from "@/lib/nav";
import { useStore } from "@/lib/store";
import { isDefaultTitle } from "@/lib/txTitle";
import type { TxType } from "@/lib/types";


export default function AddPage() {
  return (
    <Suspense>
      <AddForm />
    </Suspense>
  );
}

function AddForm() {
  const router = useRouter();
  const goBack = useGoBack("/");
  const params = useSearchParams();
  const accounts = useStore((s) => s.accounts);
  const txs = useStore((s) => s.transactions);
  const keypadMath = useStore((s) => s.settings.keypadMath !== false);
  const addTransaction = useStore((s) => s.addTransaction);
  const updateTransaction = useStore((s) => s.updateTransaction);
  // /add?edit=<id> edits a saved transaction with the same form.
  const editing = txs.find((x) => x.id === params.get("edit"));
  const initialType = editing?.type ?? ((["in", "out", "move"].includes(params.get("type") ?? "") ? params.get("type") : "out") as TxType);
  const today = todayISO();
  const { t } = useTranslation();
  // A new entry starts from the category and account used most for its type.
  const accountIds = useMemo(() => accounts.map((a) => a.id), [accounts]);
  const defaultsFor = (type: TxType) => {
    const d = entryDefaults(txs, type, accountIds);
    const fromId = d.fromId ?? accounts[0]?.id ?? "";
    return {
      category: d.category ?? (type === "in" ? INCOME_CATEGORIES[0].key : EXPENSE_CATEGORIES[0].key),
      accountId: d.accountId ?? accounts[0]?.id ?? "",
      fromId,
      toId: d.toId ?? accounts.find((a) => a.id !== fromId)?.id ?? "",
    };
  };
  const [initial] = useState(() => (editing ? null : defaultsFor(initialType)));

  const [type, setType] = useState<TxType>(initialType);
  const [amount, setAmount] = useState(editing ? String(editing.amount) : "");
  const [cat, setCat] = useState(editing?.category ?? initial?.category ?? EXPENSE_CATEGORIES[0].key);
  const [acc, setAcc] = useState(editing?.accountId ?? initial?.accountId ?? "");
  const [from, setFrom] = useState(editing?.fromId ?? initial?.fromId ?? "");
  const [to, setTo] = useState(editing?.toId ?? initial?.toId ?? "");
  const [date, setDate] = useState(editing?.date ?? today);
  const [note, setNote] = useState(editing?.note ?? "");
  const [sheet, setSheet] = useState<"" | "acc" | "from" | "to" | "date">("");

  // "Subscriptions" is for auto-logged charges; offer it only when editing one.
  const cats = type === "in" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES.filter((c) => c.key !== "sub" || cat === "sub");
  const meta = TYPE_META[type];
  const copy = {
    amountLabel: t(`add.amount_${type}`),
    save: editing ? t("tx.saveEdit") : t(`add.save_${type}`),
    acc: type === "move" ? "" : t(`add.acc_${type}`),
    note: t(`add.note_${type}`),
  };
  const value = evaluate(amount);
  const summing = hasOperator(amount);
  const accountOf = (id: string) => accounts.find((a) => a.id === id);
  const canSave = value > 0 && (type !== "move" || (from && to && from !== to));

  const changeType = (next: TxType) => {
    setType(next);
    if (editing) {
      if (next === "in") setCat(INCOME_CATEGORIES[0].key);
      if (next === "out") setCat(EXPENSE_CATEGORIES[0].key);
      return;
    }
    const d = defaultsFor(next);
    if (next === "move") {
      setFrom(d.fromId);
      setTo(d.toId);
    } else {
      setCat(d.category);
      setAcc(d.accountId);
    }
  };

  const press = (k: CalcKey) => setAmount((a) => pressKey(a, k));

  // While summing ("120 + 85"), the big number is the total and the sum sits above it.
  const amountText = summing ? value.toLocaleString("en-US", { maximumFractionDigits: 2 }) : formatExpr(amount || "0");

  const save = () => {
    if (!canSave) return;
    const catLabel = cats.find((c) => c.key === cat)?.label ?? "";
    const fallback = type === "move" ? t("add.transferTo", { name: accountOf(to)?.name ?? "" }) : catLabel;
    // Keep a title the user or a subscription set (e.g. "Claude Pro") unless a note replaces it.
    const kept = editing && editing.type === type && !isDefaultTitle(editing, accounts) ? editing.title : "";
    const title = note.trim() || kept || fallback;
    const fields =
      type === "move"
        ? { type, amount: value, date, title, note: undefined, category: undefined, accountId: undefined, fromId: from, toId: to }
        : { type, amount: value, date, title, note: note.trim() || undefined, category: cat, accountId: acc, fromId: undefined, toId: undefined };
    if (editing) {
      updateTransaction(editing.id, fields);
      goBack();
    } else {
      addTransaction(fields);
      router.push("/");
    }
  };

  const dateText =
    date === today
      ? t("add.todayDate", { date: shortDate(date, false) })
      : date === addDays(today, -1)
        ? t("add.yesterdayDate", { date: shortDate(date, false) })
        : shortDate(date);

  return (
    <PushScreen className="gap-3">
      <PushHeader title={editing ? t("tx.editTitle") : t("add.title")} backIcon="close" onBack={() => goBack()} />

      <Segmented
        label={t("add.typeLabel")}
        value={type}
        onChange={changeType}
        options={[
          { value: "out", label: t("type.out") },
          { value: "in", label: t("type.in") },
          { value: "move", label: t("type.move") },
        ]}
        colorFor={(v) => TYPE_META[v].color}
      />

      {!editing && !amount ? <QuickEntries type={type} onSaved={() => router.push("/")} /> : null}

      <output aria-live="polite" className="flex flex-col items-center gap-0.5 py-2">
        <span className="max-w-full truncate text-[13px] text-muted">{summing ? <span className="font-mono">{formatExpr(amount)} =</span> : copy.amountLabel}</span>
        <span className="font-mono text-[44px] font-semibold leading-tight tracking-tight" style={{ color: meta.color }}>
          {value < 0 ? "−" : meta.sign}฿{amountText.replace("-", "")}
        </span>
      </output>
      {editing?.origAmount && editing.fxRate ? (
        <p className="-mt-2 text-center text-xs leading-relaxed text-muted">
          {t("tx.original")}{" "}
          <span className="font-mono font-semibold text-ink">
            {t("tx.originalValue", { amount: formatMoney(editing.origAmount, editing.origCurrency ?? "USD"), rate: editing.fxRate.toFixed(2) })}
          </span>
          <br />
          {t("tx.fixHint")}
        </p>
      ) : null}

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
            <FieldButton label={copy.acc} value={accountOf(acc)?.name ?? t("common.selectAccount")} onClick={() => setSheet("acc")} />
            <FieldButton label={t("common.date")} value={dateText} onClick={() => setSheet("date")} />
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="relative flex flex-col gap-1.5">
            <TransferRow label={t("common.fromAccount")} name={accountOf(from)?.name} balance={accountOf(from) ? accountBalance(accountOf(from)!, txs) : 0} onClick={() => setSheet("from")} />
            <TransferRow label={t("common.toAccount")} name={accountOf(to)?.name} balance={accountOf(to) ? accountBalance(accountOf(to)!, txs) : 0} onClick={() => setSheet("to")} />
            <button
              type="button"
              aria-label={t("add.swap")}
              onClick={() => {
                setFrom(to);
                setTo(from);
              }}
              className="absolute right-[120px] top-11 flex h-9 w-9 items-center justify-center rounded-full border-[3px] border-paper bg-transfer text-white"
            >
              <Icon name="swap" size={16} strokeWidth={2.2} />
            </button>
          </div>
          <FieldButton label={t("common.date")} value={dateText} onClick={() => setSheet("date")} />
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor="note" className="pl-0.5 text-[11px] text-muted">
          {t("common.note")}
        </label>
        <input
          id="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={copy.note}
          className="min-h-11 w-full rounded-xl border border-line bg-card px-3 text-sm outline-none"
        />
      </div>

      <div className={cx("mt-auto grid gap-1.5", keypadMath ? "grid-cols-4" : "grid-cols-3")}>
        {(keypadMath ? MATH_KEYS : PLAIN_KEYS).map((k) => (
          <button
            key={k}
            type="button"
            aria-label={k === "del" ? t("add.del") : k === "+" ? t("add.plus") : k === "-" ? t("add.minus") : k === "*" ? t("add.times") : k}
            onClick={() => press(k)}
            className={cx("flex min-h-[50px] items-center justify-center rounded-xl font-mono text-[22px] font-medium", /[0-9]/.test(k) ? "bg-card" : "bg-chip", k === "del" && keypadMath && "col-span-2")}
          >
            {k === "del" ? <Icon name="del" size={24} /> : (OP_LABEL[k] ?? k)}
          </button>
        ))}
      </div>

      <PrimaryButton once onClick={save} disabled={!canSave}>
        {copy.save}
      </PrimaryButton>

      <AccountSheet open={sheet === "acc"} onClose={() => setSheet("")} title={copy.acc || t("common.account")} value={acc} onPick={setAcc} />
      <AccountSheet open={sheet === "from"} onClose={() => setSheet("")} title={t("add.fromTitle")} value={from} exclude={to} onPick={setFrom} />
      <AccountSheet open={sheet === "to"} onClose={() => setSheet("")} title={t("add.toTitle")} value={to} exclude={from} onPick={setTo} />
      <DateSheet
        open={sheet === "date"}
        onClose={() => setSheet("")}
        title={t("add.pickDate")}
        value={date}
        onChange={setDate}
        max={today}
        quick={[
          { label: t("common.today"), value: today },
          { label: t("common.yesterday"), value: addDays(today, -1) },
        ]}
      />
    </PushScreen>
  );
}

/** Number pad with + − × down the right (unless turned off in Profile); the entry saves the total. */
const MATH_KEYS: CalcKey[] = ["1", "2", "3", "+", "4", "5", "6", "-", "7", "8", "9", "*", ".", "0", "del"];
/** Without the calculator (switch in Profile). */
const PLAIN_KEYS: CalcKey[] = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "del"];
const OP_LABEL: Partial<Record<CalcKey, string>> = { "+": "+", "-": "−", "*": "×" };

function FieldButton({ label, value, onClick }: { label: string; value: string; onClick: () => void }) {
  return (
    <button type="button" aria-haspopup="dialog" onClick={onClick} className="flex min-h-[52px] flex-col items-start justify-center rounded-[14px] border border-line bg-card px-3 text-left">
      <span className="text-[11px] text-muted">{label}</span>
      <span className="text-sm font-semibold">{value}</span>
    </button>
  );
}

function TransferRow({ label, name, balance, onClick }: { label: string; name?: string; balance: number; onClick: () => void }) {
  const { t } = useTranslation();
  return (
    <button type="button" aria-haspopup="dialog" onClick={onClick} className="flex min-h-[60px] items-center justify-between rounded-[14px] border border-line bg-card px-3.5 text-left">
      <span className="flex flex-col">
        <span className="text-[11px] text-muted">{label}</span>
        <span className="text-[15px] font-semibold">{name ?? t("common.selectAccount")}</span>
      </span>
      <span className="font-mono text-[13px] text-muted">฿{balance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
    </button>
  );
}
