/**
 * Serve pdf.js worker from same origin as the app (avoids flaky CDNs / version skew).
 */
const fs = require("fs")
const path = require("path")

const root = path.join(__dirname, "..")
const src = path.join(root, "node_modules", "pdfjs-dist", "build", "pdf.worker.mjs")
const dest = path.join(root, "public", "pdf.worker.mjs")

if (!fs.existsSync(src)) {
  console.warn("[copy-pdf-worker] skip: pdf.worker.mjs not found at", src)
  process.exit(0)
}

fs.mkdirSync(path.dirname(dest), { recursive: true })
fs.copyFileSync(src, dest)
console.log("[copy-pdf-worker] copied to public/pdf.worker.mjs")
