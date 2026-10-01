"use client"

import { useState } from "react"
import { Trans, useTranslation } from "react-i18next"
import { useStore } from "@/lib/store"
import { PrimaryButton } from "./ui/primitives"

const docLink = "font-semibold text-ink underline"

/** "I have read and agree to the Terms of Use and Privacy Policy" checkbox. Links open in a new tab so nothing typed is lost. */
export function TermsCheckbox({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-[14px] border border-line bg-card px-3.5 py-3 text-sm leading-relaxed">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-5 w-5 shrink-0 accent-ink"
      />
      <span>
        <Trans
          i18nKey="legal.agree"
          components={{
            terms: <a href="/terms" target="_blank" rel="noreferrer" className={docLink} />,
            privacy: <a href="/privacy" target="_blank" rel="noreferrer" className={docLink} />,
          }}
        />
      </span>
    </label>
  )
}

/**
 * Shown instead of the app to signed-in users who haven't accepted the
 * current terms (existing accounts, or after TERMS_VERSION changes).
 */
export function TermsGate() {
  const { t } = useTranslation()
  const acceptTerms = useStore((s) => s.acceptTerms)
  const updated = useStore((s) => !!s.settings.termsAcceptedVersion)
  const [ok, setOk] = useState(false)
  return (
    <main className="flex min-h-dvh flex-col gap-5 px-6 pt-[calc(40px+env(safe-area-inset-top)+var(--standalone-top,0px))] pb-[calc(32px+env(safe-area-inset-bottom))]">
      <header className="flex flex-col gap-2">
        <h1 className="font-serif text-[26px] leading-tight font-bold">
          {t(updated ? "legal.gateUpdatedTitle" : "legal.gateTitle")}
        </h1>
        <p className="text-sm text-muted">{t("legal.gateLead")}</p>
      </header>
      <TermsCheckbox checked={ok} onChange={setOk} />
      <div className="mt-auto">
        <PrimaryButton once disabled={!ok} onClick={acceptTerms}>
          {t("legal.accept")}
        </PrimaryButton>
      </div>
    </main>
  )
}
