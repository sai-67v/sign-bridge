import type * as PdfJs from "pdfjs-dist"

let workerConfigured = false

/** Same-origin worker from `public/pdf.worker.mjs` (copied on postinstall). */
export function configurePdfWorker(pdfjs: typeof PdfJs): void {
  if (workerConfigured) return
  workerConfigured = true
  const base =
    (typeof process !== "undefined" && process.env?.PUBLIC_URL
      ? String(process.env.PUBLIC_URL).replace(/\/$/, "")
      : "") || ""
  pdfjs.GlobalWorkerOptions.workerSrc = `${base}/pdf.worker.mjs`
}
