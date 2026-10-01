"use client"

import { useState, useSyncExternalStore } from "react"
import { BrandMark } from "@/components/app"
import Link from "next/link"
import { DevLogin } from "@/components/DevLogin"
import { InstallPrompt } from "@/components/InstallPrompt"
import { findBrand } from "@/lib/brands"
import { useTranslation } from "react-i18next"
import { shortDate } from "@/lib/format"
import { applyLang, currentLang } from "@/lib/i18n"
import { getSupabase } from "@/lib/supabase/client"

const noop = () => () => {}
/** /auth/callback sends failed sign-ins back here with ?error=auth. */
const callbackFailed = () => new URLSearchParams(window.location.search).has("error")
/** After closing the account: ?deleted=YYYY-MM-DD, the day it is deleted for good. */
const deletedOn = () => new URLSearchParams(window.location.search).get("deleted") ?? ""

/** Google-only sign-in via Supabase Auth; Google redirects back to /auth/callback. */
export default function LoginPage() {
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState<boolean | null>(null)
  const urlError = useSyncExternalStore(noop, callbackFailed, () => false)
  const error = failed ?? urlError
  const deleted = useSyncExternalStore(noop, deletedOn, () => "")
  const { t: tr } = useTranslation()

  const handleGoogle = async () => {
    setBusy(true)
    setFailed(false)
    const { error } = await getSupabase().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) {
      console.error(error)
      setBusy(false)
      setFailed(true)
    }
  }

  return (
    <main className="flex min-h-dvh flex-col gap-6 px-6 pt-[calc(24px+env(safe-area-inset-top)+var(--standalone-top,0px))] pb-[calc(36px+env(safe-area-inset-bottom))]">
      <section className="flex grow flex-col justify-between gap-8 rounded-[28px] bg-hero px-6 py-7 text-on-hero shadow-hero">
        <div className="flex items-start justify-between">
          <span
            aria-hidden="true"
            className="flex h-[52px] w-[52px] items-center justify-center rounded-2xl bg-lime font-mono text-[26px] font-semibold text-on-lime"
          >
            ฿
          </span>
          <button
            type="button"
            onClick={() => applyLang(currentLang() === "th" ? "en" : "th")}
            aria-label={tr("lang.title")}
            className="min-h-9 rounded-full border border-ink-line px-3 text-xs font-semibold text-on-ink-muted"
          >
            {currentLang() === "th" ? "EN" : "TH"}
          </button>
        </div>

        <div aria-hidden="true" className="flex flex-col gap-2.5">
          <div className="flex flex-col gap-2 rounded-2xl bg-ink-2 p-3.5">
            <div className="flex justify-between text-xs text-on-ink-muted">
              <span>{tr("login.sampleLeft")}</span>
              <span>{tr("login.sample")}</span>
            </div>
            <span className="font-mono text-[26px] font-semibold tracking-tight">
              ฿21,930<span className="text-[15px] text-on-ink-faint">.00</span>
            </span>
            <div className="h-1 overflow-hidden rounded-full bg-ink-3">
              <div className="h-1 w-[55%] rounded-full bg-lime" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="flex items-center gap-2.5 rounded-2xl bg-ink-2 px-3.5 py-3">
              <BrandMark brand={findBrand("Netflix")!} size={30} />
              <span className="flex flex-col text-[11px] text-on-ink-muted">
                {tr("login.sampleDue")}
                <span className="font-mono text-[13px] font-semibold text-on-hero">฿419</span>
              </span>
            </div>
            <div className="flex flex-col justify-center gap-1.5 rounded-2xl bg-ink-2 px-3.5 py-3">
              <span className="flex justify-between text-[11px] text-on-ink-muted">
                {tr("login.sampleGoal")}
                <span className="font-semibold text-lime">97%</span>
              </span>
              <div className="h-1 overflow-hidden rounded-full bg-ink-3">
                <div className="h-1 w-[97%] rounded-full bg-lime" />
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <h1 className="font-serif text-[34px] leading-[1.25] font-bold">
            Tookbaht
            <br />
            <span className="text-lime">{tr("login.tagline")}</span>
          </h1>
          <p className="text-sm text-on-ink-muted">{tr("login.lead")}</p>
        </div>
      </section>

      <div className="flex flex-col gap-3.5">
        <button
          type="button"
          onClick={handleGoogle}
          disabled={busy}
          className="flex min-h-14 items-center justify-center gap-3 rounded-2xl border border-line bg-card text-base font-semibold shadow-[0_1px_2px_rgba(28,30,27,0.06)]"
        >
          <GoogleMark />
          {busy ? tr("login.signingIn") : tr("login.google")}
        </button>
        {/^\d{4}-\d{2}-\d{2}$/.test(deleted) ? (
          <p
            role="status"
            className="rounded-2xl border border-line bg-card px-4 py-3 text-center text-sm leading-relaxed text-muted"
          >
            {tr("deletion.closed", { date: shortDate(deleted) })}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="text-center text-sm text-danger">
            {tr("login.failed")}
          </p>
        ) : null}
        <InstallPrompt />
        {process.env.NEXT_PUBLIC_DEV_LOGIN === "true" ? <DevLogin /> : null}
        <p className="text-center text-xs leading-relaxed text-muted">
          {tr("login.agree")}{" "}
          <Link href="/terms" className="font-semibold text-ink underline">
            {tr("login.terms")}
          </Link>
          <br />
          {tr("login.and")}{" "}
          <Link href="/privacy" className="font-semibold text-ink underline">
            {tr("login.privacy")}
          </Link>
        </p>
      </div>
    </main>
  )
}

/** Google "G" mark, as used on Google's own sign-in buttons. */
function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48" width={22} height={22}>
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  )
}
