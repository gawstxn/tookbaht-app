"use client"

import { useState } from "react"
import { useTranslation } from "react-i18next"
import { PushScreen } from "@/components/app"
import { BahtInput } from "@/components/BahtInput"
import { ConfirmSheet } from "@/components/ConfirmSheet"
import { AccountSheet } from "@/components/pickers"
import { Icon } from "@/components/ui/Icon"
import {
  Card,
  Chip,
  Empty,
  HeroCard,
  IconButton,
  ListCard,
  PrimaryButton,
  PushHeader,
  SecondaryButton,
  Sheet,
  cx,
} from "@/components/ui/primitives"
import { addDays, baht, baht2, displayYear, shortDate, todayISO } from "@/lib/format"
import { useGoBack } from "@/lib/nav"
import { entryDefaults } from "@/lib/quick"
import { useStore } from "@/lib/store"
import type { Wish } from "@/lib/types"
import { daysToDecide, heldBack, sortWishes } from "@/lib/wishes"

const WAITS = [3, 7, 14, 30]

/** Things the user wants, parked for a few days: bought, or money held back. */
export default function WishlistPage() {
  const { t } = useTranslation()
  const goBack = useGoBack("/profile")
  const wishes = useStore((s) => s.wishes)
  const today = todayISO()
  const year = today.slice(0, 4)
  // A short list: no need to memoise.
  const saved = heldBack(wishes, year)
  const { waiting, decided } = sortWishes(wishes)
  const waitingTotal = waiting.reduce((a, w) => a + w.price, 0)
  const [adding, setAdding] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const open = wishes.find((w) => w.id === openId) ?? null

  return (
    <PushScreen>
      <PushHeader
        title={t("wish.title")}
        onBack={goBack}
        action={<IconButton icon="plus" label={t("wish.add")} variant="dark" onClick={() => setAdding(true)} />}
      />

      <HeroCard label={t("wish.title")}>
        <div className="flex flex-col gap-1">
          <span className="text-[13px] text-on-ink-muted">
            {t("wish.heldBack", { year: displayYear(Number(year)) })}
          </span>
          <span className="font-mono text-4xl leading-tight font-semibold tracking-tight text-lime">
            {baht(saved.amount)}
          </span>
        </div>
        <span className="text-xs text-on-ink-muted">
          {t("wish.heldBackCount", { count: saved.count })} · {t("wish.waitingTotal", { amount: baht(waitingTotal) })}
        </span>
      </HeroCard>

      <p className="flex items-start gap-2 text-xs leading-relaxed text-muted">
        <Icon name="bag" size={16} strokeWidth={2} className="mt-px shrink-0" />
        {t("wish.hint")}
      </p>

      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold">{t("wish.waiting")}</h2>
        {waiting.length ? (
          <ListCard>
            {waiting.map((w) => {
              const days = daysToDecide(w, today)
              return (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => setOpenId(w.id)}
                  className="flex min-h-[60px] w-full items-center gap-3 text-left"
                >
                  <span className="flex min-w-0 grow flex-col">
                    <span className="truncate text-[15px] font-medium">{w.name}</span>
                    <span className="truncate text-xs text-muted">
                      {w.note || t("wish.since", { date: shortDate(new Date(w.createdAt).toISOString().slice(0, 10)) })}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <span className="font-mono text-[15px] font-semibold">{baht2(w.price)}</span>
                    <span
                      className="rounded-full bg-chip px-2 py-px text-[11px] font-semibold whitespace-nowrap"
                      style={days <= 0 ? { background: "var(--color-lime)", color: "var(--color-on-lime)" } : undefined}
                    >
                      {days <= 0 ? t("wish.ready") : t("wish.daysLeft", { count: days })}
                    </span>
                  </span>
                </button>
              )
            })}
          </ListCard>
        ) : (
          <Empty>{t("wish.empty")}</Empty>
        )}
      </section>

      {decided.length ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">{t("wish.decided")}</h2>
          <ListCard>
            {decided.slice(0, 20).map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() => setOpenId(w.id)}
                className="flex min-h-[56px] w-full items-center gap-3 text-left"
              >
                <span className="flex min-w-0 grow flex-col">
                  <span
                    className={cx(
                      "truncate text-[15px] font-medium",
                      w.status === "skipped" && "text-muted line-through",
                    )}
                  >
                    {w.name}
                  </span>
                  <span className="text-xs text-muted">
                    {t(w.status === "bought" ? "wish.boughtOn" : "wish.skippedOn", {
                      date: shortDate(w.decidedOn ?? w.decideOn),
                    })}
                  </span>
                </span>
                <span className={cx("font-mono text-[15px] font-semibold", w.status === "skipped" && "text-income")}>
                  {w.status === "skipped" ? `+${baht2(w.price)}` : baht2(w.price)}
                </span>
              </button>
            ))}
          </ListCard>
        </section>
      ) : null}

      <AddWishSheet open={adding} onClose={() => setAdding(false)} />
      <WishSheet wish={open} onClose={() => setOpenId(null)} />
    </PushScreen>
  )
}

function AddWishSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  const addWish = useStore((s) => s.addWish)
  const [name, setName] = useState("")
  const [price, setPrice] = useState("")
  const [note, setNote] = useState("")
  const [wait, setWait] = useState(7)
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setName("")
      setPrice("")
      setNote("")
      setWait(7)
    }
  }
  const value = parseFloat(price) || 0
  const canSave = name.trim().length > 0 && value > 0
  return (
    <Sheet open={open} onClose={onClose} title={t("wish.add")}>
      <input
        value={name}
        maxLength={80}
        onChange={(e) => setName(e.target.value)}
        placeholder={t("wish.namePlaceholder")}
        aria-label={t("wish.name")}
        className="min-h-11 w-full rounded-xl border border-line bg-card px-3 text-[15px] outline-none"
      />
      <label className="flex min-h-11 items-center gap-2 rounded-xl border border-line bg-card px-3 text-[15px]">
        <span className="grow text-sm text-muted">{t("wish.price")}</span>
        <span className="font-mono text-muted">฿</span>
        <BahtInput
          value={price}
          onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ""))}
          placeholder="0"
          aria-label={t("wish.price")}
          className="w-32 min-w-0 bg-transparent text-right font-mono outline-none"
        />
      </label>
      <input
        value={note}
        maxLength={200}
        onChange={(e) => setNote(e.target.value)}
        placeholder={t("wish.notePlaceholder")}
        aria-label={t("common.note")}
        className="min-h-11 w-full rounded-xl border border-line bg-card px-3 text-sm outline-none"
      />
      <div className="flex flex-col gap-2">
        <span className="pl-0.5 text-[11px] text-muted">{t("wish.waitFor")}</span>
        <div className="flex flex-wrap gap-2">
          {WAITS.map((d) => (
            <Chip key={d} size="sm" on={wait === d} onClick={() => setWait(d)}>
              {t("wish.days", { count: d })}
            </Chip>
          ))}
        </div>
        <span className="pl-0.5 text-xs text-muted">
          {t("wish.decideOn", { date: shortDate(addDays(todayISO(), wait)) })}
        </span>
      </div>
      <PrimaryButton
        disabled={!canSave}
        onClick={() => {
          addWish({
            name: name.trim(),
            price: Math.round(value * 100) / 100,
            note: note.trim(),
            decideOn: addDays(todayISO(), wait),
          })
          onClose()
        }}
      >
        {t("wish.save")}
      </PrimaryButton>
    </Sheet>
  )
}

