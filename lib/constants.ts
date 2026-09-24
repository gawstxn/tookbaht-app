import type { TxType } from "./types";

export interface CategoryDef {
  key: string;
  label: string;
  dot: string;
}

export const EXPENSE_CATEGORIES: CategoryDef[] = [
  { key: "food", label: "อาหาร", dot: "#c98a1e" },
  { key: "travel", label: "เดินทาง", dot: "#33558f" },
  { key: "shop", label: "ช้อปปิ้ง", dot: "#8a2e22" },
  { key: "bill", label: "ค่าน้ำไฟ", dot: "#5f6259" },
  { key: "health", label: "สุขภาพ", dot: "#1b6b4a" },
  { key: "fun", label: "บันเทิง", dot: "#ffb38a" },
  { key: "sub", label: "Subscriptions", dot: "#d4f06a" },
  { key: "other", label: "อื่นๆ", dot: "#b9b4a7" },
];

export const INCOME_CATEGORIES: CategoryDef[] = [
  { key: "salary", label: "เงินเดือน", dot: "#1b6b4a" },
  { key: "freelance", label: "ฟรีแลนซ์", dot: "#33558f" },
  { key: "sell", label: "ขายของ", dot: "#c98a1e" },
  { key: "interest", label: "ดอกเบี้ย", dot: "#5f6259" },
  { key: "gift", label: "ของขวัญ", dot: "#ffb38a" },
  { key: "other-in", label: "อื่นๆ", dot: "#b9b4a7" },
];

export const SUB_CATEGORIES: CategoryDef[] = [
  { key: "fun", label: "บันเทิง", dot: "#ffb38a" },
  { key: "music", label: "เพลง", dot: "#d4f06a" },
  { key: "cloud", label: "คลาวด์", dot: "#9a9d93" },
  { key: "fit", label: "ฟิตเนส", dot: "#1b6b4a" },
  { key: "learn", label: "การเรียน", dot: "#33558f" },
  { key: "tools", label: "เครื่องมือ", dot: "#c98a1e" },
  { key: "other", label: "อื่นๆ", dot: "#b9b4a7" },
];

export const POPULAR_SUBS = [
  "Netflix", "Spotify", "YouTube Premium", "Disney+ Hotstar", "iCloud+", "ChatGPT",
  "Claude", "Google One", "Apple Music", "Prime Video", "Viu", "Canva",
];

export const MONO_TONES = ["#2f5b45", "#33558f", "#8a2e22", "#6e3a1c", "#5b4a7a", "#1c1e1b"];

export const TYPE_META: Record<TxType, { label: string; color: string; tint: string; sign: string }> = {
  in: { label: "รายรับ", color: "var(--color-income)", tint: "var(--color-income-tint)", sign: "+" },
  out: { label: "รายจ่าย", color: "var(--color-expense)", tint: "var(--color-expense-tint)", sign: "−" },
  move: { label: "โอน", color: "var(--color-transfer)", tint: "var(--color-transfer-tint)", sign: "" },
};

export function categoryLabel(key?: string): string {
  if (!key) return "";
  const all = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES, ...SUB_CATEGORIES];
  return all.find((c) => c.key === key)?.label ?? key;
}
