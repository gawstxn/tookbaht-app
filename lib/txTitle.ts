import { categoryLabel } from "./constants";
import { t } from "./i18n";
import en from "./locales/en";
import th from "./locales/th";
import type { Account, Transaction } from "./types";

const defaultCategoryTitles = (key?: string) =>
  key ? [(th.cat as Record<string, string>)[key], (en.cat as Record<string, string>)[key]].filter(Boolean) : [];

/**
 * Title to show for a transaction. Entries saved without a note get a default
 * title (the category name, or "โอนเข้า…" / "Transfer to …") in whatever
 * language was active; show those in the current language instead.
 */
export function txTitle(tx: Transaction, accounts: Account[]): string {
  if (!isDefaultTitle(tx, accounts)) return tx.title;
  if (tx.type === "move") return t("add.transferTo", { name: accounts.find((a) => a.id === tx.toId)?.name ?? "" });
  return categoryLabel(tx.category);
}

/** True when the title is one the app generated (no note was typed), in either language. */
export function isDefaultTitle(tx: Pick<Transaction, "type" | "title" | "category" | "toId">, accounts: Account[]): boolean {
  if (!tx.title) return true;
  if (tx.type === "move") {
    const to = accounts.find((a) => a.id === tx.toId)?.name ?? "";
    return [th.add.transferTo, en.add.transferTo].map((p) => p.replace("{{name}}", to)).includes(tx.title);
  }
  return defaultCategoryTitles(tx.category).includes(tx.title);
}
