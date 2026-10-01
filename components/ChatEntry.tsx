"use client"

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { TYPE_META, categoryLabel, expenseCategories, incomeCategories } from "@/lib/constants"
import type { ChatLine } from "@/lib/chatLog"
import { baht2, shortDate, todayISO } from "@/lib/format"
import { entryDefaults, recentDuplicate } from "@/lib/quick"
import { parseQuickText, parseTransferText, quickTextEntry, splitQuickText, transferRoute } from "@/lib/quickText"
import { useStore } from "@/lib/store"
import { isDefaultTitle, txTitle } from "@/lib/txTitle"
import type { Transaction } from "@/lib/types"
import { TxIcon } from "./app"
import { BahtInput } from "./BahtInput"
import { ConfirmSheet } from "./ConfirmSheet"
import { AccountSheet, CategorySheet } from "./pickers"
import { Icon } from "./ui/Icon"
import { Card, PrimaryButton, Sheet, cx } from "./ui/primitives"

type Entry = Omit<Transaction, "id" | "createdAt">
/** A typed line and the entry it will be saved as. */
type Item = { entry: Entry; text: string }
/** Why a line can't be saved yet. */
type Problem = "amount" | "account" | "to" | "from" | "same"
/** What can be corrected on an entry from its answer. */
type FixWhat = "amount" | "category" | "account" | "from" | "to" | "delete"

/** Current time; read when sending (an event), not while rendering. */
const clock = () => Date.now()

/*
 * The on-screen keyboard covers the bottom of the page without resizing it, so
 * the screen is sized to the visible part and the text field sits just above
 * the keyboard.
 */
const subscribeViewport = (cb: () => void) => {
  const v = window.visualViewport
  if (!v) return () => {}
  const onChange = () => {
    // iOS slides the page up to reveal the focused field; the screen already ends at the keyboard.
    window.scrollTo(0, 0)
    cb()
  }
  v.addEventListener("resize", onChange)
  v.addEventListener("scroll", onChange)
  return () => {
    v.removeEventListener("resize", onChange)
    v.removeEventListener("scroll", onChange)
  }
}
const visibleHeight = () => Math.round(window.visualViewport?.height ?? 0)
const keyboardOpen = () => window.innerHeight - (window.visualViewport?.height ?? window.innerHeight) > 120

/**
 * The add screen as a chat: type "ค่าข้าว 50", send, and stay here for the
 * next one. Each line is saved at once and answered with the entry it became;
 * its category and account can be corrected from the answer.
 */
