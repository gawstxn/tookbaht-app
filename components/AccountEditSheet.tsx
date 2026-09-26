"use client";

import { useState } from "react";
import { AccountMark } from "@/components/app";
import { Card, PrimaryButton, Segmented, SecondaryButton, Sheet, cx } from "@/components/ui/primitives";
import { useTranslation } from "react-i18next";
import { MONO_TONES } from "@/lib/constants";
import { t } from "@/lib/i18n";
import type { Account, AccountKind } from "@/lib/types";
import { BahtInput } from "./BahtInput";
import { ConfirmSheet } from "./ConfirmSheet";

export type AccountDraft = Omit<Account, "id">;

const KINDS: AccountKind[] = ["bank", "saving", "credit", "cash"];
export const kindOptions = () => KINDS.map((value) => ({ value, label: t(`kind.${value}`) }));

/** First letter for the monogram, skipping Thai leading vowels (เ แ โ ใ ไ). */
export function monoFor(name: string): string {
  const ch = [...name.trim()].find((c) => !"เแโใไ".includes(c));
  return (ch ?? "?").toUpperCase();
}

export function balanceLabel(kind: AccountKind) {
  return t(kind === "credit" ? "balance.limit" : "balance.opening");
}

/** Bottom sheet to add or edit an account. */
export function AccountEditSheet({
  open,
  onClose,
  initial,
  onSave,
  onDelete,
  deleteBlocked,
  onReconcile,
}: {
  open: boolean;
  onClose: () => void;
  initial?: AccountDraft;
  onSave: (a: AccountDraft) => void;
  onDelete?: () => void;
  /** Why this account can't be deleted; shown instead of the delete button. */
  deleteBlocked?: string | null;
  /** Existing accounts: open the "match the real balance" sheet. */
  onReconcile?: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  if (!open && confirming) setConfirming(false);
  return (
    <>
      <Sheet open={open && !confirming} onClose={onClose} title={t(initial ? "accounts.edit" : "accounts.add")}>
        {/* Remount per open so the form starts from `initial`. */}
        {open ? <AccountFields initial={initial} onSave={onSave} onDelete={onDelete ? () => setConfirming(true) : undefined} deleteBlocked={deleteBlocked} onReconcile={onReconcile} /> : null}
      </Sheet>
      <ConfirmSheet
        open={open && confirming}
        onClose={() => setConfirming(false)}
        title={t("accounts.deleteTitle", { name: initial?.name ?? "" })}
        lead={t("accounts.deleteLead")}
        confirmLabel={t("accounts.delete")}
        onConfirm={() => onDelete?.()}
      />
    </>
  );
}

function AccountFields({
  initial,
  onSave,
  onDelete,
  deleteBlocked,
  onReconcile,
}: {
  initial?: AccountDraft;
  onSave: (a: AccountDraft) => void;
  onDelete?: () => void;
  deleteBlocked?: string | null;
  onReconcile?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [kind, setKind] = useState<AccountKind>(initial?.kind ?? "bank");
  const [balanceText, setBalanceText] = useState(initial ? String(initial.openingBalance) : "");
  const [tone, setTone] = useState(initial?.tone ?? MONO_TONES[0]);
  const [feeText, setFeeText] = useState(initial?.fxFeePct ? String(initial.fxFeePct) : "");
  // Cards and bank accounts can pay foreign (USD) subscriptions.
  const paysAbroad = kind === "credit" || kind === "bank";
  const [dueText, setDueText] = useState(initial?.dueDay ? String(initial.dueDay) : "");
  const dueDay = Math.min(31, parseInt(dueText, 10) || 0) || null;
  const { t: tr } = useTranslation();
  const canSave = name.trim().length > 0;

  return (
    <>
      <div className="flex items-center gap-3.5">
        <AccountMark account={{ kind, tone }} size={48} />
        <div className="flex min-w-0 grow flex-col gap-0.5">
          <label htmlFor="accname" className="text-xs text-muted">
            {tr("accounts.name")}
          </label>
          <input
            id="accname"
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
            placeholder={tr("accounts.namePlaceholder")}
            className="min-h-9 w-full border-b border-line-strong bg-transparent pb-1 font-serif text-[20px] font-bold outline-none"
          />
        </div>
      </div>

      <Segmented<AccountKind> size="sm" label={tr("accounts.kind")} value={kind} onChange={setKind} options={kindOptions()} />

      <Card className="px-4 py-3">
        <label className="flex items-baseline gap-2">
          <span className="shrink-0 text-[13px] text-muted">{balanceLabel(kind)}</span>
          <span className="flex grow items-baseline gap-0.5 font-mono text-[26px] font-semibold">
            ฿
            <BahtInput
              value={balanceText}
              onChange={(e) => setBalanceText(e.target.value.replace(/[^0-9.]/g, ""))}
              placeholder="0"
              className="w-full min-w-0 bg-transparent outline-none"
            />
          </span>
        </label>
        {kind === "credit" ? (
          <label className="mt-2 flex items-center gap-2 border-t border-divider pt-2.5">
            <span className="flex grow flex-col">
              <span className="text-[13px] text-muted">{tr("accounts.dueDay")}</span>
              <span className="text-[11px] text-faint">{tr("accounts.dueDayHint")}</span>
            </span>
            <input
              inputMode="numeric"
              value={dueText}
              onChange={(e) => setDueText(e.target.value.replace(/[^0-9]/g, "").slice(0, 2))}
              placeholder="—"
              aria-label={tr("accounts.dueDay")}
              className="w-12 bg-transparent text-right font-mono text-[17px] font-semibold outline-none"
            />
          </label>
        ) : null}
        {paysAbroad ? (
          <label className="mt-2 flex items-center gap-2 border-t border-divider pt-2.5">
            <span className="flex grow flex-col">
              <span className="text-[13px] text-muted">{tr("accounts.fxFee")}</span>
              <span className="text-[11px] text-faint">{tr("accounts.fxFeeHint")}</span>
            </span>
            <input
              inputMode="decimal"
              value={feeText}
              onChange={(e) => setFeeText(e.target.value.replace(/[^0-9.]/g, "").slice(0, 5))}
              placeholder="0"
              aria-label={tr("accounts.fxFee")}
              className="w-14 bg-transparent text-right font-mono text-[17px] font-semibold outline-none"
            />
            <span className="font-mono text-[15px] font-semibold">%</span>
          </label>
        ) : null}
      </Card>

      <div role="radiogroup" aria-label={tr("accounts.color")} className="flex gap-2.5">
        {MONO_TONES.map((t) => (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={t === tone}
            aria-label={tr("accounts.colorN", { color: t })}
            onClick={() => setTone(t)}
            className={cx("h-9 w-9 rounded-full border-2", t === tone ? "border-ink" : "border-transparent")}
            style={{ background: t, boxShadow: "inset 0 0 0 3px var(--color-paper)" }}
          />
        ))}
      </div>

      <PrimaryButton
        once
        disabled={!canSave}
        onClick={() => onSave({
            name: name.trim(),
            kind,
            openingBalance: parseFloat(balanceText) || 0,
            mono: monoFor(name),
            tone,
            fxFeePct: paysAbroad ? Math.min(10, parseFloat(feeText) || 0) : 0,
            dueDay: kind === "credit" ? dueDay : null,
          })}
      >
        {tr("common.save")}
      </PrimaryButton>
      {onReconcile ? <SecondaryButton onClick={onReconcile}>{tr("accounts.reconcile")}</SecondaryButton> : null}
      {onDelete && deleteBlocked ? (
        <p className="text-center text-xs leading-relaxed text-muted">{deleteBlocked}</p>
      ) : onDelete ? (
        <SecondaryButton tone="danger" onClick={onDelete}>
          {tr("accounts.delete")}
        </SecondaryButton>
      ) : null}
    </>
  );
}
