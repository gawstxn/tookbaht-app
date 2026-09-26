"use client";

/*
 * Reads the text of a slip photo on the device with tesseract.js (Thai model).
 * The library, engine and language data are served by the app itself
 * (public/ocr, see scripts/copy-ocr-assets.mjs) and only load the first time a
 * slip is read; the photo never leaves the device.
 */

export class OcrUnsupportedError extends Error {}

/** The slip's text; `onProgress` gets 0–1 while it reads. */
export async function readSlipText(file: Blob, onProgress?: (p: number) => void): Promise<string> {
  if (typeof WebAssembly === "undefined" || typeof Worker === "undefined") throw new OcrUnsupportedError("no wasm");
  const { createWorker } = await import("tesseract.js");
  const origin = window.location.origin;
  const worker = await createWorker("tha", 1, {
    workerPath: `${origin}/ocr/worker.min.js`,
    corePath: `${origin}/ocr/tesseract-core-simd-lstm.wasm.js`,
    langPath: `${origin}/ocr`,
    gzip: false,
    // A blob: worker would need `worker-src blob:` in the CSP; load the file instead.
    workerBlobURL: false,
    logger: (m) => {
      if (m.status === "recognizing text") onProgress?.(m.progress);
    },
  });
  try {
    const { data } = await worker.recognize(file);
    return data.text;
  } finally {
    // Frees the engine's memory (it's large for a phone).
    await worker.terminate();
  }
}
