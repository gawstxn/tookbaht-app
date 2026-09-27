"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { PushScreen } from "@/components/app";
import { BahtInput } from "@/components/BahtInput";
import { PersonField, personTone } from "@/components/ious";
import { Icon } from "@/components/ui/Icon";
import { Card, Chip, Empty, HeroCard, ListCard, Monogram, PrimaryButton, PushHeader, SecondaryButton, Sheet, cx } from "@/components/ui/primitives";
import { baht2, shortDate, todayISO } from "@/lib/format";
import { knownPeople } from "@/lib/ious";
import { useGoBack } from "@/lib/nav";
import { useStore } from "@/lib/store";
import { ME, TRIP_DRAFT_PREFIX, settleText, settleUp, tripShares, type TripBill } from "@/lib/tripSplit";
import { txTitle } from "@/lib/txTitle";

/** Bills friends paid on the trip (not in the user's own entries). */
interface FriendBill {
  id: string;
  title: string;
  amount: number;
  payer: string;
}

/** Work in progress per trip, kept on this device until it's saved. */
interface Draft {
  friends: string[];
  friendBills: FriendBill[];
  /** Who shares a bill, when not everyone. */
  shares: Record<string, string[]>;
}

const EMPTY: Draft = { friends: [], friendBills: [], shares: {} };
const draftKey = (tag: string) => `${TRIP_DRAFT_PREFIX}${tag}`;
const readDraft = (tag: string): Draft => {
  try {
    const raw = localStorage.getItem(draftKey(tag));
    return raw ? { ...EMPTY, ...JSON.parse(raw) } : EMPTY;
  } catch {
    return EMPTY;
  }
};
const writeDraft = (tag: string, d: Draft | null) => {
  try {
    if (d) localStorage.setItem(draftKey(tag), JSON.stringify(d));
    else localStorage.removeItem(draftKey(tag));
  } catch {
    // Not kept; fine.
  }
};

export default function TripSplitPage() {
  return (
    <Suspense>
      <TripSplit />
    </Suspense>
  );
}

/**
 * Settle up a trip: the user's expenses under the tag plus bills friends
 * paid, each shared by some of the group, reduced to a few transfers. The
 * ones involving the user become IOUs.
 */
