"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { categoryLabel } from "@/lib/constants";
import { baht2, shortDate, todayISO } from "@/lib/format";
import { slipLogged, type SlipFields } from "@/lib/slip";
import { useStore } from "@/lib/store";
import { Icon } from "./ui/Icon";
import { PrimaryButton, Sheet, cx } from "./ui/primitives";

/**
 * Review of several slips read at once: tick the ones to keep and save them
 * as expenses in the category and account picked on the add screen. Slips
 * that look logged already start unticked.
 */
export function SlipBatchSheet({
  slips,
  category,
  accountId,
  onClose,
  onSaved,
}: {
  slips: SlipFields[] | null;
  category: string;
  accountId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const txs = useStore((s) => s.transactions);
  const accounts = useStore((s) => s.accounts);
  const addTransactions = useStore((s) => s.addTransactions);
  const [picked, setPicked] = useState<boolean[]>([]);
  const [shown, setShown] = useState<SlipFields[] | null>(null);
  // New batch: tick every readable slip that isn't logged yet.
  if (slips && slips !== shown) {
    setShown(slips);
    setPicked(slips.map((s) => !!s.amount && !slipLogged(txs, s)));
  }
  const list = slips ?? shown ?? [];
  const chosen = list.filter((s, i) => picked[i] && s.amount);
  const total = chosen.reduce((a, s) => a + (s.amount ?? 0), 0);
  const account = accounts.find((a) => a.id === accountId)?.name ?? "";
  const today = todayISO();

  return (
    <Sheet open={!!slips} onClose={onClose} title={t("slip.batchTitle", { count: list.length })}>
      <p className="text-sm text-muted">{t("slip.batchLead", { category: categoryLabel(category), account })}</p>
      <ul className="flex flex-col gap-2">
        {list.map((s, i) => {
          const logged = slipLogged(txs, s);
          const on = !!picked[i] && !!s.amount;
          return (
            <li key={i}>
              <button
                type="button"
                role="checkbox"
                aria-checked={on}
                disabled={!s.amount}
                onClick={() => setPicked((p) => p.map((x, j) => (j === i ? !x : x)))}
                className={cx("flex min-h-[60px] w-full items-center gap-3 rounded-2xl border px-3 text-left disabled:opacity-50", on ? "border-ink bg-card" : "border-line bg-card")}
              >
                <span className={cx("flex h-6 w-6 shrink-0 items-center justify-center rounded-md border", on ? "border-ink bg-ink text-on-ink" : "border-line")}>
                  {on ? <Icon name="check" size={14} strokeWidth={2.6} /> : null}
                </span>
                <span className="flex min-w-0 grow flex-col">
                  <span className="truncate text-[15px] font-medium">{s.memo || s.receiver || categoryLabel(category)}</span>
                  <span className={cx("text-xs", logged ? "text-warn" : "text-muted")}>
                    {!s.amount ? t("slip.noAmount") : logged ? t("slip.maybeLogged", { date: shortDate(s.date!) }) : shortDate(s.date ?? today)}
                  </span>
                </span>
                <span className="font-mono text-[15px] font-semibold">{s.amount ? baht2(s.amount) : "—"}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <PrimaryButton
        disabled={!chosen.length || !accountId}
        onClick={() => {
          addTransactions(
            chosen.map((s) => {
              const label = s.memo || s.receiver;
              return { type: "out", amount: s.amount!, date: s.date ?? today, title: label || categoryLabel(category), note: label || undefined, category, accountId };
            }),
          );
          onSaved();
        }}
      >
        {t("slip.batchSave", { count: chosen.length, amount: baht2(total) })}
      </PrimaryButton>
    </Sheet>
  );
}
