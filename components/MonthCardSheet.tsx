"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import type { TFunction } from "i18next"
import { Icon } from "./ui/Icon"
import { PrimaryButton, Sheet, SwitchRow } from "./ui/primitives"
import { categoryLabel } from "@/lib/constants"
import { monthLabel } from "@/lib/format"
import { cardBaht, cardPct, monthCard, type MonthCard } from "@/lib/monthCard"
import { periodFor } from "@/lib/period"
import { useStartDay, useStore } from "@/lib/store"

/* Story-sized image (9:16). */
const W = 1080
const H = 1920
const PAD = 96

const SANS = '"IBM Plex Sans Thai", sans-serif'
const MONO = '"IBM Plex Mono", monospace'
const SERIF = '"Noto Serif Thai", serif'

/** The app's colour tokens, read at draw time so the image matches globals.css. */
function tokens() {
  const css = getComputedStyle(document.documentElement)
  const v = (name: string) => css.getPropertyValue(`--color-${name}`).trim()
  return {
    bg: v("hero"),
    text: v("on-hero"),
    muted: v("on-ink-muted"),
    faint: v("on-ink-faint"),
    lime: v("lime"),
    onLime: v("on-lime"),
    peach: v("peach"),
  }
}

/** Draw the month summary; percentages instead of baht unless `amounts`. */
async function drawCard(c: MonthCard, amounts: boolean, t: TFunction): Promise<Blob> {
  await Promise.all(
    [`700 72px ${SERIF}`, `400 40px ${SANS}`, `600 40px ${SANS}`, `600 56px ${MONO}`].map((f) =>
      document.fonts.load(f),
    ),
  )
  const k = tokens()
  const canvas = document.createElement("canvas")
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext("2d")!
  ctx.fillStyle = k.bg
  ctx.fillRect(0, 0, W, H)
  ctx.textBaseline = "alphabetic"

  const text = (s: string, x: number, y: number, font: string, color: string, align: CanvasTextAlign = "left") => {
    ctx.font = font
    ctx.fillStyle = color
    ctx.textAlign = align
    ctx.fillText(s, x, y)
  }

  // Header: the app mark and the month.
  ctx.fillStyle = k.lime
  ctx.beginPath()
  ctx.arc(PAD + 28, 200, 28, 0, Math.PI * 2)
  ctx.fill()
  text("฿", PAD + 28, 214, `600 36px ${SANS}`, k.onLime, "center")
  text("Tookbaht", PAD + 76, 214, `600 40px ${SANS}`, k.text)
  text(t("monthCard.heading"), PAD, 380, `400 44px ${SANS}`, k.muted)
  text(monthLabel(c.month), PAD, 470, `700 80px ${SERIF}`, k.text)

  // The headline: what was kept (or how far over income it went).
  const kept = c.net >= 0
  text(t(kept ? "monthCard.kept" : "monthCard.over"), PAD, 680, `400 44px ${SANS}`, k.muted)
  const big = amounts ? cardBaht(c.net) : c.keptPct !== null ? cardPct(c.keptPct) : "—"
  text(big, PAD - 6, 860, `600 ${big.length > 8 ? 150 : 180}px ${MONO}`, kept ? k.lime : k.peach)
  // With baht as the headline, add the share of income under it (in percent mode it is the headline).
  if (amounts && c.keptPct !== null)
    text(t("monthCard.ofIncome", { pct: cardPct(c.keptPct) }), PAD, 950, `400 40px ${SANS}`, k.muted)

  // Detail rows.
  const rows: [string, string][] = []
  if (amounts) {
    rows.push([t("monthCard.income"), cardBaht(c.income)], [t("monthCard.spent"), cardBaht(c.expense)])
  } else if (c.spentPct !== null) {
    rows.push([t("monthCard.spent"), t("monthCard.pctOfIncome", { pct: cardPct(c.spentPct) })])
  }
  if (c.top)
    rows.push([
      t("monthCard.top", { name: categoryLabel(c.top.key) }),
      amounts ? cardBaht(c.top.amount) : t("monthCard.pctOfSpending", { pct: cardPct(c.top.share) }),
    ])
  if (c.heldBack.count)
    rows.push(
      amounts
        ? [t("monthCard.heldBackCount", { count: c.heldBack.count }), cardBaht(c.heldBack.amount)]
        : [t("monthCard.heldBack"), t("monthCard.items", { count: c.heldBack.count })],
    )

  let y = 1130
  ctx.strokeStyle = k.faint
  ctx.globalAlpha = 0.35
  ctx.lineWidth = 2
  for (let i = 0; i < rows.length; i++) {
    ctx.beginPath()
    ctx.moveTo(PAD, y - 70)
    ctx.lineTo(W - PAD, y - 70)
    ctx.stroke()
    y += 150
  }
  ctx.globalAlpha = 1
  y = 1130
  for (const [label, value] of rows) {
    text(label, PAD, y + 12, `400 40px ${SANS}`, k.muted)
    text(value, W - PAD, y + 14, `600 48px ${amounts ? MONO : SANS}`, k.text, "right")
    y += 150
  }

  text(t("monthCard.footer"), PAD, H - 140, `400 36px ${SANS}`, k.faint)
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("png"))), "image/png"),
  )
}

