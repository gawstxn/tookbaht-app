import { addDays, dueDatesUntil } from "./format";
import { accountBalance, accountDue } from "./selectors";
import type { Account, Subscription, Transaction } from "./types";

/** How far ahead to look. */
export const CASHFLOW_DAYS = 30;

export interface CashEvent {
  date: string;
  /** What it is: a schedule's name, or the card being paid. */
  label: string;
  kind: "bill" | "income" | "transfer" | "card";
  /** Signed: money leaving the account is negative. */
  amount: number;
  /** The account's balance after this event. */
  balance: number;
  /** The schedule behind it (null for a card payment). */
  subscriptionId: string | null;
  /** The card account being paid (card payments only). */
  cardId?: string;
}

export interface AccountFlow {
  account: Account;
  /** Balance now. */
  start: number;
  events: CashEvent[];
  /** The first event that takes the balance below zero, and by how much (none when it's below zero already). */
  short: { event: CashEvent; by: number } | null;
}

type Pending = Omit<CashEvent, "balance">;

/**
 * Each bank, cash and savings account's balance day by day over the next
 * CASHFLOW_DAYS: salary and other scheduled income in, bills, installments
 * and transfers out, and card bills paid from the account set as the card's
 * "pay from" account (unless a scheduled transfer already pays that card).
 * Scheduled entries due today are left out (they are logged today); a card
 * due today is still counted. Accounts with nothing coming are left out.
 */
export function cashFlow(
  accounts: Account[],
  txs: Transaction[],
  subs: Subscription[],
  today: string,
  thb: (s: Subscription) => number = (s) => s.amount,
): AccountFlow[] {
  const end = addDays(today, CASHFLOW_DAYS);
  const cash = new Set(accounts.filter((a) => a.kind !== "credit").map((a) => a.id));
  const byAccount = new Map<string, Pending[]>();
  const add = (id: string | null | undefined, e: Pending) => {
    if (!id || !cash.has(id)) return;
    byAccount.set(id, [...(byAccount.get(id) ?? []), e]);
  };

  // Cards already paid by a scheduled transfer in the window.
  const paidBySchedule = new Set<string>();

  for (const s of subs) {
    if (s.paused) continue;
    dueDatesUntil(s.startDate, s.cycle, end).forEach((date, i) => {
      if (date <= today || (s.installments && i >= s.installments)) return;
      const amount = thb(s);
      const base = { date, label: s.name, subscriptionId: s.id };
      if (s.entryType === "in") add(s.accountId, { ...base, kind: "income", amount });
      else if (s.entryType === "out") add(s.accountId, { ...base, kind: "bill", amount: -amount });
      else {
        add(s.accountId, { ...base, kind: "transfer", amount: -amount });
        add(s.toAccountId, { ...base, kind: "transfer", amount });
        if (s.toAccountId && !cash.has(s.toAccountId)) paidBySchedule.add(s.toAccountId);
      }
    });
  }

  for (const card of accounts) {
    if (card.kind !== "credit" || !card.billFromId || paidBySchedule.has(card.id)) continue;
    const due = accountDue(card, txs, today, subs);
    if (!due || due.owed <= 0 || due.due > end) continue;
    add(card.billFromId, { date: due.due, label: card.name, kind: "card", amount: -due.owed, subscriptionId: null, cardId: card.id });
  }

  const out: AccountFlow[] = [];
  for (const account of accounts) {
    const pending = byAccount.get(account.id);
    if (!pending?.length) continue;
    // Same day: money in before money out.
    pending.sort((a, b) => a.date.localeCompare(b.date) || b.amount - a.amount);
    const start = accountBalance(account, txs);
    let balance = start;
    let short: AccountFlow["short"] = null;
    const events = pending.map((e) => {
      balance = Math.round((balance + e.amount) * 100) / 100;
      const ev = { ...e, balance };
      // An account already below zero is a balance to fix, not a shortfall to warn about.
      if (!short && start >= 0 && balance < 0 && e.amount < 0) short = { event: ev, by: -balance };
      return ev;
    });
    out.push({ account, start, events, short });
  }
  return out;
}

/** The earliest shortfall across accounts, for the warning on Home. */
export function firstShortfall(flows: AccountFlow[]): { account: Account; event: CashEvent; by: number } | null {
  let first: { account: Account; event: CashEvent; by: number } | null = null;
  for (const f of flows) if (f.short && (!first || f.short.event.date < first.event.date)) first = { account: f.account, ...f.short };
  return first;
}
