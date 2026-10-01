"use client"

import { useState, useSyncExternalStore } from "react"
import { Trans, useTranslation } from "react-i18next"
import { currentInstallMode, isLineApp, promptInstall, subscribeInstall, type InstallMode } from "@/lib/install"
import { Icon, type IconName } from "./ui/Icon"
import { PrimaryButton, Sheet } from "./ui/primitives"

const STEPS: Record<"ios" | "android" | "inApp", [IconName, IconName, IconName]> = {
  ios: ["share", "addSquare", "check"],
  android: ["dots", "addSquare", "check"],
  inApp: ["dots", "share", "addSquare"],
}

/**
 * "Add to home screen" for visitors using the browser: the native prompt where
 * the browser offers one, step-by-step instructions otherwise (Safari, Android
 * browsers that don't prompt, in-app browsers that must hand off to a real one).
 * Hidden once installed.
 */
export function InstallPrompt() {
  const mode = useSyncExternalStore(subscribeInstall, currentInstallMode, () => "hidden" as InstallMode)
  const [help, setHelp] = useState<Exclude<InstallMode, "hidden" | "native"> | null>(null)
  const { t: tr } = useTranslation()
  if (mode === "hidden") return null

  const install = async () => {
    if (mode !== "native") return setHelp(mode)
    // The prompt can be used only once; if it's gone, fall back to the menu steps.
    if (!(await promptInstall())) setHelp("android")
  }

  const openInBrowser = () => {
    // LINE opens links carrying this parameter in the phone's default browser.
    const url = new URL(window.location.href)
    url.searchParams.set("openExternalBrowser", "1")
    window.location.href = url.toString()
  }

  const steps = help ? STEPS[help] : null
  return (
    <>
      <button
        type="button"
        onClick={install}
        className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-line bg-paper text-sm font-semibold"
      >
        <Icon name="addSquare" size={18} strokeWidth={2} />
        {tr("install.button")}
      </button>
      <Sheet
        open={help !== null}
        onClose={() => setHelp(null)}
        title={tr(help === "inApp" ? "install.inAppTitle" : "install.title")}
      >
        <p className="text-sm text-muted">{tr(help === "inApp" ? "install.inAppLead" : "install.lead")}</p>
        {help && steps ? (
          <ol className="flex flex-col gap-3">
            {steps.map((icon, i) => (
              <Step key={i} n={i + 1} icon={icon}>
                <Trans i18nKey={`install.${help}.step${i + 1}`} components={{ b: <b /> }} />
              </Step>
            ))}
          </ol>
        ) : null}
        {help === "android" && mode === "native" ? (
          // Chrome offered its prompt while the steps were open (it waits for some use of the page first).
          <PrimaryButton
            onClick={async () => {
              setHelp(null)
              await promptInstall()
            }}
          >
            {tr("install.installNow")}
          </PrimaryButton>
        ) : help === "inApp" && isLineApp(navigator.userAgent) ? (
          <PrimaryButton onClick={openInBrowser}>{tr("install.openInBrowser")}</PrimaryButton>
        ) : (
          <PrimaryButton onClick={() => setHelp(null)}>{tr("common.gotIt")}</PrimaryButton>
        )}
      </Sheet>
    </>
  )
}

function Step({ n, icon, children }: { n: number; icon: IconName; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3 rounded-2xl border border-line bg-card p-3 text-sm">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-bold text-on-ink">
        {n}
      </span>
      <span className="grow">{children}</span>
      <Icon name={icon} size={20} strokeWidth={2} className="shrink-0 text-muted" />
    </li>
  )
}
