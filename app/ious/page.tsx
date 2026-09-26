"use client";

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { PushScreen } from "@/components/app";
import { AmountInput } from "@/components/AmountInput";
import { ConfirmSheet } from "@/components/ConfirmSheet";
import { PersonField, personTone } from "@/components/ious";
import { Icon } from "@/components/ui/Icon";
import { Chip, Empty, HeroCard, IconButton, ListCard, Monogram, PrimaryButton, PushHeader, SecondaryButton, Sheet } from "@/components/ui/primitives";
import { baht, baht2, shortDate, todayISO } from "@/lib/format";
import { debtsByPerson, knownPeople, owedTotal } from "@/lib/ious";
import { useGoBack } from "@/lib/nav";
import { useStore } from "@/lib/store";
import type { Iou } from "@/lib/types";

/** ใครติดเงินเรา: unpaid debts by friend, recently repaid ones below. */
export default function IousPage() {
  const { t } = useTranslation();
  const goBack = useGoBack("/");
  const ious = useStore((s) => s.ious);
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<Iou | null>(null);
  const people = useMemo(() => debtsByPerson(ious), [ious]);
  const total = useMemo(() => owedTotal(ious), [ious]);
  const settled = useMemo(
    () => ious.filter((i) => i.settledOn).sort((a, b) => b.settledOn!.localeCompare(a.settledOn!) || b.createdAt - a.createdAt).slice(0, 10),
    [ious],
  );

  return (
    <PushScreen>
      <PushHeader title={t("ious.title")} onBack={goBack} action={<IconButton icon="plus" label={t("ious.add")} variant="dark" onClick={() => setAdding(true)} />} />

      <HeroCard label={t("ious.title")}>
        <div className="flex flex-col gap-1">
          <span className="text-[13px] text-on-ink-muted">{t("ious.owedToYou")}</span>
          <span className="font-mono text-4xl font-semibold leading-tight tracking-tight">{baht2(total)}</span>
        </div>
        <span className="text-xs text-on-ink-muted">{people.length ? t("ious.people", { count: people.length }) : t("ious.allClear")}</span>
      </HeroCard>

      <p className="flex items-start gap-2 text-xs leading-relaxed text-muted">
        <Icon name="users" size={16} strokeWidth={2} className="mt-px shrink-0" />
        {t("ious.hint")}
      </p>

      {people.length ? (
        people.map((p) => (
          <section key={p.person} className="flex flex-col gap-2">
            <div className="flex items-center gap-2.5">
              <Monogram text={(p.person[0] ?? "?").toUpperCase()} tone={personTone(p.person)} size={30} />
              <h2 className="grow text-base font-semibold">{p.person}</h2>
              <span className="font-mono text-[15px] font-semibold text-income">{baht2(p.total)}</span>
            </div>
            <ListCard>
              {p.items.map((i) => (
                <IouRow key={i.id} iou={i} onClick={() => setSelected(i)} />
              ))}
            </ListCard>
          </section>
        ))
      ) : (
        <Empty>{t("ious.empty")}</Empty>
      )}

      {settled.length ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">{t("ious.settledTitle")}</h2>
          <ListCard className="opacity-70">
            {settled.map((i) => (
              <IouRow key={i.id} iou={i} showPerson onClick={() => setSelected(i)} />
            ))}
          </ListCard>
        </section>
      ) : null}

      <AddIouSheet open={adding} onClose={() => setAdding(false)} />
      <IouSheet iou={selected} onClose={() => setSelected(null)} />
    </PushScreen>
  );
}

function IouRow({ iou, onClick, showPerson }: { iou: Iou; onClick: () => void; showPerson?: boolean }) {
  const { t } = useTranslation();
  const title = [showPerson ? iou.person : "", iou.note].filter(Boolean).join(" · ") || t("ious.noNote");
  return (
    <button type="button" onClick={onClick} className="flex min-h-[56px] w-full items-center gap-3 text-left">
      <span className="flex min-w-0 grow flex-col">
        <span className="truncate text-[15px] font-medium">{title}</span>
        <span className="text-xs text-muted">{iou.settledOn ? t("ious.settledOn", { date: shortDate(iou.settledOn) }) : shortDate(iou.date)}</span>
      </span>
      <span className="font-mono text-[15px] font-semibold">{baht2(iou.amount)}</span>
    </button>
  );
}