export function ChatEntry({
  header,
  date,
  lines,
  onLines,
  autoFocus,
}: {
  header: ReactNode
  /** Day for lines that don't name one (today, or the missed day being logged). */
  date: string
  lines: ChatLine[]
  onLines: (lines: ChatLine[]) => void
  autoFocus?: boolean
}) {
  const { t } = useTranslation()
  const accounts = useStore((s) => s.accounts)
  const txs = useStore((s) => s.transactions)
  const addTransaction = useStore((s) => s.addTransaction)
  const updateTransaction = useStore((s) => s.updateTransaction)
  const deleteTransaction = useStore((s) => s.deleteTransaction)
  const accountIds = useMemo(() => accounts.map((a) => a.id), [accounts])
  const today = todayISO()

  const [text, setText] = useState("")
  const [problem, setProblem] = useState<"" | Problem>("")
  const [duplicate, setDuplicate] = useState<{ items: Item[]; tx: Transaction; minutes: number } | null>(null)
  const [fixing, setFixing] = useState<{ id: string; what: FixWhat } | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const scroller = useRef<HTMLDivElement>(null)

  const height = useSyncExternalStore(subscribeViewport, visibleHeight, () => 0)
  const keyboard = useSyncExternalStore(subscribeViewport, keyboardOpen, () => false)

  // Keep the newest line in view, also when the keyboard opens.
  useEffect(() => {
    const el = scroller.current
    if (el) el.scrollTop = el.scrollHeight
  }, [lines.length, height])

  const categoriesFor = (type: Transaction["type"]) =>
    type === "in" ? incomeCategories() : expenseCategories().filter((c) => c.key !== "sub")

  const commit = (items: Item[]) => {
    onLines([...lines, ...items.map((i) => ({ text: i.text, txId: addTransaction(i.entry, { quiet: true }) }))])
    setText("")
    setProblem("")
  }

  const transferTitle = (toId: string) => t("add.transferTo", { name: accounts.find((a) => a.id === toId)?.name ?? "" })

  /** The entry one typed line saves as, or what's missing from it. */
  const read = (raw: string): Entry | Problem => {
    // "โอน 500 ไป ออมทรัพย์": money moved between the user's own accounts.
    const move = parseTransferText(raw, today, accounts)
    if (move) {
      if (!move.amount) return "amount"
      const route = transferRoute(move, entryDefaults(txs, "move", accountIds), accountIds)
      if (typeof route === "string") return route
      return {
        type: "move",
        amount: move.amount,
        date: move.date === today ? date : move.date,
        title: transferTitle(route.toId),
        ...route,
      }
    }
    const q = parseQuickText(raw, today, txs, accounts)
    const categories = categoriesFor(q.type)
    const usual = entryDefaults(txs, q.type, accountIds)
    const entry = quickTextEntry(
      { ...q, date: q.date === today ? date : q.date },
      { categories, accountIds },
      {
        category: categories.some((c) => c.key === usual.category) ? usual.category! : categories[0].key,
        accountId: usual.accountId ?? accountIds[0] ?? "",
      },
    )
    return entry ?? (q.amount ? "account" : "amount")
  }

  const send = () => {
    // One message can hold several entries ("ค่าข้าว 50 กาแฟ 65"); all of them are saved, or none.
    const items: Item[] = []
    for (const piece of splitQuickText(text)) {
      const entry = read(piece)
      if (typeof entry === "string") return setProblem(entry)
      items.push({ entry, text: piece })
    }
    if (!items.length) return
    // Ask before saving the same entry twice in a few minutes, as the form does.
    const now = clock()
    for (const { entry } of items) {
      const dup = recentDuplicate(txs, entry, now)
      if (dup) return setDuplicate({ items, tx: dup, minutes: Math.max(1, Math.round((now - dup.createdAt) / 60_000)) })
    }
    commit(items)
  }

  /** An account name for the examples: one money is usually moved into. */
  const exampleAccount = accounts.find((a) => a.kind === "saving") ?? accounts[1]
  const examples = [t("chat.ex1"), t("chat.ex2"), t("chat.ex3")]
  if (exampleAccount && accounts.length > 1) examples.push(t("chat.ex4", { name: exampleAccount.name }))

  const fixed = fixing ? txs.find((x) => x.id === fixing.id) : undefined

  return (
    <main
      style={height ? { height } : undefined}
      className={cx(
        "flex h-dvh flex-col gap-3 px-6 pt-[calc(12px+env(safe-area-inset-top)+var(--standalone-top,0px))]",
        keyboard ? "pb-2" : "pb-[calc(16px+env(safe-area-inset-bottom))]",
      )}
    >
      {header}

      <div ref={scroller} role="log" aria-live="polite" className="flex min-h-0 grow flex-col gap-3 overflow-y-auto">
        {lines.length === 0 ? (
          <div className="m-auto flex flex-col items-center gap-3 py-4 text-center">
            <span
              aria-hidden="true"
              className="flex h-12 w-12 items-center justify-center rounded-full bg-lime-tint text-lime-ink"
            >
              <Icon name="message" size={22} strokeWidth={2} />
            </span>
            <h2 className="font-serif text-lg font-bold">{t("chat.title")}</h2>
            <p className="max-w-[300px] text-sm leading-relaxed text-muted">{t("chat.lead")}</p>
            <div className="flex flex-wrap justify-center gap-2">
              {examples.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => {
                    setText(example)
                    setProblem("")
                    input.current?.focus()
                  }}
                  className="min-h-9 rounded-full border border-line bg-card px-3.5 text-[13px] font-medium"
                >
                  {example}
                </button>
              ))}
            </div>
            <p className="max-w-[300px] text-xs leading-relaxed text-muted">{t("chat.hint")}</p>
          </div>
        ) : (
          // The first line starts at the bottom, next to the field.
          <div className="mt-auto flex flex-col gap-3">
            {lines.map((line) => {
              const tx = txs.find((x) => x.id === line.txId)
              return (
                <div key={line.txId} className="flex flex-col gap-1.5">
                  <p className="max-w-[80%] self-end rounded-[18px] rounded-br-md bg-ink px-3.5 py-2 text-[15px] break-words text-on-ink">
                    {line.text}
                  </p>
                  {tx ? (
                    <Reply tx={tx} today={today} onFix={(what) => setFixing({ id: tx.id, what })} />
                  ) : (
                    <p className="self-start pl-1 text-xs text-muted">{t("chat.removed")}</p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {problem ? (
        <p role="alert" className="text-center text-xs text-danger">
          {t(`chat.problem.${problem}`, { name: exampleAccount?.name ?? "" })}
        </p>
      ) : null}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          send()
          // Stay in the field for the next line.
          input.current?.focus()
        }}
        className="flex items-center gap-2"
      >
        <input
          ref={input}
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            setProblem("")
          }}
          autoFocus={autoFocus}
          enterKeyHint="send"
          autoComplete="off"
          maxLength={300}
          // A text field drops line breaks: keep pasted lines apart so each becomes its own entry.
          onPaste={(e) => {
            const pasted = e.clipboardData.getData("text")
            if (!/\n/.test(pasted)) return
            e.preventDefault()
            setText((text + pasted.trim().replace(/\s*\n+\s*/g, ", ")).slice(0, 300))
            setProblem("")
          }}
          placeholder={t("chat.placeholder")}
          aria-label={t("chat.input")}
          className="min-h-12 min-w-0 grow rounded-full border border-line bg-card px-4 text-[15px] outline-none"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          aria-label={t("chat.send")}
          // Tapping the button mustn't take focus from the field (the keyboard would close).
          onPointerDown={(e) => e.preventDefault()}
          className={cx(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-full",
            text.trim() ? "bg-lime text-on-lime" : "bg-chip text-muted",
          )}
        >
          <Icon name="send" size={20} strokeWidth={2.4} />
        </button>
      </form>

      <Sheet open={fixing?.what === "amount" && !!fixed} onClose={() => setFixing(null)} title={t("chat.amountTitle")}>
        {fixed ? (
          <AmountForm
            key={fixed.id}
            tx={fixed}
            onSave={(amount) => {
              if (amount !== fixed.amount) updateTransaction(fixed.id, { amount })
              setFixing(null)
            }}
          />
        ) : null}
      </Sheet>
      <CategorySheet
        open={fixing?.what === "category" && !!fixed}
        onClose={() => setFixing(null)}
        title={t("common.category")}
        options={categoriesFor(fixed?.type ?? "out")}
        value={fixed?.category ?? ""}
        onPick={(category) => fixed && category !== fixed.category && updateTransaction(fixed.id, { category })}
      />
      <AccountSheet
        open={fixing?.what === "from" && !!fixed}
        onClose={() => setFixing(null)}
        title={t("add.fromTitle")}
        value={fixed?.fromId ?? ""}
        exclude={fixed?.toId}
        onPick={(fromId) => fixed && fromId !== fixed.fromId && updateTransaction(fixed.id, { fromId })}
      />
      <AccountSheet
        open={fixing?.what === "to" && !!fixed}
        onClose={() => setFixing(null)}
        title={t("add.toTitle")}
        value={fixed?.toId ?? ""}
        exclude={fixed?.fromId}
        onPick={(toId) =>
          fixed &&
          toId !== fixed.toId &&
          // A transfer is named after where it goes, unless the user named it.
          updateTransaction(fixed.id, {
            toId,
            ...(isDefaultTitle(fixed, accounts) ? { title: transferTitle(toId) } : {}),
          })
        }
      />
      <AccountSheet
        open={fixing?.what === "account" && !!fixed}
        onClose={() => setFixing(null)}
        title={t(fixed?.type === "in" ? "add.acc_in" : "add.acc_out")}
        value={fixed?.accountId ?? ""}
        onPick={(accountId) => fixed && accountId !== fixed.accountId && updateTransaction(fixed.id, { accountId })}
      />
      <ConfirmSheet
        open={fixing?.what === "delete" && !!fixed}
        onClose={() => setFixing(null)}
        title={t("tx.deleteTitle")}
        lead={fixed ? t("tx.deleteLead", { name: txTitle(fixed, accounts), amount: baht2(fixed.amount) }) : ""}
        confirmLabel={t("tx.delete")}
        onConfirm={() => {
          if (fixed) deleteTransaction(fixed.id)
          setFixing(null)
        }}
      />
      <ConfirmSheet
        tone="ink"
        open={!!duplicate}
        onClose={() => setDuplicate(null)}
        title={t("dup.title")}
        lead={
          duplicate
            ? t("dup.lead", {
                amount: baht2(duplicate.tx.amount),
                title: txTitle(duplicate.tx, accounts),
                minutes: duplicate.minutes,
              })
            : ""
        }
        confirmLabel={t("dup.save")}
        onConfirm={() => {
          if (duplicate) commit(duplicate.items)
          setDuplicate(null)
        }}
      />
    </main>
  )
}

/** Correct the amount of an entry just sent (a mistyped price). */
function AmountForm({ tx, onSave }: { tx: Transaction; onSave: (amount: number) => void }) {
  const { t } = useTranslation()
  const accounts = useStore((s) => s.accounts)
  const [text, setText] = useState(String(tx.amount))
  const amount = Math.round((parseFloat(text) || 0) * 100) / 100
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (amount > 0) onSave(amount)
      }}
      className="flex flex-col gap-3.5"
    >
      <p className="truncate text-sm text-muted">{txTitle(tx, accounts)}</p>
      <Card className="px-4 py-3.5">
        <label className="flex items-baseline">
          <span className="flex grow items-baseline gap-0.5 font-mono text-[24px] font-semibold">
            ฿
            <BahtInput
              autoFocus
              enterKeyHint="done"
              aria-label={t("chat.amountTitle")}
              value={text}
              onChange={(e) => setText(e.target.value.replace(/[^0-9.]/g, ""))}
              placeholder="0"
              className="w-full min-w-0 bg-transparent outline-none"
            />
          </span>
        </label>
      </Card>
      <PrimaryButton type="submit" disabled={amount <= 0}>
        {t("common.save")}
      </PrimaryButton>
    </form>
  )
}

