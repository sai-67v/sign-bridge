/**
 * Postinstall patches for react-scripts start.js (PAD / IDE-friendly dev).
 * 1) Remove stdin.on('end') shutdown (fires immediately in many IDE terminals).
 * 2) Fix startCallback so devServer start failures are not mistaken for success.
 */
const fs = require("fs");
const path = require("path");

const startJs = path.join(
  __dirname,
  "..",
  "node_modules",
  "react-scripts",
  "scripts",
  "start.js"
);

if (!fs.existsSync(startJs)) {
  process.exit(0);
}

let src = fs.readFileSync(startJs, "utf8");
let changed = false;

const stdinMarker = "PAD_SKIP_STDIN_SHUTDOWN";
if (!src.includes(stdinMarker)) {
  const stdinRe =
    /if \(process\.env\.CI !== 'true'(?: && process\.stdin && process\.stdin\.isTTY)?\) {\s*\/\/ Gracefully exit when stdin ends\s*process\.stdin\.on\('end', function \(\) {\s*devServer\.close\(\);\s*process\.exit\(\);\s*\}\);\s*}\s*\n/;
  if (stdinRe.test(src)) {
    src = src.replace(
      stdinRe,
      `    /* ${stdinMarker}: stdin 'end' shutdown removed (IDE-safe). Stop with Ctrl+C. */\n`
    );
    changed = true;
  } else {
    console.warn(
      "[apply-react-scripts-start-patch] stdin block not found; skip stdin patch."
    );
  }
}

const errMarker = "PAD_DEVSERVER_START_ERR";
if (!src.includes("PAD_DEVSERVER_START_ERR:")) {
  const needle = "devServer.startCallback(() => {";
  const replacement = `devServer.startCallback((err) => {
      /* ${errMarker}: surface WDS start failures (CRA ignores err by default). */
      if (err) {
        console.error("Failed to start the development server:", err);
        process.exit(1);
      }`;
  if (src.includes(needle)) {
    src = src.replace(needle, replacement);
    changed = true;
  } else {
    console.warn(
      "[apply-react-scripts-start-patch] startCallback pattern not found; skip err patch."
    );
  }
}

if (changed) {
  fs.writeFileSync(startJs, src);
  console.log("[apply-react-scripts-start-patch] Patched react-scripts/scripts/start.js");
}