function TripSplit() {
  const { t } = useTranslation();
  const router = useRouter();
  const goBack = useGoBack("/tags");
  const tag = useSearchParams().get("tag") ?? "";
  const txs = useStore((s) => s.transactions);
  const accounts = useStore((s) => s.accounts);
  const ious = useStore((s) => s.ious);
  const addIous = useStore((s) => s.addIous);
  const notify = useStore((s) => s.notify);
  const [draft, setDraftState] = useState<Draft>(() => readDraft(tag));
  const setDraft = (d: Draft) => {
    setDraftState(d);
    writeDraft(tag, d);
  };
  const [adding, setAdding] = useState<"" | "friend" | "bill">("");
  const [editing, setEditing] = useState<string | null>(null);
  const names = useMemo(() => knownPeople(ious), [ious]);
  const everyone = [ME, ...draft.friends];
  const who = (p: string) => (p === ME ? t("trip.you") : p);

  // The user's own expenses on the trip; ones already split with friends are left out.
  const splitIds = useMemo(() => new Set(ious.map((i) => i.transactionId).filter(Boolean)), [ious]);
  const mine = useMemo(() => txs.filter((x) => x.tag === tag && x.type === "out").sort((a, b) => a.date.localeCompare(b.date)), [txs, tag]);
  const skipped = mine.filter((x) => splitIds.has(x.id)).length;
  const bills: (TripBill & { date?: string })[] = [
    ...mine.filter((x) => !splitIds.has(x.id)).map((x) => ({ id: x.id, title: txTitle(x, accounts), amount: x.amount, payer: ME, people: [], date: x.date })),
    ...draft.friendBills.map((b) => ({ ...b, people: [] })),
  ].map((b) => ({ ...b, people: (draft.shares[b.id] ?? everyone).filter((p) => everyone.includes(p)) }));
  const transfers = draft.friends.length ? settleUp(bills) : [];
  const myShare = (tripShares(bills).get(ME) ?? 0) / 100;
  const total = bills.reduce((a, b) => a + b.amount, 0);
  const mineTransfers = transfers.filter((x) => x.from === ME || x.to === ME);

  const removeFriend = (name: string) =>
    setDraft({
      friends: draft.friends.filter((f) => f !== name),
      friendBills: draft.friendBills.filter((b) => b.payer !== name),
      shares: Object.fromEntries(Object.entries(draft.shares).map(([k, v]) => [k, v.filter((p) => p !== name)])),
    });

  const save = () => {
    const rows = mineTransfers.map((x) => ({
      direction: x.to === ME ? ("owed_to_me" as const) : ("i_owe" as const),
      person: x.to === ME ? x.from : x.to,
      amount: x.amount,
      note: tag,
      date: mine[mine.length - 1]?.date ?? todayISO(),
      transactionId: null,
      settledOn: null,
    }));
    if (rows.length) addIous(rows);
    writeDraft(tag, null);
    router.replace("/ious");
  };

  const share = async () => {
    const text = settleText(tag, transfers, t("trip.you"), (x) => t("trip.shareLine", x), baht2);
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        notify(t("trip.copied"));
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") notify(t("trip.shareFailed"), { tone: "error" });
    }
  };

  const bill = bills.find((b) => b.id === editing) ?? null;

  return (
    <PushScreen>
      <PushHeader title={t("trip.title")} onBack={goBack} />

      <HeroCard label={t("trip.title")}>
        <div className="flex flex-col gap-1">
          <span className="text-[13px] text-on-ink-muted">#{tag}</span>
          <span className="font-mono text-4xl font-semibold leading-tight tracking-tight">{baht2(total)}</span>
        </div>
        <span className="text-xs text-on-ink-muted">
          {t("trip.summary", { count: bills.length, people: everyone.length })} · {t("trip.yourShare", { amount: baht2(myShare) })}
        </span>
      </HeroCard>

      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold">{t("trip.people")}</h2>
        <div className="flex flex-wrap gap-2">
          <span className="flex min-h-9 items-center gap-1.5 rounded-full border border-ink bg-ink px-3.5 text-[13px] font-medium text-on-ink">{t("trip.you")}</span>
          {draft.friends.map((f) => (
            <button
              key={f}
              type="button"
              aria-label={t("trip.removeFriend", { name: f })}
              onClick={() => removeFriend(f)}
              className="flex min-h-9 items-center gap-1.5 rounded-full border border-line bg-card pl-1.5 pr-3 text-[13px] font-medium"
            >
              <Monogram text={(f[0] ?? "?").toUpperCase()} tone={personTone(f)} size={24} />
              {f}
              <Icon name="close" size={12} strokeWidth={2.4} className="text-faint" />
            </button>
          ))}
          <button type="button" onClick={() => setAdding("friend")} className="flex min-h-9 items-center gap-1.5 rounded-full border border-dashed border-line px-3.5 text-[13px] font-medium text-muted">
            <Icon name="plus" size={14} strokeWidth={2.2} />
            {t("trip.addFriend")}
          </button>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">{t("trip.bills")}</h2>
          {draft.friends.length ? (
            <button type="button" onClick={() => setAdding("bill")} className="min-h-9 text-[13px] font-semibold text-muted">
              {t("trip.addFriendBill")}
            </button>
          ) : null}
        </div>
        {bills.length ? (
          <ListCard>
            {bills.map((b) => (
              <button key={b.id} type="button" onClick={() => setEditing(b.id)} className="flex min-h-[56px] w-full items-center gap-3 text-left">
                <span className="flex min-w-0 grow flex-col">
                  <span className="truncate text-[15px] font-medium">{b.title}</span>
                  <span className={cx("text-xs", b.people.length ? "text-muted" : "text-danger")}>
                    {t("trip.paidBy", { name: who(b.payer) })} · {b.people.length === everyone.length ? t("trip.everyone") : t("trip.sharedBy", { count: b.people.length })}
                    {b.date ? ` · ${shortDate(b.date)}` : ""}
                  </span>
                </span>
                <span className="font-mono text-[15px] font-semibold">{baht2(b.amount)}</span>
              </button>
            ))}
          </ListCard>
        ) : (
          <Empty>{t("trip.noBills")}</Empty>
        )}
        {skipped ? <p className="text-xs text-muted">{t("trip.skipped", { count: skipped })}</p> : null}
      </section>

      {draft.friends.length ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">{t("trip.transfers")}</h2>
          {transfers.length ? (
            <Card className="flex flex-col gap-2.5 px-4 py-3.5">
              {transfers.map((x, i) => (
                <div key={i} className={cx("flex items-center gap-2 text-sm", x.from !== ME && x.to !== ME && "text-muted")}>
                  <span className="min-w-0 truncate font-medium">{who(x.from)}</span>
                  <Icon name="chevronRight" size={14} strokeWidth={2.2} className="shrink-0 text-faint" />
                  <span className="min-w-0 grow truncate font-medium">{who(x.to)}</span>
                  <span className={cx("font-mono font-semibold", x.to === ME ? "text-income" : x.from === ME ? "text-expense" : "")}>{baht2(x.amount)}</span>
                </div>
              ))}
            </Card>
          ) : (
            <Empty>{t("trip.square")}</Empty>
          )}
        </section>
      ) : (
        <Empty>{t("trip.needFriends")}</Empty>
      )}

      <div className="mt-auto flex flex-col gap-2">
        {transfers.length ? <p className="text-center text-xs leading-relaxed text-muted">{t(mineTransfers.length ? "trip.saveHint" : "trip.saveHintNone")}</p> : null}
        <PrimaryButton once disabled={!transfers.length || bills.some((b) => !b.people.length)} onClick={save}>
          {t("trip.save")}
        </PrimaryButton>
        {transfers.length ? (
          <SecondaryButton onClick={share}>
            <span className="flex items-center justify-center gap-2">
              <Icon name="share" size={16} strokeWidth={2} />
              {t("trip.share")}
            </span>
          </SecondaryButton>
        ) : null}
      </div>

      <AddFriendSheet
        open={adding === "friend"}
        names={names.filter((n) => !draft.friends.includes(n))}
        taken={draft.friends}
        onClose={() => setAdding("")}
        onAdd={(name) => {
          setDraft({ ...draft, friends: [...draft.friends, name] });
          setAdding("");
        }}
      />
      <FriendBillSheet
        open={adding === "bill"}
        friends={draft.friends}
        onClose={() => setAdding("")}
        onAdd={(b) => {
          setDraft({ ...draft, friendBills: [...draft.friendBills, b] });
          setAdding("");
        }}
      />
      <Sheet open={!!bill} onClose={() => setEditing(null)} title={bill?.title ?? ""}>
        {bill ? (
          <>
            <p className="text-sm text-muted">{t("trip.whoShares", { amount: baht2(bill.amount), name: who(bill.payer) })}</p>
            <div className="flex flex-wrap gap-2">
              {everyone.map((p) => (
                <Chip
                  key={p}
                  on={bill.people.includes(p)}
                  onClick={() => {
                    const next = bill.people.includes(p) ? bill.people.filter((x) => x !== p) : [...bill.people, p];
                    setDraft({ ...draft, shares: { ...draft.shares, [bill.id]: next } });
                  }}
                >
                  {who(p)}
                </Chip>
              ))}
            </div>
            {bill.people.length ? (
              <p className="text-xs text-muted">{t("trip.each", { amount: baht2(bill.amount / bill.people.length) })}</p>
            ) : (
              <p className="text-xs text-danger">{t("trip.nobody")}</p>
            )}
            <PrimaryButton onClick={() => setEditing(null)}>{t("trip.done")}</PrimaryButton>
            {bill.payer !== ME ? (
              <SecondaryButton
                tone="danger"
                onClick={() => {
                  setDraft({ ...draft, friendBills: draft.friendBills.filter((b) => b.id !== bill.id) });
                  setEditing(null);
                  notify(t("trip.billRemoved", { name: bill.title }));
                }}
              >
                {t("trip.removeBill")}
              </SecondaryButton>
            ) : null}
          </>
        ) : null}
      </Sheet>
    </PushScreen>
  );
}

