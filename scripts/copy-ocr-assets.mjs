// Copies the OCR worker and engine (tesseract.js) into public/ocr so slips are
// read with files served by the app itself (no CDN; see lib/ocr.ts). Runs on
// postinstall; the copies are git-ignored. The Thai language data lives in
// public/ocr/tha.traineddata (committed, from tesseract-ocr/tessdata_fast).
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "public", "ocr");
mkdirSync(out, { recursive: true });
for (const [from, to] of [
  ["node_modules/tesseract.js/dist/worker.min.js", "worker.min.js"],
  // SIMD build: iOS 16.4+ (the version web push needs too) and current desktop browsers.
  ["node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js", "tesseract-core-simd-lstm.wasm.js"],
]) {
  copyFileSync(join(root, from), join(out, to));
}
