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
  /** Trip or project the entry belongs to ("เที่ยวญี่ปุ่น"). */
  tag?: string;
  /** Expenses only: the tax deduction it counts towards (lib/tax.ts). */
  taxType?: import("./tax").TaxType;
  /** Foreign charges: the original amount/currency and the THB rate used. */
  origAmount?: number;
  origCurrency?: import("./currencies").FxCurrency;
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
  /** Friends who share it: each logged charge records what they owe (split evenly with the user). */
  splitWith?: string[];
}

/** Something the user wants, parked until `decideOn` before buying. */
export interface Wish {
  id: string;
  name: string;
  price: number;
  note: string;
  decideOn: ISODate;
  status: "waiting" | "bought" | "skipped";
  decidedOn: ISODate | null;
  /** The expense it became, when bought. */
  transactionId: string | null;
  createdAt: number;
}

/** Who owes whom: a friend owes the user, or the user owes a friend. */
export type IouDirection = "owed_to_me" | "i_owe";

/** Money a friend owes the user (e.g. their share of a meal), or the user owes a friend. */
export interface Iou {
  id: string;
  /** "owed_to_me" when missing (debts saved before directions existed). */
  direction?: IouDirection;
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
  /** Categories whose unused budget carries into the next month. */
  rolloverKeys?: string[];
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
  /** Evening push (20:00) when nothing was logged that day (off unless true). */
  dailyReminder?: boolean;
  /** Last app version whose "what's new" this account has seen. */
  lastSeenVersion?: string;
  /** Categories the user made; deleted ones stay (hidden) so old entries keep their name. */
  customCategories?: CustomCategory[];
  /** The user's PromptPay ID (phone, national ID or e-wallet) for "pay me" QR codes. */
  promptPayId?: string;
  /** Monthly-bill suggestions the user said aren't bills (lib/habits.ts keys). */
  dismissedRecurring?: string[];
  /** Currency each trip (tag) is logged in abroad, e.g. { "เที่ยวญี่ปุ่น": "JPY" }. */
  tripCurrencies?: Record<string, import("./currencies").FxCurrency>;
  /** Last month ("YYYY-MM") whose leftover the user saved or skipped (lib/leftover.ts). */
  leftoverMonth?: string;
  /** Picked profile picture (lib/avatars.ts key); the initial shows when unset. */
  avatar?: string;
  /** "Spent nothing" confirmations for the streak: for day `d`, made on day `at` (lib/streak.ts). */
  noSpend?: { d: ISODate; at: ISODate }[];
  /** Highest streak milestone already celebrated. */
  streakMilestone?: number;
  /** Streak as last worked out on a device, for the server's evening reminder: length, latest counted day, restores left. */
  streak?: { n: number; last: ISODate | null; left: number };
}

export interface CustomCategory {
  /** "c-" + random id; stored on transactions like the built-in keys. */
  key: string;
  type: "in" | "out";
  label: string;
  icon: string;
  hidden?: boolean;
}
