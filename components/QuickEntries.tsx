"use client";

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { baht2, todayISO } from "@/lib/format";
import { quickEntries, type QuickEntry } from "@/lib/quick";
import { useStore } from "@/lib/store";
import { txTitle } from "@/lib/txTitle";
import type { TxType } from "@/lib/types";
import { TxIcon } from "./app";

/**
 * One-tap buttons for entries the user logs again and again (suggested from
 * history). Tapping saves a copy dated today; the toast offers undo.
 */
export function QuickEntries({ type, onSaved, heading }: { type?: TxType; onSaved?: () => void; heading?: boolean }) {
  const { t } = useTranslation();
  const txs = useStore((s) => s.transactions);
  const accounts = useStore((s) => s.accounts);
  const addTransaction = useStore((s) => s.addTransaction);
  const today = todayISO();
  const entries = useMemo(
    () => quickEntries(txs, accounts.map((a) => a.id), today).filter((q) => !type || q.sample.type === type),
    [txs, accounts, today, type],
  );
  if (!entries.length) return null;

  const save = ({ sample: s }: QuickEntry) => {
    addTransaction(
      { type: s.type, amount: s.amount, date: today, title: s.title, note: s.note, category: s.category, accountId: s.accountId },
      { undoable: true },
    );
    onSaved?.();
  };

  return (
    <section aria-label={t("quick.title")} className="flex flex-col gap-2">
      {heading ? <h2 className="text-base font-semibold">{t("quick.title")}</h2> : null}
      <div className="-mx-6 flex gap-2 overflow-x-auto px-6 pb-0.5">
        {entries.map((q) => {
          const account = accounts.find((a) => a.id === q.sample.accountId);
          return (
            <button
              key={q.key}
              type="button"
              onClick={() => save(q)}
              aria-label={t("quick.save", { title: txTitle(q.sample, accounts), amount: baht2(q.sample.amount) })}
              className="flex min-h-[52px] shrink-0 items-center gap-2 rounded-2xl border border-line bg-card py-1.5 pl-2 pr-3.5 text-left active:bg-chip"
            >
              <TxIcon type={q.sample.type} category={q.sample.category} size={30} />
              <span className="flex max-w-[150px] flex-col">
                <span className="truncate text-[13px] font-semibold">
                  {txTitle(q.sample, accounts)} <span className="font-mono">{baht2(q.sample.amount)}</span>
                </span>
                <span className="truncate text-[11px] text-muted">{account?.name}</span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
