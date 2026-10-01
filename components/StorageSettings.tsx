"use client"

import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { keepScreensOffline } from "@/lib/offlineScreens"
import { clearKeptFiles, clearable, formatBytes, measureStorage, type StorageUse } from "@/lib/storageUse"
import { useStore } from "@/lib/store"
import { ConfirmSheet } from "./ConfirmSheet"
import { NavRow } from "./settingsUi"
import { ListCard, PrimaryButton, SecondaryButton, Sheet } from "./ui/primitives"

/**
 * Settings row showing how much the app keeps on this device, with a drawer
 * that breaks it down and clears the files that can be downloaded again.
 */
export function StorageSettings() {
  const { t: tr } = useTranslation()
  const notify = useStore((s) => s.notify)
  const offline = useStore((s) => s.offline)
  const [use, setUse] = useState<StorageUse | null>(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    let live = true
    void measureStorage().then((u) => {
      if (live) setUse(u)
    })
    return () => {
      live = false
    }
  }, [])

  const clear = async () => {
    setBusy(true)
    await clearKeptFiles()
    setUse(await measureStorage())
    setBusy(false)
    setConfirming(false)
    setOpen(false)
    notify(tr("storage.cleared"))
    // The screens needed offline are fetched again in the background.
    keepScreensOffline()
  }

  const total = use ? clearable(use) + use.data : 0
  const nothing = !use || clearable(use) === 0
  return (
    <>
      <NavRow label={tr("storage.row")} value={use ? formatBytes(total) : undefined} onClick={() => setOpen(true)} />
      <Sheet open={open && !confirming} onClose={() => !busy && setOpen(false)} title={tr("storage.row")}>
        <p className="text-sm text-muted">{tr("storage.lead")}</p>
        <ListCard>
          <Size label={tr("storage.screens")} hint={tr("storage.screensHint")} bytes={use?.screens} />
          <Size label={tr("storage.slipReader")} hint={tr("storage.slipReaderHint")} bytes={use?.slipReader} />
          <Size label={tr("storage.data")} hint={tr("storage.dataHint")} bytes={use?.data} />
        </ListCard>
        <p className="text-xs leading-relaxed text-muted">{tr(offline ? "storage.offline" : "storage.clearHint")}</p>
        <PrimaryButton disabled={busy || nothing || offline} onClick={() => setConfirming(true)}>
          {busy
            ? tr("storage.clearing")
            : nothing
              ? tr("storage.nothing")
              : tr("storage.clear", { size: formatBytes(clearable(use)) })}
        </PrimaryButton>
        <SecondaryButton onClick={() => !busy && setOpen(false)}>{tr("common.cancel")}</SecondaryButton>
      </Sheet>
      <ConfirmSheet
        open={open && confirming}
        onClose={() => !busy && setConfirming(false)}
        title={tr("storage.confirmTitle")}
        lead={tr("storage.confirmLead", { size: use ? formatBytes(clearable(use)) : "" })}
        confirmLabel={tr("storage.confirm")}
        onConfirm={() => void clear()}
      />
    </>
  )
}

function Size({ label, hint, bytes }: { label: string; hint: string; bytes?: number }) {
  return (
    <div className="flex min-h-[60px] items-center justify-between gap-3 py-2.5">
      <span className="flex flex-col gap-0.5">
        <span className="text-[15px]">{label}</span>
        <span className="text-xs text-muted">{hint}</span>
      </span>
      <span className="font-mono text-[13px] font-semibold whitespace-nowrap">
        {bytes === undefined ? "—" : formatBytes(bytes)}
      </span>
    </div>
  )
}
