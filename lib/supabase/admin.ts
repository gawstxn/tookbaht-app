import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseEnv } from "./env";

/**
 * Service-role client for background jobs. Bypasses RLS — only use it in
 * server code that isn't acting for a signed-in user (e.g. cron).
 */
export function createSupabaseAdmin() {
  const { url } = supabaseEnv();
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("Missing SUPABASE_SECRET_KEY — see .env.example");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
