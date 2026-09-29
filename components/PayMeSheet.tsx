"use client";

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { baht2, baht2Exact } from "@/lib/format";
import { payItems, payMessage, type PayItem } from "@/lib/payShare";
import { maskPromptPayId, promptPayPayload } from "@/lib/promptpay";
import { payCardPng } from "@/lib/payCard";
import { encodeQr } from "@/lib/qr";
import { useStore } from "@/lib/store";
import { Icon } from "./ui/Icon";
import { PromptPayForm } from "./PromptPayForm";
import { PrimaryButton, SecondaryButton, Sheet } from "./ui/primitives";

const QUIET = 4;

/**
 * A PromptPay QR for what a friend owes, to show or share so they can pay by
 * scanning it. The shared image and the copied message list the debts it
 * covers (`items`), so the friend sees what the total is for.
 */
export function PayMeSheet({ open, person, amount, items = [], onClose }: { open: boolean; person: string; amount: number; items?: PayItem[]; onClose: () => void }) {
  const { t } = useTranslation();
  const id = useStore((s) => s.settings.promptPayId);
  const notify = useStore((s) => s.notify);
  const [sharing, setSharing] = useState(false);
  const grid = useMemo(() => {
    const payload = id ? promptPayPayload(id, amount) : null;
    return payload ? encodeQr(payload) : null;
  }, [id, amount]);
  const canShare = typeof navigator !== "undefined" && typeof navigator.canShare === "function";

  const message = () =>
    payMessage(
      t("promptpay.shareText", { name: person, amount: baht2Exact(amount) }),
      items,
      (i) => t("promptpay.shareItem", { label: i.label, amount: baht2Exact(i.amount) }),
      (n) => t("promptpay.shareMore", { count: n }),
    );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message());
      notify(t("promptpay.copied"));
    } catch {
      notify(t("promptpay.copyFailed"), { tone: "error" });
    }
  };

  const share = async () => {
    if (!grid) return;
    setSharing(true);
    try {
      const png = await payCardPng(grid, {
        title: t("promptpay.cardTitle", { name: person }),
        amount: baht2(amount),
        to: `${t("promptpay.to")} ${maskPromptPayId(id!)}`,
        items: payItems(items.length > 1 ? items : []),
        more: (n) => t("promptpay.shareMore", { count: n }),
        money: baht2,
      });
      const file = new File([png], "tookbaht-promptpay.png", { type: "image/png" });
      const text = message();
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], text });
      else if (navigator.share) await navigator.share({ text });
      else await copy();
    } catch (e) {
      // Closing the share sheet isn't an error worth telling about.
      if ((e as Error).name !== "AbortError") notify(t("promptpay.shareFailed"), { tone: "error" });
    } finally {
      setSharing(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title={t("promptpay.sheetTitle", { name: person })}>
      {grid ? (
        <>
          <div className="flex flex-col items-center gap-3 rounded-[20px] border border-line bg-white p-5">
            {/* Always dark-on-white: scanners need the contrast, whatever the theme. */}
            <QrSvg grid={grid} />
            <span className="text-center text-xs text-black/60">
              {t("promptpay.to")} <span className="font-mono">{maskPromptPayId(id!)}</span>
            </span>
          </div>
          <div className="flex items-baseline justify-between px-1">
            <span className="text-sm text-muted">{t("promptpay.amount")}</span>
            <span className="font-mono text-2xl font-semibold">{baht2(amount)}</span>
          </div>
          {items.length > 1 ? <ItemList items={items} /> : null}
          <p className="text-center text-xs leading-relaxed text-muted">{t("promptpay.hint", { name: person })}</p>
          {canShare ? (
            <PrimaryButton onClick={share} disabled={sharing}>
              <span className="flex items-center justify-center gap-2">
                <Icon name="share" size={18} strokeWidth={2} />
                {t("promptpay.share")}
              </span>
            </PrimaryButton>
          ) : null}
          {/* For chats the share sheet doesn't reach, or when sharing an image fails. */}
          <SecondaryButton onClick={copy}>
            <span className="flex items-center justify-center gap-2">
              <Icon name="copy" size={16} strokeWidth={2} />
              {t("promptpay.copy")}
            </span>
          </SecondaryButton>
        </>
      ) : (
        <>
          <p className="text-sm text-muted">{t("promptpay.setupLead")}</p>
          {/* Saving swaps this for the QR right here; it can be changed later in Profile. */}
          <PromptPayForm required saveLabel={t("promptpay.setupSave")} />
        </>
      )}
    </Sheet>
  );
}

/** The debts the total covers, cut to a few lines like the shared image. */
function ItemList({ items }: { items: PayItem[] }) {
  const { t } = useTranslation();
  const { shown, more } = payItems(items);
  return (
    <ul className="flex flex-col gap-1.5 rounded-2xl border border-line bg-card px-4 py-3 text-[13px]">
      {shown.map((i, n) => (
        <li key={n} className="flex items-baseline justify-between gap-3">
          <span className="min-w-0 truncate text-muted">{i.label}</span>
          <span className="shrink-0 font-mono">{baht2(i.amount)}</span>
        </li>
      ))}
      {more ? <li className="text-xs text-muted">{t("promptpay.shareMore", { count: more })}</li> : null}
    </ul>
  );
}

function QrSvg({ grid }: { grid: boolean[][] }) {
  const n = grid.length + QUIET * 2;
  const path = useMemo(() => {
    let d = "";
    grid.forEach((row, y) => row.forEach((dark, x) => dark && (d += `M${x + QUIET} ${y + QUIET}h1v1h-1z`)));
    return d;
  }, [grid]);
  return (
    <svg viewBox={`0 0 ${n} ${n}`} className="aspect-square w-56" shapeRendering="crispEdges" role="img" aria-label="PromptPay QR">
      <rect width={n} height={n} fill="#fff" />
      <path d={path} fill="#000" />
    </svg>
  );
}
