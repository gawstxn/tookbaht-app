"use client"

import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { baht2 } from "@/lib/format"
import { knownPeople, splitShare } from "@/lib/ious"
import { useStore } from "@/lib/store"
import { PersonField, personTone } from "./ious"
import { Icon } from "./ui/Icon"
import { Card, Monogram, PrimaryButton, Sheet } from "./ui/primitives"

const MAX_FRIENDS = 19

/**
 * Friends a subscription or recurring bill is shared with: each charge the
 * app logs also records what every friend owes (split evenly with the user,
 * done by the database when it logs the charge).
 */
export function SplitWithField({
  names,
  onChange,
  perCharge,
  autoLog,
}: {
  names: string[]
  onChange: (names: string[]) => void
  perCharge: number | null
  autoLog: boolean
}) {
  const { t } = useTranslation()
  const ious = useStore((s) => s.ious)
  const suggestions = useMemo(() => knownPeople(ious).filter((n) => !names.includes(n)), [ious, names])
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState("")
  const clean = name.trim()
  const dup = names.some((n) => n.toLocaleLowerCase() === clean.toLocaleLowerCase())
  const share = perCharge && names.length ? splitShare(perCharge, names.length + 1) : 0

  return (
    <Card className="flex flex-col gap-2.5 px-4 py-3.5">
      <div className="flex flex-col gap-0.5">
        <span className="text-[15px] font-semibold">{t("shareSub.title")}</span>
        <span className="text-xs leading-relaxed text-muted">
          {!names.length
            ? t("shareSub.hint")
            : !autoLog
              ? t("shareSub.needsAutoLog")
              : share
                ? t("shareSub.each", { amount: baht2(share), count: names.length })
                : t("shareSub.eachLater")}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {names.map((n) => (
          <button
            key={n}
            type="button"
            aria-label={t("trip.removeFriend", { name: n })}
            onClick={() => onChange(names.filter((x) => x !== n))}
            className="flex min-h-9 items-center gap-1.5 rounded-full border border-line bg-paper pr-3 pl-1.5 text-[13px] font-medium"
          >
            <Monogram text={(n[0] ?? "?").toUpperCase()} tone={personTone(n)} size={24} />
            {n}
            <Icon name="close" size={12} strokeWidth={2.4} className="text-faint" />
          </button>
        ))}
        {names.length < MAX_FRIENDS ? (
          <button
            type="button"
            onClick={() => {
              setName("")
              setAdding(true)
            }}
            className="flex min-h-9 items-center gap-1.5 rounded-full border border-dashed border-line px-3.5 text-[13px] font-medium text-muted"
          >
            <Icon name="plus" size={14} strokeWidth={2.2} />
            {t("trip.addFriend")}
          </button>
        ) : null}
      </div>
      <Sheet open={adding} onClose={() => setAdding(false)} title={t("trip.addFriend")}>
        <PersonField value={name} onChange={setName} names={suggestions} />
        {dup ? <span className="text-xs text-danger">{t("trip.friendTaken")}</span> : null}
        <PrimaryButton
          disabled={!clean || dup}
          onClick={() => {
            onChange([...names, clean.slice(0, 60)])
            setAdding(false)
          }}
        >
          {t("trip.addFriend")}
        </PrimaryButton>
      </Sheet>
    </Card>
  )
}
