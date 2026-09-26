export type TxType = "in" | "out" | "move";
export type Cycle = "week" | "month" | "year";
export type AccountKind = "bank" | "saving" | "credit" | "cash";
/** Price currency of a subscription. Everything else is in baht. */
export type Currency = "THB" | "USD";

/** Calendar date in local time, formatted YYYY-MM-DD. */
export type ISODate = string;

export interface User {
  name: string;
  email: string;
  /** How the user signs in ("google", or "email" for the local dev login). */
  provider?: string;
}

export interface Account {
  id: string;
  name: string;
  kind: AccountKind;
  /** Starting balance (for credit cards: the credit limit). */
  openingBalance: number;
  mono: string;
  tone: string;
  /** Foreign-transaction fee in percent, added to converted charges. */
  fxFeePct: number;
  /** Cards and pay-later: day of the month the bill must be paid by. */
  dueDay?: number | null;
  /** Cards and pay-later: the account the bill is usually paid from. */
  billFromId?: string | null;
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
  /** Foreign charges: the original amount/currency and the THB rate used. */
  origAmount?: number;
  origCurrency?: Currency;
  fxRate?: number;
  createdAt: number;
}

/** "subscription": a service billed to an account. "recurring": salary, rent, a transfer or an installment plan. */
export type ScheduleKind = "subscription" | "recurring";

export interface Subscription {
  id: string;
  kind: ScheduleKind;
  /** What each charge logs; subscriptions are always "out". */
  entryType: TxType;
  name: string;
  /** Price in `currency` (for USD: what is actually charged, VAT included). */
  amount: number;
  currency: Currency;
  cycle: Cycle;
  startDate: ISODate;
  /** Paying account; the source of a recurring transfer. */
  accountId: string;
  /** Destination of a recurring transfer. */
  toAccountId?: string | null;
  /** Installment plans: total number of charges (ผ่อน 3 งวด); open-ended when unset. */
  installments?: number | null;
  /** Pay-later purchases: the price; installments × amount − principal is the interest. */
  principal?: number | null;
  category: string;
  remind: boolean;
  autoLog: boolean;
  paused: boolean;
  tone: string;
}

/** Money a friend owes the user, e.g. their share of a shared meal. */
export interface Iou {
  id: string;
  /** The friend's name, as the user typed it. */
  person: string;
  amount: number;
  note: string;
  date: ISODate;
  /** The bill it came from, when split from a saved expense. */
  transactionId?: string | null;
  /** When the friend paid it back. */
  settledOn?: ISODate | null;
  createdAt: number;
}

/** A lump sum to save up for ("เที่ยวญี่ปุ่น ฿40,000 ภายในมี.ค."). */
export interface SavingsGoal {
  id: string;
  name: string;
  target: number;
  /** Saved so far, added to by hand (used when no account is linked). */
  saved: number;
  /** Last day to reach the target (the end of the chosen month). */
  deadline?: ISODate | null;
  /** When set, progress is this account's balance. */
  accountId?: string | null;
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
  /** Notification read state: everything up to readBefore (ms) plus these ids. */
  notifReadBefore?: number;
  notifReadIds?: string[];
  /** Terms/privacy version the user accepted (lib/legal.ts) and when. */
  termsAcceptedVersion?: string;
  termsAcceptedAt?: string;
  /** UI language; also used for push reminders sent by the server. */
  lang?: "th" | "en";
  /** Push a summary of last month on the 1st (on unless false). */
  monthlySummary?: boolean;
  /** + − × keys on the add screen's keypad (on unless false). */
  keypadMath?: boolean;
}
