export type TxType = "in" | "out" | "move";
export type Cycle = "week" | "month" | "year";
export type AccountKind = "bank" | "saving" | "credit" | "cash";

/** Calendar date in local time, formatted YYYY-MM-DD. */
export type ISODate = string;

export interface User {
  name: string;
  email: string;
}

export interface Account {
  id: string;
  name: string;
  kind: AccountKind;
  /** Starting balance (for credit cards: the credit limit). */
  openingBalance: number;
  mono: string;
  tone: string;
}

export interface Transaction {
  id: string;
  type: TxType;
  amount: number;
  date: ISODate;
  title: string;
  note?: string;
  /** Category key — for "in" and "out" only. */
  category?: string;
  /** Account for "in" / "out". */
  accountId?: string;
  /** Source and destination for "move". */
  fromId?: string;
  toId?: string;
  /** Set when the entry was logged automatically from a subscription. */
  subscriptionId?: string;
  createdAt: number;
}

export interface Subscription {
  id: string;
  name: string;
  amount: number;
  cycle: Cycle;
  startDate: ISODate;
  accountId: string;
  category: string;
  remind: boolean;
  autoLog: boolean;
  paused: boolean;
  tone: string;
}

export interface Goals {
  incomeTarget: number;
  expenseBudget: number;
  categoryBudgets: Record<string, number>;
  alertAt80: boolean;
}

export interface Settings {
  faceLock: boolean;
}
