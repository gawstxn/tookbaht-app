"use client";

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AmountInput } from "./AmountInput";
import { AccountSheet } from "./pickers";
import { Icon } from "./ui/Icon";
import { Chip, PickerRow, PrimaryButton, Sheet } from "./ui/primitives";
import { baht, monthNamesShort, todayISO } from "@/lib/format";
import { leftoverOffer, leftoverSource, type LeftoverOffer } from "@/lib/leftover";
import { savingsProgress } from "@/lib/savings";
import { accountBalance } from "@/lib/selectors";
import { useStore } from "@/lib/store";
import type { SavingsGoal } from "@/lib/types";

const shortMonth = (key: string) => monthNamesShort()[Number(key.slice(5, 7)) - 1];

/** Savings goals not reached yet, in the order the user made them. */
function useOpenGoals(): SavingsGoal[] {
  const goals = useStore((s) => s.savingsGoals);
  const accounts = useStore((s) => s.accounts);
  const txs = useStore((s) => s.transactions);
  return useMemo(() => {
    const today = todayISO();
    return goals.filter((g) => {
      const a = g.accountId ? accounts.find((x) => x.id === g.accountId) : undefined;
      return !savingsProgress(g, today, a ? accountBalance(a, txs) : undefined).done;
    });
  }, [goals, accounts, txs]);
}

/** Early in a month, offer to put what last month left over into a savings goal. */
export function LeftoverCard() {
  const { t } = useTranslation();
  const goals = useStore((s) => s.goals);
  const txs = useStore((s) => s.transactions);
  const handled = useStore((s) => s.settings.leftoverMonth);
  const open = useOpenGoals();
  const today = todayISO();
  const offer = useMemo(() => leftoverOffer(goals, txs, today, handled, open.length > 0), [goals, txs, today, handled, open.length]);
  const [editing, setEditing] = useState(false);
  const [round, setRound] = useState(0);
  const save = useSaveLeftover();
  if (!offer) return null;
  const goal = open[0];

  const edit = () => {
    setRound((r) => r + 1);
    setEditing(true);
  };
  const skip = () => {
    const { setSettings, notify } = useStore.getState();
    setSettings({ leftoverMonth: offer.month });
    notify(t("leftover.skipped"), { action: { label: t("common.undo"), run: () => setSettings({ leftoverMonth: handled }) } });
  };

  return (
    <div className="flex flex-col gap-3 rounded-[20px] border border-line bg-card px-3.5 py-3">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-income-tint">
          <Icon name="target" size={20} strokeWidth={2} style={{ color: "var(--color-income)" }} />
        </span>
        <span className="flex min-w-0 grow flex-col gap-0.5 pt-0.5">
          <span className="text-[15px] font-semibold leading-snug">
            {t(offer.fromBudget ? "leftover.titleBudget" : "leftover.titleNet", { month: shortMonth(offer.month) })}
            <span className="ml-1.5 font-mono text-income">{baht(offer.amount)}</span>
          </span>
          <span className="text-xs text-muted">{t("leftover.lead")}</span>
        </span>
        <button type="button" aria-label={t("leftover.skip")} onClick={skip} className="-mt-1.5 -mr-2 flex h-11 w-11 shrink-0 items-center justify-center text-faint">
          <Icon name="close" size={18} strokeWidth={2} />
        </button>
      </div>
      <div className="grid grid-cols-[auto_1fr] gap-2">
        <button type="button" onClick={() => edit()} className="min-h-11 rounded-full border border-line px-4 text-sm font-semibold">
          {t("leftover.choose")}
        </button>
        <button
          type="button"
          onClick={() => {
            if (!save(offer, goal, offer.amount)) edit();
          }}
          className="min-h-11 truncate rounded-full bg-ink px-4 text-sm font-semibold text-on-ink"
        >
          {t("leftover.saveTo", { name: goal.name })}
        </button>
      </div>
      {/* Keyed per opening so the fields start from the offer again. */}
      <LeftoverSheet key={round} open={editing} onClose={() => setEditing(false)} offer={offer} goals={open} />
    </div>
  );
}

