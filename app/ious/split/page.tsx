"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { PushScreen, TxIcon } from "@/components/app"
import { PersonField } from "@/components/ious"
import { Icon } from "@/components/ui/Icon"
import { BahtInput } from "@/components/BahtInput"
import { Card, Empty, PrimaryButton, PushHeader, Segmented, cx } from "@/components/ui/primitives"
import { baht2, shortDate } from "@/lib/format"
import { customSplit, knownPeople, splitShare } from "@/lib/ious"
import { useGoBack } from "@/lib/nav"
import { useStore } from "@/lib/store"
import { txTitle } from "@/lib/txTitle"

export default function SplitPage() {
  return (
    <Suspense>
      <SplitForm />
    </Suspense>
  )
}

const money = (s: string) => s.replace(/[^0-9.]/g, "")

/** Split a saved expense: evenly, or by an amount per friend with the user covering the rest. */
function SplitForm() {
  const { t } = useTranslation()
  const router = useRouter()
  const goBack = useGoBack("/transactions")
  const params = useSearchParams()
  const txs = useStore((s) => s.transactions)
  const accounts = useStore((s) => s.accounts)
  const ious = useStore((s) => s.ious)
  const addIous = useStore((s) => s.addIous)
  const bill = txs.find((x) => x.id === params.get("tx"))
  const names = useMemo(() => knownPeople(ious), [ious])
  // Friends only; the user is the extra person in the split.
  const [friends, setFriends] = useState<string[]>([""])
  const [mode, setMode] = useState<"equal" | "custom">("equal")
  // Typed amounts per friend (custom mode), kept in step with `friends`.
  const [amounts, setAmounts] = useState<string[]>([""])
  const people = friends.length + 1
  const share = bill ? splitShare(bill.amount, people) : 0
  const custom = customSplit(
    bill?.amount ?? 0,
    amounts.map((a) => (a ? Number(a) : NaN)),
  )
  const owed = mode === "equal" ? friends.map(() => share) : amounts.map(Number)
  const named = friends.map((f) => f.trim()).filter(Boolean)
  const amountsOk = mode === "equal" ? share > 0 : custom.ok
  const canSave =
    !!bill &&
    amountsOk &&
    named.length === friends.length &&
    new Set(named.map((n) => n.toLocaleLowerCase())).size === named.length

  const setFriend = (i: number, v: string) => setFriends((xs) => xs.map((x, j) => (j === i ? v : x)))
  const setAmount = (i: number, v: string) => setAmounts((xs) => xs.map((x, j) => (j === i ? money(v) : x)))

  if (!bill) {
    return (
      <PushScreen>
        <PushHeader title={t("split.title")} onBack={goBack} />
        <Empty>{t("split.missing")}</Empty>
      </PushScreen>
    )
  }

  return (
    <PushScreen>
      <PushHeader title={t("split.title")} backIcon="close" onBack={goBack} />

      <Card className="flex items-center gap-3 px-4 py-3">
        <TxIcon type={bill.type} category={bill.category} />
        <span className="flex min-w-0 grow flex-col">
          <span className="truncate text-[15px] font-medium">{txTitle(bill, accounts)}</span>
          <span className="text-xs text-muted">{shortDate(bill.date)}</span>
        </span>
        <span className="font-mono text-[15px] font-semibold">{baht2(bill.amount)}</span>
      </Card>

      <div className="flex items-center justify-between">
        <span className="flex flex-col">
          <span className="text-[15px] font-semibold">{t("split.people", { count: people })}</span>
          <span className="text-xs text-muted">{t("split.includingYou")}</span>
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={t("split.fewer")}
            disabled={friends.length <= 1}
            onClick={() => {
              setFriends((xs) => xs.slice(0, -1))
              setAmounts((xs) => xs.slice(0, -1))
            }}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-card text-xl font-semibold disabled:opacity-40"
          >
            −
          </button>
          <span className="w-6 text-center font-mono text-lg font-semibold">{people}</span>
          <button
            type="button"
            aria-label={t("split.more")}
            disabled={friends.length >= 19}
            onClick={() => {
              setFriends((xs) => [...xs, ""])
              setAmounts((xs) => [...xs, ""])
            }}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-card disabled:opacity-40"
          >
            <Icon name="plus" size={18} strokeWidth={2.2} />
          </button>
        </div>
      </div>

      <Segmented
        label={t("split.mode")}
        value={mode}
        onChange={setMode}
        options={[
          { value: "equal", label: t("split.equal") },
          { value: "custom", label: t("split.custom") },
        ]}
      />

      <div className="flex items-center gap-2.5 rounded-2xl bg-hero px-4 py-3.5 text-[13px] text-on-hero">
        <span
          className={cx(
            "h-2 w-2 shrink-0 rounded-full",
            mode === "custom" && custom.yours < 0 ? "bg-peach" : "bg-lime",
          )}
        />
        <span className="grow">
          {mode === "equal" ? t("split.each") : custom.yours < 0 ? t("split.overBill") : t("split.yours")}
        </span>
        <span
          className={cx(
            "font-mono text-[15px] font-semibold",
            mode === "custom" && custom.yours < 0 ? "text-peach" : "text-lime",
          )}
        >
          {baht2(mode === "equal" ? share : Math.abs(custom.yours))}
        </span>
      </div>

      <div className="flex flex-col gap-3">
        {friends.map((f, i) => (
          <div key={i} className="flex flex-col gap-2">
            <PersonField
              value={f}
              onChange={(v) => setFriend(i, v)}
              label={t("split.friendN", { n: i + 1 })}
              // Offer each name once across the form.
              names={names.filter((n) => n === f.trim() || !friends.some((x) => x.trim() === n))}
              trailing={
                mode === "custom" ? (
                  <span className="flex shrink-0 items-center gap-1 text-[15px]">
                    <span className="font-mono text-muted">฿</span>
                    <BahtInput
                      value={amounts[i] ?? ""}
                      onChange={(e) => setAmount(i, e.target.value)}
                      placeholder="0"
                      aria-label={f.trim() ? t("split.owes", { name: f.trim() }) : t("split.amountN", { n: i + 1 })}
                      className="w-24 min-w-0 bg-transparent text-right font-mono outline-none"
                    />
                  </span>
                ) : undefined
              }
            />
          </div>
        ))}
      </div>

      <div className="mt-auto flex flex-col gap-2">
        <p className="text-center text-xs leading-relaxed text-muted">
          {t("split.hint", { amount: baht2(mode === "equal" ? share * friends.length : custom.friends) })}
        </p>
        <PrimaryButton
          once
          disabled={!canSave}
          onClick={() => {
            addIous(
              named.map((person, i) => ({
                person,
                amount: owed[i],
                note: txTitle(bill, accounts),
                date: bill.date,
                transactionId: bill.id,
                settledOn: null,
              })),
            )
            router.replace("/ious")
          }}
        >
          {t("split.save")}
        </PrimaryButton>
      </div>
    </PushScreen>
  )
}
