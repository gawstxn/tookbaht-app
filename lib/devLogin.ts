/** Fixed local test user; created on first use (local Supabase needs no email confirmation). */
export const DEV_EMAIL = "dev@tookbaht.local"
export const DEV_PASSWORD = "tookbaht-dev"

/**
 * One-tap dev sign-in is on only with NEXT_PUBLIC_DEV_LOGIN=true *and* a
 * Supabase on this machine — never against a hosted project.
 */
export const localDevLogin =
  process.env.NEXT_PUBLIC_DEV_LOGIN === "true" &&
  /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "")