/**
 * Put the money in: a transfer into the goal's account, or added to a manual
 * goal. Returns false when there's no account to move it from.
 */
function useSaveLeftover() {
  const { t } = useTranslation();
  return (offer: LeftoverOffer, goal: SavingsGoal, amount: number, fromId?: string | null): boolean => {
    const { accounts, transactions, addTransaction, addToSavings, setSettings } = useStore.getState();
    if (goal.accountId) {
      const from = fromId ?? leftoverSource(accounts, transactions, offer.month, goal.accountId);
      if (!from) return false;
      addTransaction(
        { type: "move", amount, date: todayISO(), title: "", fromId: from, toId: goal.accountId, note: t("leftover.note", { month: shortMonth(offer.month), name: goal.name }) },
        { undoable: true },
      );
    } else {
      addToSavings(goal.id, amount);
    }
    setSettings({ leftoverMonth: offer.month });
    return true;
  };
}

/** Pick the goal, the amount and (for a goal with an account) where the money comes from. */
function LeftoverSheet({ open, onClose, offer, goals }: { open: boolean; onClose: () => void; offer: LeftoverOffer; goals: SavingsGoal[] }) {
  const { t } = useTranslation();
  const accounts = useStore((s) => s.accounts);
  const txs = useStore((s) => s.transactions);
  const save = useSaveLeftover();
  const [goalId, setGoalId] = useState(goals[0]?.id ?? "");
  const [amount, setAmount] = useState(String(offer.amount));
  const goal = goals.find((g) => g.id === goalId);
  const [fromId, setFromId] = useState<string | null>(() => leftoverSource(accounts, txs, offer.month, goals[0]?.accountId));
  const [picking, setPicking] = useState(false);
  const value = parseFloat(amount) || 0;
  const from = accounts.find((a) => a.id === fromId);
  const needsFrom = !!goal?.accountId;
  const canSave = !!goal && value > 0 && (!needsFrom || (!!from && from.id !== goal.accountId));

  return (
    <>
      <Sheet open={open && !picking} onClose={onClose} title={t("leftover.sheetTitle")}>
        <AmountInput label={t("leftover.amount")} value={amount} onChange={setAmount} />
        <div className="flex flex-col gap-2">
          <span className="text-xs text-muted">{t("leftover.goal")}</span>
          <div className="flex flex-wrap gap-2">
            {goals.map((g) => (
              <Chip
                key={g.id}
                size="sm"
                on={g.id === goalId}
                onClick={() => {
                  setGoalId(g.id);
                  if (g.accountId && fromId === g.accountId) setFromId(leftoverSource(accounts, txs, offer.month, g.accountId));
                }}
              >
                {g.name}
              </Chip>
            ))}
          </div>
        </div>
        {needsFrom ? <PickerRow label={t("leftover.from")} value={from?.name ?? t("common.selectAccount")} onClick={() => setPicking(true)} /> : null}
        <p className="text-xs leading-relaxed text-muted">
          {needsFrom ? t("leftover.hintMove", { name: accounts.find((a) => a.id === goal?.accountId)?.name ?? "" }) : t("leftover.hintManual")}
        </p>
        <PrimaryButton
          once
          disabled={!canSave}
          onClick={() => {
            if (goal && save(offer, goal, value, fromId)) onClose();
          }}
        >
          {t("leftover.save")}
        </PrimaryButton>
      </Sheet>
      <AccountSheet
        open={open && picking}
        onClose={() => setPicking(false)}
        title={t("leftover.from")}
        value={fromId ?? ""}
        exclude={goal?.accountId ?? undefined}
        onPick={(id) => {
          setFromId(id);
          setPicking(false);
        }}
      />
    </>
  );
}
