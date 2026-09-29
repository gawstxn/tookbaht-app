import type { PayItem } from "./payShare";

/** Blank modules around the QR, as scanners expect. */
const QUIET = 4;

export interface CardText {
  title: string;
  amount: string;
  to: string;
  items: { shown: PayItem[]; more: number };
  more: (n: number) => string;
  money: (n: number) => string;
}

/**
 * The QR as a PNG card for the share sheet: who it's for and the amount on
 * top, the QR (dark on white, 10px modules), the PromptPay ID, then the debts
 * it covers. Drawn in the app's font, which is already loaded.
 */
export async function payCardPng(grid: boolean[][], text: CardText): Promise<Blob> {
  const scale = 10;
  const qr = (grid.length + QUIET * 2) * scale;
  const pad = 48;
  const width = Math.max(qr, 560) + pad * 2;
  const lineH = 44;
  const rows = text.items.shown.length + (text.items.more ? 1 : 0);
  const height = pad + 44 + 72 + 16 + qr + 52 + (rows ? 24 + rows * lineH : 0) + pad;
  const sans = getComputedStyle(document.body).fontFamily || "sans-serif";
  await document.fonts?.ready;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, width, height);
  ctx.textBaseline = "alphabetic";
  const fit = (s: string, max: number) => {
    if (ctx.measureText(s).width <= max) return s;
    let out = s;
    while (out.length > 1 && ctx.measureText(`${out}…`).width > max) out = out.slice(0, -1);
    return `${out}…`;
  };

  let y = pad + 32;
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.font = `500 30px ${sans}`;
  ctx.fillText(fit(text.title, width - pad * 2), width / 2, y);
  y += 72;
  ctx.fillStyle = "#000";
  ctx.font = `700 60px ${sans}`;
  ctx.fillText(fit(text.amount, width - pad * 2), width / 2, y);
  y += 16;

  const x0 = (width - qr) / 2;
  ctx.fillStyle = "#000";
  grid.forEach((row, gy) => row.forEach((dark, gx) => dark && ctx.fillRect(x0 + (gx + QUIET) * scale, y + (gy + QUIET) * scale, scale, scale)));
  y += qr + 36;
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.font = `500 26px ${sans}`;
  ctx.fillText(text.to, width / 2, y);

  if (rows) {
    y += 16;
    ctx.fillStyle = "rgba(0,0,0,0.12)";
    ctx.fillRect(pad, y, width - pad * 2, 2);
    y += 8;
    ctx.font = `400 26px ${sans}`;
    for (const i of text.items.shown) {
      y += lineH;
      const amount = text.money(i.amount);
      ctx.textAlign = "right";
      ctx.fillStyle = "#000";
      ctx.fillText(amount, width - pad, y);
      ctx.textAlign = "left";
      ctx.fillStyle = "rgba(0,0,0,0.7)";
      ctx.fillText(fit(i.label, width - pad * 2 - ctx.measureText(amount).width - 24), pad, y);
    }
    if (text.items.more) {
      y += lineH;
      ctx.textAlign = "left";
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillText(text.more(text.items.more), pad, y);
    }
  }
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("png"))), "image/png"));
}