function WishSheet({ wish, onClose }: { wish: Wish | null; onClose: () => void }) {
  const { t } = useTranslation()
  const txs = useStore((s) => s.transactions)
  const accounts = useStore((s) => s.accounts)
  const decideWish = useStore((s) => s.decideWish)
  const reopenWish = useStore((s) => s.reopenWish)
  const deleteWish = useStore((s) => s.deleteWish)
  const [kept, setKept] = useState<Wish | null>(wish)
  if (wish && wish !== kept) setKept(wish)
  const w = wish ?? kept
  const [sheet, setSheet] = useState<"" | "buy" | "account" | "delete">("")
  const [accountId, setAccountId] = useState("")
  if (!wish && sheet) setSheet("")
  const days = w ? daysToDecide(w, todayISO()) : 0
  const startBuy = () => {
    setAccountId(
      entryDefaults(
        txs,
        "out",
        accounts.map((a) => a.id),
      ).accountId ??
        accounts[0]?.id ??
        "",
    )
    setSheet("buy")
  }

  return (
    <>
      <Sheet open={!!wish && !sheet} onClose={onClose} title={w?.name ?? ""}>
        {w ? (
          <>
            <Card className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-muted">{t("wish.price")}</span>
              <span className="font-mono text-xl font-semibold">{baht2(w.price)}</span>
            </Card>
            {w.note ? <p className="text-sm text-muted">{w.note}</p> : null}
            {w.status === "waiting" ? (
              <>
                <p className="text-sm text-muted">
                  {days > 0
                    ? t("wish.stillWaiting", { count: days, date: shortDate(w.decideOn) })
                    : t("wish.timeToDecide")}
                </p>
                <PrimaryButton
                  onClick={() => {
                    decideWish(w.id, "skipped")
                    onClose()
                  }}
                >
                  {t("wish.skip", { amount: baht(w.price) })}
                </PrimaryButton>
                <SecondaryButton onClick={startBuy}>{t("wish.buy")}</SecondaryButton>
              </>
            ) : (
              <>
                <p className="text-sm text-muted">
                  {t(w.status === "bought" ? "wish.boughtOn" : "wish.skippedOn", {
                    date: shortDate(w.decidedOn ?? w.decideOn),
                  })}
                  {w.status === "bought" && w.transactionId ? ` · ${t("wish.logged")}` : ""}
                </p>
                <SecondaryButton
                  onClick={() => {
                    reopenWish(w.id)
                    onClose()
                  }}
                >
                  {t("wish.reopen")}
                </SecondaryButton>
              </>
            )}
            <SecondaryButton tone="danger" onClick={() => setSheet("delete")}>
              {t("wish.delete")}
            </SecondaryButton>
          </>
        ) : null}
      </Sheet>

      <Sheet open={!!wish && sheet === "buy"} onClose={() => setSheet("")} title={t("wish.buyTitle")}>
        {w ? (
          <>
            <p className="text-sm text-muted">
              {days > 0
                ? t("wish.buyEarly", { count: days })
                : t("wish.buyLead", { name: w.name, amount: baht2(w.price) })}
            </p>
            <ListCard>
              <button
                type="button"
                aria-haspopup="dialog"
                onClick={() => setSheet("account")}
                className="flex min-h-[52px] w-full items-center justify-between gap-3 text-left"
              >
                <span className="text-[15px]">{t("add.acc_out")}</span>
                <span className="flex items-center gap-1 text-[13px] text-muted">
                  {accounts.find((a) => a.id === accountId)?.name ?? t("common.selectAccount")}
                  <Icon name="chevronRight" size={16} strokeWidth={2} className="text-faint" />
                </span>
              </button>
            </ListCard>
            <PrimaryButton
              disabled={!accountId}
              onClick={() => {
                decideWish(w.id, "bought", accountId)
                onClose()
              }}
            >
              {t("wish.buyConfirm", { amount: baht2(w.price) })}
            </PrimaryButton>
            <SecondaryButton onClick={() => setSheet("")}>{t("common.cancel")}</SecondaryButton>
          </>
        ) : null}
      </Sheet>
      <AccountSheet
        open={!!wish && sheet === "account"}
        onClose={() => setSheet("buy")}
        title={t("add.acc_out")}
        value={accountId}
        onPick={setAccountId}
      />
      <ConfirmSheet
        open={!!wish && sheet === "delete"}
        onClose={() => setSheet("")}
        title={t("wish.deleteTitle", { name: w?.name ?? "" })}
        lead={t("wish.deleteLead")}
        confirmLabel={t("wish.delete")}
        onConfirm={() => {
          if (w) deleteWish(w.id)
          onClose()
        }}
      />
    </>
  )
}
