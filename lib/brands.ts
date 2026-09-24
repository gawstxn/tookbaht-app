import { BRANDS, type Brand } from "./brands.data";

export type { Brand };
export { BRANDS };

/** "YouTube Premium" → "youtubepremium", "iCloud+" → "icloudplus". */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\+/g, "plus")
    // Keep marks (\p{M}) so Thai vowels/tones survive: "ยูทูบ" stays "ยูทูบ".
    .replace(/[^\p{L}\p{M}\p{N}]/gu, "");
}

/**
 * The brand a subscription name refers to: an exact alias match first, then
 * a name that starts with an alias ("Netflix Premium" → Netflix). Short
 * aliases (e.g. "x", "line") only match exactly.
 */
export function findBrand(name: string): Brand | undefined {
  const n = normalizeName(name);
  if (!n) return undefined;
  return (
    BRANDS.find((b) => b.aliases.includes(n)) ??
    BRANDS.find((b) => b.aliases.some((a) => a.length >= 5 && n.startsWith(a)))
  );
}

/** Dark or white foreground, whichever reads better on the brand colour. */
export function onColor(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const lum = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return lum > 0.4 ? "#1c1e1b" : "#ffffff";
}

/** Subscription category (see SUB_CATEGORIES) that fits each known service. */
const BRAND_CATEGORY: Record<string, string> = {
  netflix: "fun", youtube: "fun", appletv: "fun", max: "fun", disneyplus: "fun", primevideo: "fun", viu: "fun",
  wetv: "fun", iqiyi: "fun", trueid: "fun", monomax: "fun", crunchyroll: "fun", bilibili: "fun", twitch: "fun",
  playstation: "fun", steam: "fun", xbox: "fun", nintendo: "fun", discord: "fun", tinder: "fun", patreon: "fun",
  spotify: "music", youtubemusic: "music", applemusic: "music", line: "music", tidal: "music", deezer: "music",
  soundcloud: "music", audible: "music",
  icloud: "cloud", googleone: "cloud", dropbox: "cloud", apple: "cloud", microsoft365: "cloud",
  strava: "fit", headspace: "fit",
  duolingo: "learn", medium: "learn",
};

/** Suggested category for a subscription name, or undefined (AI and dev tools fall under "tools"). */
export function suggestCategory(name: string): string | undefined {
  const brand = findBrand(name);
  if (!brand) return undefined;
  return BRAND_CATEGORY[brand.key] ?? "tools";
}
