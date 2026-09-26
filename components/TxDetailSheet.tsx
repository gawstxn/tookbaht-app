"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { TYPE_META, categoryLabel } from "@/lib/constants";
import { baht2, shortDate } from "@/lib/format";
import { formatMoney } from "@/lib/fx";
import { useStore } from "@/lib/store";
import { txTitle } from "@/lib/txTitle";
import type { Transaction } from "@/lib/types";
import { TxIcon } from "./app";
import { ConfirmSheet } from "./ConfirmSheet";
import { ListCard, PrimaryButton, SecondaryButton, Sheet } from "./ui/primitives";

/** A saved entry's details with edit, split and delete (activity list and home). */
export function TxDetailSheet({ tx: open, onClose }: { tx: Transaction | null; onClose: () => void }) {
  const router = useRouter();
  const { t: tr } = useTranslation();
  const accounts = useStore((s) => s.accounts);
  const ious = useStore((s) => s.ious);
  const deleteTransaction = useStore((s) => s.deleteTransaction);
  // Keep the last entry while the sheet slides out.
  const [shown, setShown] = useState<Transaction | null>(open);
  if (open && open !== shown) setShown(open);
  const tx = open ?? shown;
  const [confirming, setConfirming] = useState(false);
  if (!open && confirming) setConfirming(false);
  const accName = (id?: string) => accounts.find((a) => a.id === id)?.name ?? "—";

  return (
    <>
    <Sheet open={!!open && !confirming} onClose={() => onClose()} title={tr("tx.detail")}>
      {tx ? (
        <>
          <div className="flex items-center gap-3">
            <TxIcon type={tx.type} category={tx.category} size={48} />
            <div className="flex flex-col">
              <span className="text-lg font-semibold">{txTitle(tx, accounts)}</span>
              <span className="font-mono text-xl font-semibold" style={{ color: TYPE_META[tx.type].color }}>
                {TYPE_META[tx.type].sign}
                {baht2(tx.amount)}
              </span>
            </div>
          </div>
          <ListCard>
            <Detail label={tr("common.type")} value={TYPE_META[tx.type].label} />
            <Detail label={tr("common.date")} value={shortDate(tx.date)} />
            {tx.type === "move" ? (
              <>
                <Detail label={tr("common.fromAccount")} value={accName(tx.fromId)} />
                <Detail label={tr("common.toAccount")} value={accName(tx.toId)} />
              </>
            ) : (
              <>
                <Detail label={tr("common.category")} value={categoryLabel(tx.category)} />
                <Detail label={tr("common.account")} value={accName(tx.accountId)} />
              </>
            )}
            {tx.note ? <Detail label={tr("common.note")} value={tx.note} /> : null}
            {tx.subscriptionId ? <Detail label={tr("common.source")} value={tr("tx.fromSub")} /> : null}
            {tx.origAmount && tx.fxRate ? (
              <Detail
                label={tr("tx.original")}
                value={tr("tx.originalValue", { amount: formatMoney(tx.origAmount, tx.origCurrency ?? "USD"), rate: tx.fxRate.toFixed(2) })}
              />
            ) : null}
            {ious.some((i) => i.transactionId === tx.id) ? (
              <Detail label={tr("split.splitWith")} value={ious.filter((i) => i.transactionId === tx.id).map((i) => i.person).join(", ")} />
            ) : null}
          </ListCard>
          <PrimaryButton onClick={() => router.push(`/add?edit=${tx.id}`)}>{tr("tx.edit")}</PrimaryButton>
          {tx.type === "out" && !ious.some((i) => i.transactionId === tx.id) ? (
            <SecondaryButton onClick={() => router.push(`/ious/split?tx=${tx.id}`)}>{tr("split.action")}</SecondaryButton>
          ) : null}
          <SecondaryButton tone="danger" onClick={() => setConfirming(true)}>
            {tr("tx.delete")}
          </SecondaryButton>
        </>
      ) : null}
    </Sheet>
    <ConfirmSheet
      open={!!open && confirming}
      onClose={() => setConfirming(false)}
      title={tr("tx.deleteTitle")}
      lead={tx ? tr("tx.deleteLead", { name: txTitle(tx, accounts), amount: baht2(tx.amount) }) : ""}
      confirmLabel={tr("tx.delete")}
      onConfirm={() => {
        if (tx) deleteTransaction(tx.id);
        onClose();
      }}
    />
    </>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-4 text-sm">
      <span className="text-muted">{label}</span>
      <span className="text-right font-semibold">{value}</span>
    </div>
  );
}
