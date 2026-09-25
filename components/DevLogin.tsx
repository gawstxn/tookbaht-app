"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { getSupabase } from "@/lib/supabase/client";

/** Supabase's local mail catcher (supabase/config.toml → [local_smtp] port). */
const LOCAL_MAILBOX = "http://127.0.0.1:55324";

/**
 * Local-development sign-in by magic link, so the app can be tried without
 * Google OAuth credentials. Only rendered when NEXT_PUBLIC_DEV_LOGIN=true;
 * keep the Email provider disabled on the production Supabase project.
 */
export function DevLogin() {
  const { t: tr } = useTranslation();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("sending");
    const { error } = await getSupabase().auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback`, shouldCreateUser: true },
    });
    if (error) console.error(error);
    setState(error ? "error" : "sent");
  };

  return (
    <form onSubmit={send} className="flex flex-col gap-2 rounded-2xl border border-dashed border-faint p-3.5">
      <span className="text-xs font-semibold text-muted">{tr("dev.title")}</span>
      <div className="flex gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          aria-label={tr("dev.email")}
          className="min-h-11 min-w-0 grow rounded-xl border border-line bg-card px-3 text-sm outline-none"
        />
        <button type="submit" disabled={state === "sending"} className="min-h-11 shrink-0 rounded-xl bg-ink px-3.5 text-sm font-semibold text-on-ink">
          {state === "sending" ? tr("dev.sending") : tr("dev.send")}
        </button>
      </div>
      {state === "sent" ? (
        <p className="text-xs text-muted">
          {tr("dev.sent")}{" "}
          <a href={LOCAL_MAILBOX} target="_blank" rel="noreferrer" className="font-semibold text-ink underline">
            {LOCAL_MAILBOX.replace("http://", "")}
          </a>
        </p>
      ) : null}
      {state === "error" ? <p className="text-xs text-danger">{tr("dev.error")}</p> : null}
    </form>
  );
}