/** "มิ้นท์ติดเงิน ฿300 ค่าหนัง" without a bill to split. */
function AddIouSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const ious = useStore((s) => s.ious);
  const addIous = useStore((s) => s.addIous);
  const [person, setPerson] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setPerson("");
      setAmount("");
      setNote("");
    }
  }
  const names = useMemo(() => knownPeople(ious), [ious]);
  const value = parseFloat(amount) || 0;
  const canSave = person.trim().length > 0 && value > 0;

  return (
    <Sheet open={open} onClose={onClose} title={t("ious.addTitle")}>
      <PersonField value={person} onChange={setPerson} names={names} />
      <AmountInput label={t("ious.amount")} value={amount} onChange={setAmount} />
      <input
        value={note}
        maxLength={200}
        onChange={(e) => setNote(e.target.value)}
        placeholder={t("ious.notePlaceholder")}
        aria-label={t("common.note")}
        className="min-h-11 w-full rounded-xl border border-line bg-card px-3 text-sm outline-none"
      />
      <PrimaryButton
        disabled={!canSave}
        onClick={() => {
          addIous([{ person: person.trim(), amount: value, note: note.trim(), date: todayISO(), transactionId: null, settledOn: null }]);
          onClose();
        }}
      >
        {t("common.save")}
      </PrimaryButton>
    </Sheet>
  );
}

/** Paid back (optionally into an account, logged as income), or delete. */
function IouSheet({ iou, onClose }: { iou: Iou | null; onClose: () => void }) {
  const { t } = useTranslation();
  const accounts = useStore((s) => s.accounts);
  const transactions = useStore((s) => s.transactions);
  const settleIou = useStore((s) => s.settleIou);
  const updateIou = useStore((s) => s.updateIou);
  const deleteIou = useStore((s) => s.deleteIou);
  const [into, setInto] = useState("");
  const [confirming, setConfirming] = useState(false);
  if (!iou && confirming) setConfirming(false);
  const [shown, setShown] = useState<Iou | null>(iou);
  if (iou && iou !== shown) {
    setShown(iou);
    setInto("");
  }
  const bill = iou?.transactionId ? transactions.find((x) => x.id === iou.transactionId) : undefined;

  return (
    <>
    <Sheet open={!!iou && !confirming} onClose={onClose} title={iou?.person ?? ""}>
      {iou ? (
        <>
          <div className="flex flex-col items-center gap-0.5 py-1">
            <span className="font-mono text-[34px] font-semibold">{baht2(iou.amount)}</span>
            <span className="text-center text-[13px] text-muted">{[iou.note, shortDate(iou.date)].filter(Boolean).join(" · ")}</span>
            {bill ? <span className="text-xs text-faint">{t("ious.fromBill", { title: bill.title, amount: baht(bill.amount) })}</span> : null}
          </div>
          {iou.settledOn ? (
            <>
              <p className="text-center text-sm text-muted">{t("ious.settledOn", { date: shortDate(iou.settledOn) })}</p>
              <SecondaryButton
                onClick={() => {
                  updateIou(iou.id, { settledOn: null });
                  onClose();
                }}
              >
                {t("ious.unsettle")}
              </SecondaryButton>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-2">
                <span className="text-[13px] text-muted">{t("ious.receivedInto")}</span>
                <div className="flex flex-wrap gap-1.5">
                  <Chip size="sm" on={!into} onClick={() => setInto("")}>
                    {t("ious.dontLog")}
                  </Chip>
                  {accounts.map((a) => (
                    <Chip key={a.id} size="sm" on={into === a.id} onClick={() => setInto(a.id)}>
                      {a.name}
                    </Chip>
                  ))}
                </div>
                <span className="text-xs leading-relaxed text-faint">{into ? t("ious.logHint") : t("ious.dontLogHint")}</span>
              </div>
              <PrimaryButton
                onClick={() => {
                  settleIou(iou.id, into || undefined);
                  onClose();
                }}
              >
                {t("ious.settle")}
              </PrimaryButton>
            </>
          )}
          <SecondaryButton tone="danger" onClick={() => setConfirming(true)}>
            {t("ious.delete")}
          </SecondaryButton>
        </>
      ) : null}
    </Sheet>
    <ConfirmSheet
      open={!!iou && confirming}
      onClose={() => setConfirming(false)}
      title={t("ious.deleteTitle", { name: shown?.person ?? "" })}
      lead={t("ious.deleteLead", { amount: baht2(shown?.amount ?? 0) })}
      confirmLabel={t("ious.delete")}
      onConfirm={() => {
        if (shown) deleteIou(shown.id);
        onClose();
      }}
    />
    </>
  );
}
