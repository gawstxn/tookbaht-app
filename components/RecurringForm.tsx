"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { PushScreen } from "@/components/app";
import { AccountSheet, CategorySheet, DateSheet } from "@/components/pickers";
import { Card, ListCard, PickerRow, PrimaryButton, PushHeader, Segmented, SwitchRow } from "@/components/ui/primitives";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, MONO_TONES, categoryLabel } from "@/lib/constants";
import { baht2, shortDate, stepCycle, todayISO } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { Cycle, Subscription, TxType } from "@/lib/types";

export type RecurringDraft = Omit<Subscription, "id">;

const MAX_INSTALLMENTS = 60;

/** Salary, rent, a regular transfer or an installment plan, logged on schedule by the database. */
export function RecurringForm({ title, saveLabel, initial, onSave, onBack }: { title: string; saveLabel: string; initial?: RecurringDraft; onSave: (d: RecurringDraft) => void; onBack: () => void }) {
  const { t } = useTranslation();
  const accounts = useStore((s) => s.accounts);
  const [d, setD] = useState<RecurringDraft>(
    initial ?? {
      kind: "recurring",
      entryType: "out",
      name: "",
      amount: 0,
      currency: "THB",
      cycle: "month",
      startDate: todayISO(),
      accountId: accounts[0]?.id ?? "",
      toAccountId: null,
      installments: null,
      category: "bill",
      remind: true,
      autoLog: true,
      paused: false,
      tone: MONO_TONES[5],
    },
  );
  const [amountText, setAmountText] = useState(initial ? String(initial.amount) : "");
  const [countText, setCountText] = useState(initial?.installments ? String(initial.installments) : "3");
  const [sheet, setSheet] = useState<"" | "date" | "from" | "to" | "category">("");
  const set = (p: Partial<RecurringDraft>) => setD((x) => ({ ...x, ...p }));

  const type = d.entryType;
  const plan = type === "out" && !!d.installments;
  const categories = type === "in" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const lastDate = d.installments ? stepCycle(d.startDate, d.cycle, d.installments - 1) : null;
  const canSave =
    d.name.trim().length > 0 && d.amount > 0 && !!d.accountId && (type !== "move" || (!!d.toAccountId && d.toAccountId !== d.accountId)) && (!plan || (d.installments ?? 0) >= 1);
  const setType = (entryType: TxType) =>
    set({
      entryType,
      // Keep the category meaningful for the new type; transfers have none.
      category: entryType === "in" ? "salary" : entryType === "out" ? "bill" : "other",
      installments: entryType === "out" ? d.installments : null,
      toAccountId: entryType === "move" ? (d.toAccountId ?? accounts.find((a) => a.id !== d.accountId)?.id ?? null) : null,
      remind: entryType === "in" ? false : d.remind,
    });
  const setCount = (text: string) => {
    const clean = text.replace(/[^0-9]/g, "").slice(0, 2);
    setCountText(clean);
    set({ installments: Math.min(MAX_INSTALLMENTS, parseInt(clean, 10) || 0) || null });
  };
  const accName = (id?: string | null) => accounts.find((a) => a.id === id)?.name ?? t("common.selectAccount");

  return (
    <PushScreen className="gap-3.5">
      <PushHeader title={title} backIcon="close" onBack={onBack} />

      <Segmented<TxType>
        label={t("rec.type")}
        value={type}
        onChange={setType}
        colorFor={(v) => (v === "in" ? "var(--color-income)" : v === "out" ? "var(--color-expense)" : "var(--color-transfer)")}
        options={[
          { value: "out", label: t("type.out") },
          { value: "in", label: t("type.in") },
          { value: "move", label: t("type.move") },
        ]}
      />

      <Card className="flex flex-col gap-3 px-4 py-3.5">
        <label className="flex flex-col gap-0.5">
          <span className="text-xs text-muted">{t("rec.name")}</span>
          <input
            value={d.name}
            maxLength={80}
            onChange={(e) => set({ name: e.target.value })}
            placeholder={t("rec.namePlaceholder")}
            className="min-h-9 w-full border-b border-line-strong bg-transparent pb-1 font-serif text-[20px] font-bold outline-none"
          />
        </label>
        <label className="flex items-baseline gap-2">
          <span className="shrink-0 text-[13px] text-muted">{t(plan ? "rec.amountInstallment" : "rec.amount")}</span>
          <span className="flex grow items-baseline justify-end gap-0.5 font-mono text-[26px] font-semibold">
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
              aria-label={t(plan ? "rec.amountInstallment" : "rec.amount")}
              className="w-full min-w-0 bg-transparent text-right outline-none"
            />
          </span>
        </label>
        <Segmented<Cycle>
          size="sm"
          label={t("subs.cycle")}
          value={d.cycle}
          onChange={(cycle) => set({ cycle })}
          options={[
            { value: "week", label: t("cycle.week") },
            { value: "month", label: t("cycle.month") },
            { value: "year", label: t("cycle.year") },
          ]}
        />
      </Card>

      <ListCard>
        <PickerRow label={t("rec.first")} value={shortDate(d.startDate)} onClick={() => setSheet("date")} />
        <PickerRow label={t(type === "in" ? "rec.intoAccount" : type === "move" ? "rec.from" : "rec.payFrom")} value={accName(d.accountId)} onClick={() => setSheet("from")} />
        {type === "move" ? <PickerRow label={t("rec.to")} value={accName(d.toAccountId)} onClick={() => setSheet("to")} /> : null}
        {type !== "move" ? <PickerRow label={t("common.category")} value={categoryLabel(d.category)} onClick={() => setSheet("category")} /> : null}
      </ListCard>

      {type === "out" ? (
        <ListCard>
          <SwitchRow label={t("rec.installments")} hint={t("rec.installmentsHint")} checked={plan} onChange={(on) => set({ installments: on ? parseInt(countText, 10) || 3 : null })} />
          {plan ? (
            <label className="flex min-h-14 items-center gap-3">
              <span className="flex grow flex-col">
                <span className="text-[15px]">{t("rec.count")}</span>
                {lastDate && d.amount > 0 ? (
                  <span className="text-xs text-muted">{t("rec.planTotal", { total: baht2(d.amount * (d.installments ?? 0)), date: shortDate(lastDate) })}</span>
                ) : null}
              </span>
              <input
                inputMode="numeric"
                value={countText}
                onChange={(e) => setCount(e.target.value)}
                aria-label={t("rec.count")}
                className="w-14 rounded-[10px] bg-paper px-2 py-1.5 text-center font-mono text-[17px] font-semibold outline-none"
              />
            </label>
          ) : null}
        </ListCard>
      ) : null}

      <ListCard>
        {type !== "in" ? <SwitchRow label={t("rec.remind")} checked={d.remind} onChange={(remind) => set({ remind })} /> : null}
        <SwitchRow
          label={t(type === "in" ? "rec.autoLogIn" : type === "move" ? "rec.autoLogMove" : "rec.autoLogOut")}
          hint={t("rec.autoLogHint")}
          checked={d.autoLog}
          onChange={(autoLog) => set({ autoLog })}
        />
      </ListCard>

      <div className="mt-auto">
        <PrimaryButton once disabled={!canSave} onClick={() => onSave({ ...d, name: d.name.trim(), installments: plan ? d.installments : null })}>
          {saveLabel}
        </PrimaryButton>
      </div>

      <DateSheet
        open={sheet === "date"}
        onClose={() => setSheet("")}
        title={t("rec.first")}
        value={d.startDate}
        onChange={(startDate) => set({ startDate })}
        hint={d.startDate < todayISO() ? t("subs.noBackfill").replace(/^ · /, "") : undefined}
      />
      <AccountSheet open={sheet === "from"} onClose={() => setSheet("")} title={t(type === "in" ? "rec.intoAccount" : type === "move" ? "rec.from" : "rec.payFrom")} value={d.accountId} onPick={(accountId) => set({ accountId })} />
      <AccountSheet open={sheet === "to"} onClose={() => setSheet("")} title={t("rec.to")} value={d.toAccountId ?? ""} exclude={d.accountId} onPick={(toAccountId) => set({ toAccountId })} />
      <CategorySheet open={sheet === "category"} onClose={() => setSheet("")} title={t("common.category")} options={categories} value={d.category} onPick={(category) => set({ category })} />
    </PushScreen>
  );
}
