"use client";

import { useState } from "react";
import { AccountMark } from "@/components/app";
import { Card, PrimaryButton, Segmented, SecondaryButton, Sheet, cx } from "@/components/ui/primitives";
import { useTranslation } from "react-i18next";
import { MONO_TONES } from "@/lib/constants";
import { t } from "@/lib/i18n";
import type { Account, AccountKind } from "@/lib/types";

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
}: {
  open: boolean;
  onClose: () => void;
  initial?: AccountDraft;
  onSave: (a: AccountDraft) => void;
  onDelete?: () => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={t(initial ? "accounts.edit" : "accounts.add")}>
      {/* Remount per open so the form starts from `initial`. */}
      {open ? <AccountFields initial={initial} onSave={onSave} onDelete={onDelete} /> : null}
    </Sheet>
  );
}

function AccountFields({ initial, onSave, onDelete }: { initial?: AccountDraft; onSave: (a: AccountDraft) => void; onDelete?: () => void }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [kind, setKind] = useState<AccountKind>(initial?.kind ?? "bank");
  const [balanceText, setBalanceText] = useState(initial ? String(initial.openingBalance) : "");
  const [tone, setTone] = useState(initial?.tone ?? MONO_TONES[0]);
  const [confirmDelete, setConfirmDelete] = useState(false);
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
            className="min-h-9 w-full border-b border-[#d0cbbf] bg-transparent pb-1 font-serif text-[20px] font-bold outline-none"
          />
        </div>
      </div>

      <Segmented<AccountKind> size="sm" label={tr("accounts.kind")} value={kind} onChange={setKind} options={kindOptions()} />

      <Card className="px-4 py-3">
        <label className="flex items-baseline gap-2">
          <span className="shrink-0 text-[13px] text-muted">{balanceLabel(kind)}</span>
          <span className="flex grow items-baseline gap-0.5 font-mono text-[26px] font-semibold">
            ฿
            <input
              inputMode="decimal"
              value={balanceText}
              onChange={(e) => setBalanceText(e.target.value.replace(/[^0-9.]/g, ""))}
              placeholder="0"
              className="w-full min-w-0 bg-transparent outline-none"
            />
          </span>
        </label>
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
        onClick={() => onSave({ name: name.trim(), kind, openingBalance: parseFloat(balanceText) || 0, mono: monoFor(name), tone })}
      >
        {tr("common.save")}
      </PrimaryButton>
      {onDelete ? (
        confirmDelete ? (
          <SecondaryButton tone="danger" onClick={onDelete}>
            {tr("accounts.confirmDelete")}
          </SecondaryButton>
        ) : (
          <SecondaryButton onClick={() => setConfirmDelete(true)}>{tr("accounts.delete")}</SecondaryButton>
        )
      ) : null}
    </>
  );
}
