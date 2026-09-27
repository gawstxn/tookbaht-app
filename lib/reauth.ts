"use client";

import { DEV_EMAIL, DEV_PASSWORD, localDevLogin } from "./devLogin";
import { getSupabase } from "./supabase/client";

/*
 * Confirming it's really you, for "forgot PIN", changing the PromptPay ID and
 * deleting the account: sign
 * in with Google again (forced to ask, not just pick an account), then carry
 * on. The intent is kept on this device across the redirect, and only counts
 * if the account's last sign-in is newer than the request. The database
 * checks the same thing for deletion, so skipping this in the browser gains
 * nothing.
 */

export type ReauthIntent = "unlock" | "delete" | "promptpay";
const KEY = "tookbaht-reauth";
/** A request older than this is ignored (matches the database's 10-minute window). */
const MAX_AGE_MS = 10 * 60_000;

/*
 * After confirming for "promptpay", editing is allowed for a few minutes, in
 * memory only: a reload or a typed URL doesn't reopen it.
 */
const EDIT_WINDOW_MS = 5 * 60_000;
let editUntil = 0;
export const allowPromptPayEdit = () => {
  editUntil = Date.now() + EDIT_WINDOW_MS;
};
export const canEditPromptPay = () => Date.now() < editUntil;
export const endPromptPayEdit = () => {
  editUntil = 0;
};

export function hasPendingReauth(): boolean {
  try {
    return !!localStorage.getItem(KEY);
  } catch {
    return false;
  }
}

export async function startReauth(intent: ReauthIntent): Promise<boolean> {
  try {
    localStorage.setItem(KEY, JSON.stringify({ intent, at: Date.now() }));
  } catch {
    return false;
  }
  const auth = getSupabase().auth;
  if (localDevLogin) {
    // No Google locally: signing in again with the dev user is the fresh sign-in.
    const { error } = await auth.signInWithPassword({ email: DEV_EMAIL, password: DEV_PASSWORD });
    if (error) return false;
    window.location.replace("/");
    return true;
  }
  const { error } = await auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}/auth/callback`, queryParams: { prompt: "login" } },
  });
  return !error;
}

/** After coming back: the pending intent, if the user really signed in again since asking. Clears it either way. */
export async function takeReauth(): Promise<ReauthIntent | null> {
  let pending: { intent: ReauthIntent; at: number } | null = null;
  try {
    pending = JSON.parse(localStorage.getItem(KEY) ?? "null");
    localStorage.removeItem(KEY);
  } catch {
    return null;
  }
  if (!pending || Date.now() - pending.at > MAX_AGE_MS) return null;
  const { data } = await getSupabase().auth.getUser();
  const last = Date.parse(data.user?.last_sign_in_at ?? "");
  // Small allowance for clock differences between this device and the server.
  return last >= pending.at - 5_000 ? pending.intent : null;
}
