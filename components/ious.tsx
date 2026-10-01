"use client"

import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { MONO_TONES } from "@/lib/constants"
import { Chip } from "./ui/primitives"

/** A steady colour per name, so a friend keeps the same tile. */
export function personTone(name: string) {
  let h = 0
  for (const ch of name.trim().toLocaleLowerCase()) h = (h * 31 + ch.codePointAt(0)!) >>> 0
  return MONO_TONES[h % MONO_TONES.length]
}

/**
 * A friend's name with quick picks from names used before. `trailing` sits at
 * the right end of the same field (e.g. what that friend owes).
 */
export function PersonField({
  value,
  onChange,
  names,
  label,
  trailing,
}: {
  value: string
  onChange: (v: string) => void
  names: string[]
  label?: string
  trailing?: ReactNode
}) {
  const { t } = useTranslation()
  const input = (
    <input
      value={value}
      maxLength={60}
      onChange={(e) => onChange(e.target.value)}
      placeholder={t("ious.personPlaceholder")}
      aria-label={label ?? t("ious.person")}
      // Inside the bordered row the row sets the height, so it matches a plain field (44px).
      className={
        trailing
          ? "h-10 w-0 min-w-0 grow bg-transparent text-[15px] outline-none"
          : "min-h-11 w-full rounded-xl border border-line bg-card px-3 text-[15px] outline-none"
      }
    />
  )
  return (
    <div className="flex flex-col gap-2">
      {trailing ? (
        <div className="flex min-h-11 items-center gap-2 rounded-xl border border-line bg-card pr-3 pl-3">
          {input}
          <span aria-hidden="true" className="h-6 w-px shrink-0 bg-divider" />
          {trailing}
        </div>
      ) : (
        input
      )}
      {names.length ? (
        <div className="flex flex-wrap gap-1.5">
          {names.map((n) => (
            <Chip key={n} size="sm" on={n === value.trim()} onClick={() => onChange(n)}>
              {n}
            </Chip>
          ))}
        </div>
      ) : null}
    </div>
  )
}
