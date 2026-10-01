/** Profile pictures the user can pick from (public/avatars/<key>.webp); there is no upload. */
export const AVATARS = [
  "young-woman-bob",
  "man-glasses-beard",
  "older-woman-bun",
  "person-beanie",
  "teen-curly-hair",
  "woman-hijab",
  "man-buzz-cut",
  "person-headphones",
  "cat",
  "shiba-dog",
  "red-panda",
  "owl",
  "frog",
  "elephant",
  "rabbit",
  "penguin",
] as const

/** Image path for a saved avatar key, or null for unknown keys (show the initial instead). */
export function avatarSrc(key?: string): string | null {
  return key && (AVATARS as readonly string[]).includes(key) ? `/avatars/${key}.webp` : null
}

/** Longest display name the profile accepts. */
export const NAME_MAX = 40

/** A display name as saved: inner spaces collapsed, trimmed, capped at NAME_MAX; "" when blank. */
export function cleanName(name: string): string {
  return name.replace(/\s+/g, " ").trim().slice(0, NAME_MAX).trim()
}
