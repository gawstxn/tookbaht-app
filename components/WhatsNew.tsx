"use client"

import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useStore } from "@/lib/store"
import { newSince } from "@/lib/whatsNew"
import { Icon } from "./ui/Icon"
import { PrimaryButton, Sheet } from "./ui/primitives"

const VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0"

/** "มีอะไรใหม่": after an update, a centred dialog with the highlights since the version this account last saw. Once per version. */
export function WhatsNew() {
  const { t } = useTranslation()
  const lastSeen = useStore((s) => s.settings.lastSeenVersion)
  const setSettings = useStore((s) => s.setSettings)
  // Decide once when the screen opens, so closing slides the drawer out instead of unmounting it.
  const [items] = useState(() => newSince(lastSeen, VERSION))
  const [open, setOpen] = useState(items.length > 0)
  const close = () => {
    setOpen(false)
    setSettings({ lastSeenVersion: VERSION })
  }
  if (!items.length) return null

  return (
    <Sheet variant="modal" open={open} onClose={close} title={t("whatsNew.title", { version: VERSION })}>
      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <li key={item.key} className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-lime-tint text-lime-ink"
            >
              <Icon name={item.icon} size={18} strokeWidth={2} />
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="text-[15px] font-semibold">{t(`whatsNew.${item.key}.title`)}</span>
              <span className="text-[13px] leading-relaxed text-muted">{t(`whatsNew.${item.key}.body`)}</span>
            </span>
          </li>
        ))}
      </ul>
      <PrimaryButton onClick={close}>{t("common.gotIt")}</PrimaryButton>
    </Sheet>
  )
}
