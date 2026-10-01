"use client"

import { useState } from "react"
import { useTranslation } from "react-i18next"
import { PinPad } from "@/components/AppLock"
import { ListCard, SecondaryButton, Sheet, SwitchRow } from "@/components/ui/primitives"
import {
  biometricSupported,
  checkPin,
  makeLock,
  readLock,
  registerBiometric,
  setUnlocked,
  writeLock,
  type LockConfig,
} from "@/lib/appLock"
import { useStore } from "@/lib/store"

type Step = "menu" | "new" | "confirm" | "current"

/** Turn the app lock on or off, change the PIN, and add Face ID / Touch ID. */
export function LockSettings({
  open,
  onClose,
  onChange,
}: {
  open: boolean
  onClose: () => void
  onChange: (c: LockConfig | null) => void
}) {
  const { t } = useTranslation()
  const notify = useStore((s) => s.notify)
  const [config, setConfig] = useState<LockConfig | null>(null)
  const [step, setStep] = useState<Step>("menu")
  const [first, setFirst] = useState("")
  const [error, setError] = useState<string>()
  const [then, setThen] = useState<"off" | "change">("off")
  const [wasOpen, setWasOpen] = useState(false)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      const c = readLock()
      setConfig(c)
      setStep(c ? "menu" : "new")
      setError(undefined)
    }
  }

  const save = (c: LockConfig | null) => {
    // The user is here, so setting or changing the lock mustn't lock them out right away.
    setUnlocked(true)
    writeLock(c)
    setConfig(c)
    onChange(c)
  }

  const title =
    step === "new"
      ? t("lock.setPin")
      : step === "confirm"
        ? t("lock.confirmPin")
        : step === "current"
          ? t("lock.currentPin")
          : t("lock.settings")

  return (
    <Sheet open={open} onClose={onClose} title={title}>
      {step === "menu" && config ? (
        <>
          <ListCard>
            {biometricSupported() ? (
              <SwitchRow
                label={t("lock.biometric")}
                hint={t("lock.biometricHint")}
                checked={!!config.credentialId}
                onChange={async (on) => {
                  if (!on) return save({ ...config, credentialId: undefined })
                  try {
                    save({ ...config, credentialId: await registerBiometric() })
                  } catch (e) {
                    console.error(e)
                    // Name the browser's reason (e.g. NotAllowedError when cancelled) so a failure can be told apart.
                    const reason = e instanceof Error && e.name !== "Error" ? ` (${e.name})` : ""
                    notify(t("lock.biometricFailed") + reason, { tone: "error" })
                  }
                }}
              />
            ) : null}
            <button
              type="button"
              onClick={() => {
                setThen("change")
                setStep("current")
              }}
              className="flex min-h-[52px] w-full items-center text-left text-[15px]"
            >
              {t("lock.changePin")}
            </button>
          </ListCard>
          <SecondaryButton
            tone="danger"
            onClick={() => {
              setThen("off")
              setStep("current")
            }}
          >
            {t("lock.turnOff")}
          </SecondaryButton>
        </>
      ) : null}

      {step === "current" && config ? (
        <PinPad
          key="current"
          length={config.length ?? 4}
          label={t("lock.currentPin")}
          error={error}
          onChange={() => setError(undefined)}
          onComplete={async (pin) => {
            if (!(await checkPin(config, pin))) return setError(t("lock.wrongPin"))
            if (then === "off") {
              save(null)
              notify(t("lock.turnedOff"))
              onClose()
            } else setStep("new")
          }}
        />
      ) : null}

      {step === "new" ? (
        <PinPad
          key="new"
          label={t("lock.setPinLead")}
          onComplete={(pin) => {
            setFirst(pin)
            setStep("confirm")
          }}
        />
      ) : null}

      {step === "confirm" ? (
        <PinPad
          key="confirm"
          label={t("lock.confirmPinLead")}
          error={error}
          onChange={() => setError(undefined)}
          onComplete={async (pin) => {
            if (pin !== first) {
              setError(t("lock.mismatch"))
              return
            }
            // Changing the PIN keeps Face ID if it was on.
            save({ ...(await makeLock(pin)), credentialId: config?.credentialId })
            notify(t("lock.turnedOn"))
            setStep("menu")
          }}
        />
      ) : null}
    </Sheet>
  )
}
