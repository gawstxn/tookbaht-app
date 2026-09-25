import type { IconName } from "@/components/ui/Icon";
import type { AccountKind, TxType } from "./types";

export interface CategoryDef {
  key: string;
  label: string;
  dot: string;
  icon: IconName;
}

export const EXPENSE_CATEGORIES: CategoryDef[] = [
  { key: "food", label: "อาหาร", dot: "#c98a1e", icon: "food" },
  { key: "travel", label: "เดินทาง", dot: "#33558f", icon: "car" },
  { key: "shop", label: "ช้อปปิ้ง", dot: "#8a2e22", icon: "bag" },
  { key: "bill", label: "ค่าน้ำไฟ", dot: "#5f6259", icon: "bolt" },
  { key: "health", label: "สุขภาพ", dot: "#1b6b4a", icon: "heart" },
  { key: "fun", label: "บันเทิง", dot: "#ffb38a", icon: "film" },
  { key: "sub", label: "Subscriptions", dot: "#d4f06a", icon: "repeat" },
  { key: "other", label: "อื่นๆ", dot: "#b9b4a7", icon: "dots" },
];

export const INCOME_CATEGORIES: CategoryDef[] = [
  { key: "salary", label: "เงินเดือน", dot: "#1b6b4a", icon: "briefcase" },
  { key: "freelance", label: "ฟรีแลนซ์", dot: "#33558f", icon: "laptop" },
  { key: "sell", label: "ขายของ", dot: "#c98a1e", icon: "tag" },
  { key: "interest", label: "ดอกเบี้ย", dot: "#5f6259", icon: "percent" },
  { key: "gift", label: "ของขวัญ", dot: "#ffb38a", icon: "gift" },
  { key: "other-in", label: "อื่นๆ", dot: "#b9b4a7", icon: "dots" },
];

export const SUB_CATEGORIES: CategoryDef[] = [
  { key: "fun", label: "บันเทิง", dot: "#ffb38a", icon: "film" },
  { key: "music", label: "เพลง", dot: "#d4f06a", icon: "music" },
  { key: "net", label: "เน็ต/มือถือ", dot: "#33558f", icon: "wifi" },
  { key: "cloud", label: "คลาวด์", dot: "#9a9d93", icon: "cloud" },
  { key: "fit", label: "ฟิตเนส", dot: "#1b6b4a", icon: "dumbbell" },
  { key: "learn", label: "การเรียน", dot: "#33558f", icon: "book" },
  { key: "tools", label: "เครื่องมือ", dot: "#c98a1e", icon: "sliders" },
  { key: "other", label: "อื่นๆ", dot: "#b9b4a7", icon: "dots" },
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
export const SUB_CATALOG: { title: string; names: string[] }[] = [
  { title: "วิดีโอ", names: ["Netflix", "YouTube Premium", "Disney+ Hotstar", "Prime Video", "Max", "Viu", "WeTV", "iQIYI", "TrueID", "MONOMAX", "Apple TV+", "Crunchyroll", "Bilibili"] },
  { title: "เพลงและหนังสือเสียง", names: ["Spotify", "Apple Music", "YouTube Music", "JOOX", "LINE MUSIC", "TIDAL", "Deezer", "SoundCloud Go", "Audible"] },
  { title: "เน็ตบ้านและมือถือ", names: ["AIS Fibre", "True Online", "3BB", "NT Broadband", "AIS รายเดือน", "True รายเดือน", "dtac รายเดือน"] },
  { title: "AI และงาน", names: ["ChatGPT Plus", "Claude Pro", "Gemini Advanced", "Perplexity Pro", "GitHub Copilot", "Cursor", "Notion", "Canva Pro", "Microsoft 365", "Adobe Creative Cloud", "Figma", "Grammarly", "Zoom"] },
  { title: "คลาวด์และความปลอดภัย", names: ["iCloud+", "Google One", "Dropbox", "1Password", "Bitwarden", "NordVPN", "ExpressVPN", "Proton VPN", "Surfshark"] },
  { title: "เกม", names: ["PlayStation Plus", "Xbox Game Pass", "Nintendo Switch Online", "Apple Arcade", "Discord Nitro"] },
  { title: "สุขภาพและการเรียน", names: ["Fitness First", "Jetts Fitness", "Strava", "Headspace", "Duolingo", "Medium"] },
  { title: "อื่นๆ", names: ["Apple One", "X Premium", "Patreon", "Tinder"] },
];

export const MONO_TONES = ["#2f5b45", "#33558f", "#8a2e22", "#6e3a1c", "#5b4a7a", "#1c1e1b"];

export const TYPE_META: Record<TxType, { label: string; color: string; tint: string; sign: string }> = {
  in: { label: "รายรับ", color: "var(--color-income)", tint: "var(--color-income-tint)", sign: "+" },
  out: { label: "รายจ่าย", color: "var(--color-expense)", tint: "var(--color-expense-tint)", sign: "−" },
  move: { label: "โอน", color: "var(--color-transfer)", tint: "var(--color-transfer-tint)", sign: "" },
};

const ALL_CATEGORIES = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES, ...SUB_CATEGORIES];

export function categoryLabel(key?: string): string {
  if (!key) return "";
  return ALL_CATEGORIES.find((c) => c.key === key)?.label ?? key;
}

export function categoryIcon(key?: string): IconName {
  return ALL_CATEGORIES.find((c) => c.key === key)?.icon ?? "dots";
}
