"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { getSupabase } from "@/lib/supabase/client";

/** Fixed local test user; created on first use (local Supabase needs no email confirmation). */
const DEV_EMAIL = "dev@tookbaht.local";
const DEV_PASSWORD = "tookbaht-dev";

/** Only against a Supabase on this machine — never a hosted project, whatever the env flag says. */
const localSupabase = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");

/**
 * Local-development one-tap sign-in, so the app can be tried without Google
 * OAuth. Only rendered when NEXT_PUBLIC_DEV_LOGIN=true; keep the Email
 * provider disabled on the production Supabase project.
 */
export function DevLogin() {
  const { t: tr } = useTranslation();
  const [state, setState] = useState<"idle" | "busy" | "error">("idle");
  if (!localSupabase) return null;

  const signIn = async () => {
    setState("busy");
    const auth = getSupabase().auth;
    const credentials = { email: DEV_EMAIL, password: DEV_PASSWORD };
    let { error } = await auth.signInWithPassword(credentials);
    if (error?.code === "invalid_credentials") {
      ({ error } = await auth.signUp({ ...credentials, options: { data: { full_name: "Dev" } } }));
    }
    if (error) {
      console.error(error);
      setState("error");
      return;
    }
    // Full load so proxy.ts sees the new session cookies.
    window.location.replace("/");
  };

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-dashed border-faint p-3.5">
      <span className="text-xs font-semibold text-muted">{tr("dev.title")}</span>
      <button type="button" onClick={signIn} disabled={state === "busy"} className="min-h-11 rounded-xl bg-ink px-3.5 text-sm font-semibold text-on-ink">
        {state === "busy" ? tr("dev.signingIn") : tr("dev.signIn", { email: DEV_EMAIL })}
      </button>
      {state === "error" ? <p className="text-xs text-danger">{tr("dev.error")}</p> : null}
    </div>
  );
}
