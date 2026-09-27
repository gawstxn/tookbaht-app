"use client";

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { baht2 } from "@/lib/format";
import { formatPromptPayId, promptPayPayload } from "@/lib/promptpay";
import { encodeQr } from "@/lib/qr";
import { useStore } from "@/lib/store";
import { Icon } from "./ui/Icon";
import { PromptPayForm } from "./PromptPayForm";
import { PrimaryButton, Sheet } from "./ui/primitives";

const QUIET = 4;

/** A PromptPay QR for what a friend owes, to show or share so they can pay by scanning it. */
export function PayMeSheet({ open, person, amount, onClose }: { open: boolean; person: string; amount: number; onClose: () => void }) {
  const { t } = useTranslation();
  const id = useStore((s) => s.settings.promptPayId);
  const notify = useStore((s) => s.notify);
  const [sharing, setSharing] = useState(false);
  const grid = useMemo(() => {
    const payload = id ? promptPayPayload(id, amount) : null;
    return payload ? encodeQr(payload) : null;
  }, [id, amount]);
  const canShare = typeof navigator !== "undefined" && typeof navigator.canShare === "function";

  const share = async () => {
    if (!grid) return;
    setSharing(true);
    try {
      const file = new File([await qrPng(grid)], "tookbaht-promptpay.png", { type: "image/png" });
      const text = t("promptpay.shareText", { name: person, amount: baht2(amount) });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], text });
      else notify(t("promptpay.shareUnsupported"), { tone: "error" });
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
              {t("promptpay.to")} <span className="font-mono">{formatPromptPayId(id!)}</span>
            </span>
          </div>
          <div className="flex items-baseline justify-between px-1">
            <span className="text-sm text-muted">{t("promptpay.amount")}</span>
            <span className="font-mono text-2xl font-semibold">{baht2(amount)}</span>
          </div>
          <p className="text-center text-xs leading-relaxed text-muted">{t("promptpay.hint", { name: person })}</p>
          {canShare ? (
            <PrimaryButton onClick={share} disabled={sharing}>
              <span className="flex items-center justify-center gap-2">
                <Icon name="share" size={18} strokeWidth={2} />
                {t("promptpay.share")}
              </span>
            </PrimaryButton>
          ) : null}
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

/** The QR as a PNG (white margin, 10px modules) for the share sheet. */
function qrPng(grid: boolean[][]): Promise<Blob> {
  const scale = 10;
  const n = grid.length + QUIET * 2;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = n * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#000";
  grid.forEach((row, y) => row.forEach((dark, x) => dark && ctx.fillRect((x + QUIET) * scale, (y + QUIET) * scale, scale, scale)));
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("png"))), "image/png"));
}