function AddFriendSheet({ open, names, taken, onClose, onAdd }: { open: boolean; names: string[]; taken: string[]; onClose: () => void; onAdd: (name: string) => void }) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setName("");
  }
  const clean = name.trim();
  const dup = taken.some((f) => f.toLocaleLowerCase() === clean.toLocaleLowerCase());
  return (
    <Sheet open={open} onClose={onClose} title={t("trip.addFriend")}>
      <PersonField value={name} onChange={setName} names={names} />
      {dup ? <span className="text-xs text-danger">{t("trip.friendTaken")}</span> : null}
      <PrimaryButton disabled={!clean || dup} onClick={() => onAdd(clean)}>
        {t("trip.addFriend")}
      </PrimaryButton>
    </Sheet>
  );
}

function FriendBillSheet({ open, friends, onClose, onAdd }: { open: boolean; friends: string[]; onClose: () => void; onAdd: (b: FriendBill) => void }) {
  const { t } = useTranslation();
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [payer, setPayer] = useState("");
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setTitle("");
      setAmount("");
      setPayer("");
    }
  }
  const value = parseFloat(amount) || 0;
  const who = payer || friends[0] || "";
  return (
    <Sheet open={open} onClose={onClose} title={t("trip.addFriendBill")}>
      <div className="flex flex-col gap-2">
        <span className="pl-0.5 text-[11px] text-muted">{t("trip.whoPaid")}</span>
        <div className="flex flex-wrap gap-2">
          {friends.map((f) => (
            <Chip key={f} on={who === f} onClick={() => setPayer(f)}>
              {f}
            </Chip>
          ))}
        </div>
      </div>
      <input
        value={title}
        maxLength={60}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={t("trip.billPlaceholder")}
        aria-label={t("trip.billName")}
        className="min-h-11 w-full rounded-xl border border-line bg-card px-3 text-[15px] outline-none"
      />
      <label className="flex min-h-11 items-center gap-2 rounded-xl border border-line bg-card px-3 text-[15px]">
        <span className="grow text-sm text-muted">{t("trip.billAmount")}</span>
        <span className="font-mono text-muted">฿</span>
        <BahtInput
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
          placeholder="0"
          aria-label={t("trip.billAmount")}
          className="w-32 min-w-0 bg-transparent text-right font-mono outline-none"
        />
      </label>
      <PrimaryButton
        disabled={!who || value <= 0}
        onClick={() => onAdd({ id: `f-${crypto.randomUUID().slice(0, 8)}`, title: title.trim() || t("trip.billDefault", { name: who }), amount: Math.round(value * 100) / 100, payer: who })}
      >
        {t("trip.addBill")}
      </PrimaryButton>
    </Sheet>
  );
}