/** Preview and share a month's summary as an image (for an IG story or LINE). */
export function MonthCardSheet({ open, onClose, month }: { open: boolean; onClose: () => void; month: string }) {
  const { t } = useTranslation()
  const txs = useStore((s) => s.transactions)
  const wishes = useStore((s) => s.wishes)
  const startDay = useStartDay()
  const card = useMemo(() => monthCard(txs, wishes, periodFor(month, startDay)), [txs, wishes, month, startDay])
  // Percentages by default: real amounts only when the user asks for them.
  const [amounts, setAmounts] = useState(false)
  const [image, setImage] = useState<{ key: string; blob: Blob; url: string } | null>(null)
  const [sharing, setSharing] = useState(false)
  const key = `${month}:${amounts}`

  // The preview's object URL; revoked when a new image replaces it and when the sheet goes away.
  const urlRef = useRef("")
  useEffect(() => {
    if (!open || !card) return
    let live = true
    void drawCard(card, amounts, t).then((blob) => {
      if (!live) return
      const url = URL.createObjectURL(blob)
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
      urlRef.current = url
      setImage({ key: `${card.month}:${amounts}`, blob, url })
    })
    return () => {
      live = false
    }
  }, [open, card, amounts, t])
  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    },
    [],
  )

  const shown = image?.key === key ? image : null

  const share = async () => {
    if (!shown) return
    const { notify } = useStore.getState()
    const file = new File([shown.blob], `tookbaht-${month}.png`, { type: "image/png" })
    setSharing(true)
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] })
      } else {
        const a = document.createElement("a")
        a.href = shown.url
        a.download = file.name
        a.click()
        notify(t("monthCard.saved"))
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") notify(t("monthCard.failed"), { tone: "error" })
    } finally {
      setSharing(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={t("monthCard.title")}>
      <div className="mx-auto aspect-[9/16] w-[62%] overflow-hidden rounded-[20px] bg-hero">
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element -- a generated blob, not a static asset
          <img src={shown.url} alt={t("monthCard.alt", { month: monthLabel(month) })} className="h-full w-full" />
        ) : null}
      </div>
      <SwitchRow
        label={t("monthCard.showAmounts")}
        hint={t("monthCard.showAmountsHint")}
        checked={amounts}
        onChange={setAmounts}
      />
      <PrimaryButton disabled={!shown || sharing} onClick={() => void share()}>
        <span className="flex items-center justify-center gap-2">
          <Icon name="share" size={18} strokeWidth={2} />
          {t("monthCard.share")}
        </span>
      </PrimaryButton>
    </Sheet>
  )
}
