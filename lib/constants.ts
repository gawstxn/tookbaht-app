import type { IconName } from "@/components/ui/Icon";
import { t } from "./i18n";
import type { AccountKind, CustomCategory, TxType } from "./types";

export interface CategoryDef {
  key: string;
  /** Translated on read, so it follows the current language. */
  readonly label: string;
  dot: string;
  icon: IconName;
}

const cat = (key: string, dot: string, icon: IconName): CategoryDef => ({
  key,
  dot,
  icon,
  get label() {
    return t(`cat.${key}`);
  },
});

export const EXPENSE_CATEGORIES: CategoryDef[] = [
  cat("food", "#c98a1e", "food"),
  cat("travel", "#33558f", "car"),
  cat("shop", "#8a2e22", "bag"),
  cat("bill", "#5f6259", "bolt"),
  cat("health", "#1b6b4a", "heart"),
  cat("fun", "#ffb38a", "film"),
  cat("sub", "#d4f06a", "repeat"),
  cat("other", "#b9b4a7", "dots"),
];

export const INCOME_CATEGORIES: CategoryDef[] = [
  cat("salary", "#1b6b4a", "briefcase"),
  cat("freelance", "#33558f", "laptop"),
  cat("sell", "#c98a1e", "tag"),
  cat("interest", "#5f6259", "percent"),
  cat("gift", "#ffb38a", "gift"),
  cat("repay", "#5b4a7a", "users"),
  cat("other-in", "#b9b4a7", "dots"),
];

export const SUB_CATEGORIES: CategoryDef[] = [
  cat("fun", "#ffb38a", "film"),
  cat("music", "#d4f06a", "music"),
  cat("net", "#33558f", "wifi"),
  cat("cloud", "#9a9d93", "cloud"),
  cat("fit", "#1b6b4a", "dumbbell"),
  cat("learn", "#33558f", "book"),
  cat("tools", "#c98a1e", "sliders"),
  cat("other", "#b9b4a7", "dots"),
];

export const ACCOUNT_KIND_ICON: Record<AccountKind, IconName> = {
  bank: "bank",
  saving: "vault",
  credit: "card",
  cash: "cash",
};

/** Quick picks on the subscription form; the full list is SUB_CATALOG. */
export const POPULAR_SUBS = ["Netflix", "Spotify", "YouTube Premium", "iCloud+", "ChatGPT Plus", "AIS Fibre", "True Online", "Disney+ Hotstar"];

/** Services people commonly pay for monthly in Thailand, grouped for the picker. */
export const SUB_CATALOG: { readonly title: string; readonly names: string[] }[] = [
  { get title() { return t("catalog.video"); }, names: ["Netflix", "YouTube Premium", "Disney+ Hotstar", "Prime Video", "Max", "Viu", "WeTV", "iQIYI", "TrueID", "MONOMAX", "Apple TV+", "Crunchyroll", "Bilibili"] },
  { get title() { return t("catalog.music"); }, names: ["Spotify", "Apple Music", "YouTube Music", "JOOX", "LINE MUSIC", "TIDAL", "Deezer", "SoundCloud Go", "Audible"] },
  { get title() { return t("catalog.net"); }, get names() { return ["AIS Fibre", "True Online", "3BB", "NT Broadband", t("catalog.aisMonthly"), t("catalog.trueMonthly"), t("catalog.dtacMonthly")]; } },
  { get title() { return t("catalog.ai"); }, names: ["ChatGPT Plus", "Claude Pro", "Gemini Advanced", "Perplexity Pro", "GitHub Copilot", "Cursor", "Notion", "Canva Pro", "Microsoft 365", "Adobe Creative Cloud", "Figma", "Grammarly", "Zoom"] },
  { get title() { return t("catalog.cloud"); }, names: ["iCloud+", "Google One", "Dropbox", "1Password", "Bitwarden", "NordVPN", "ExpressVPN", "Proton VPN", "Surfshark"] },
  { get title() { return t("catalog.games"); }, names: ["PlayStation Plus", "Xbox Game Pass", "Nintendo Switch Online", "Apple Arcade", "Discord Nitro"] },
  { get title() { return t("catalog.health"); }, names: ["Fitness First", "Jetts Fitness", "Strava", "Headspace", "Duolingo", "Medium"] },
  { get title() { return t("catalog.other"); }, names: ["Apple One", "X Premium", "Patreon", "Tinder"] },
];

export const MONO_TONES = ["#2f5b45", "#33558f", "#8a2e22", "#6e3a1c", "#5b4a7a", "#1c1e1b"];

const typeMeta = (type: TxType, color: string, tint: string, sign: string) => ({
  color,
  tint,
  sign,
  get label() {
    return t(`type.${type}`);
  },
});
export const TYPE_META: Record<TxType, { readonly label: string; color: string; tint: string; sign: string }> = {
  in: typeMeta("in", "var(--color-income)", "var(--color-income-tint)", "+"),
  out: typeMeta("out", "var(--color-expense)", "var(--color-expense-tint)", "−"),
  move: typeMeta("move", "var(--color-transfer)", "var(--color-transfer-tint)", ""),
};

/** Icons offered for the user's own categories. */
export const CUSTOM_CATEGORY_ICONS: IconName[] = [
  "food", "car", "bag", "bolt", "heart", "film", "home", "gift", "music", "book", "dumbbell", "laptop",
  "wifi", "cloud", "users", "briefcase", "tag", "percent", "cash", "card", "target", "calendar", "chart", "dots",
];
const CUSTOM_DOTS = ["#2f5b45", "#33558f", "#8a2e22", "#6e3a1c", "#5b4a7a", "#c98a1e", "#1b6b4a", "#5f6259"];

/**
 * The user's own categories (profiles.settings.customCategories), kept in step
 * with the store (see lib/store.ts) so labels resolve anywhere, including
 * outside React.
 */
let custom: (CategoryDef & { type: "in" | "out"; hidden: boolean })[] = [];

export function registerCustomCategories(list: CustomCategory[] | undefined) {
  custom = (list ?? []).map((c, i) => ({
    key: c.key,
    label: c.label,
    dot: CUSTOM_DOTS[i % CUSTOM_DOTS.length],
    icon: (CUSTOM_CATEGORY_ICONS as string[]).includes(c.icon) ? (c.icon as IconName) : "dots",
    type: c.type,
    hidden: !!c.hidden,
  }));
}

/** Built-in plus the user's own (visible) categories, the user's just before "other". */
function withCustom(builtIn: CategoryDef[], type: "in" | "out"): CategoryDef[] {
  const mine = custom.filter((c) => c.type === type && !c.hidden);
  if (!mine.length) return builtIn;
  const i = builtIn.findIndex((c) => c.key === "other" || c.key === "other-in");
  return i < 0 ? [...builtIn, ...mine] : [...builtIn.slice(0, i), ...mine, ...builtIn.slice(i)];
}
export const expenseCategories = () => withCustom(EXPENSE_CATEGORIES, "out");
export const incomeCategories = () => withCustom(INCOME_CATEGORIES, "in");

const ALL_CATEGORIES = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES, ...SUB_CATEGORIES];
const findCategory = (key: string) => ALL_CATEGORIES.find((c) => c.key === key) ?? custom.find((c) => c.key === key);

export function categoryLabel(key?: string): string {
  if (!key) return "";
  return findCategory(key)?.label ?? key;
}

export function categoryIcon(key?: string): IconName {
  return (key && findCategory(key)?.icon) || "dots";
}
