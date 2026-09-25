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
  if (tx.type === "move") {
    const to = accounts.find((a) => a.id === tx.toId)?.name ?? "";
    const defaults = [th.add.transferTo, en.add.transferTo].map((p) => p.replace("{{name}}", to));
    return !tx.title || defaults.includes(tx.title) ? t("add.transferTo", { name: to }) : tx.title;
  }
  if (!tx.title || defaultCategoryTitles(tx.category).includes(tx.title)) return categoryLabel(tx.category);
  return tx.title;
}