/** The app's answer to a line: the saved entry, with its amount, category and account (or the two accounts of a transfer) open to correction. */
function Reply({ tx, today, onFix }: { tx: Transaction; today: string; onFix: (what: FixWhat) => void }) {
  const { t } = useTranslation()
  const accounts = useStore((s) => s.accounts)
  const meta = TYPE_META[tx.type]
  const name = (id?: string) => accounts.find((a) => a.id === id)?.name ?? "—"
  /** A chip that opens the picker for one part of the entry. */
  const pick = (
    what: FixWhat,
    label: string,
    aria: "chat.changeCategory" | "chat.changeAccount" | "chat.changeFrom" | "chat.changeTo",
  ) => (
    <button
      type="button"
      aria-haspopup="dialog"
      aria-label={t(aria, { name: label })}
      onClick={() => onFix(what)}
      className="flex min-h-9 min-w-0 items-center gap-1 rounded-full bg-chip pr-2.5 pl-3 text-xs font-medium"
    >
      <span className="truncate">{label}</span>
      <Icon name="chevronDown" size={12} strokeWidth={2.4} className="shrink-0 text-muted" />
    </button>
  )
  return (
    <div className="flex w-[88%] flex-col gap-2 self-start rounded-[18px] rounded-bl-md border border-line bg-card p-3">
      <div className="flex items-center gap-2.5">
        <TxIcon type={tx.type} category={tx.category} size={34} />
        <span className="min-w-0 grow truncate text-[15px] font-medium">{txTitle(tx, accounts)}</span>
        <button
          type="button"
          aria-haspopup="dialog"
          aria-label={t("chat.changeAmount", { amount: baht2(tx.amount) })}
          onClick={() => onFix("amount")}
          className="flex min-h-9 shrink-0 items-center gap-1.5 font-mono text-[15px] font-semibold whitespace-nowrap"
          style={{ color: meta.color }}
        >
          {meta.sign}
          {baht2(tx.amount)}
          <Icon name="pencil" size={13} strokeWidth={2} className="text-muted" />
        </button>
      </div>
      <div className="flex items-start gap-1.5">
        {/* The chips wrap among themselves; the delete button keeps its corner. */}
        <div className="flex min-w-0 grow flex-wrap items-center gap-1.5">
          {tx.type === "move" ? (
            <>
              {pick("from", name(tx.fromId), "chat.changeFrom")}
              <Icon name="chevronRight" size={12} strokeWidth={2.4} className="shrink-0 text-faint" />
              {pick("to", name(tx.toId), "chat.changeTo")}
            </>
          ) : (
            <>
              {pick("category", categoryLabel(tx.category), "chat.changeCategory")}
              {pick("account", name(tx.accountId), "chat.changeAccount")}
            </>
          )}
          {tx.date !== today ? <span className="pl-1 text-xs text-muted">{shortDate(tx.date, false)}</span> : null}
        </div>
        <button
          type="button"
          aria-label={t("tx.delete")}
          onClick={() => onFix("delete")}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted"
        >
          <Icon name="trash" size={16} strokeWidth={2} />
        </button>
      </div>
    </div>
  )
}
