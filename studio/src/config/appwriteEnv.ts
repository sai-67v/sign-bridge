/**
 * Appwrite configuration — env only. No project/database IDs in source.
 * Set VITE_APPWRITE_* (or REACT_APP_*) at build time for self-hosted or CI deploys.
 * The public demo at https://canis.appwrite.network is built with secrets in the host environment, not in git.
 */

function readEnv(...keys: string[]): string {
  for (const key of keys) {
    if (typeof process !== "undefined" && process.env?.[key]) {
      return String(process.env[key]).trim()
    }
    if (typeof import.meta !== "undefined") {
      const v = (import.meta.env as Record<string, string | undefined>)?.[key]
      if (v) return String(v).trim()
    }
  }
  return ""
}

export const APPWRITE_ENDPOINT = readEnv(
  "VITE_APPWRITE_ENDPOINT",
  "REACT_APP_APPWRITE_ENDPOINT",
)

export const APPWRITE_PROJECT_ID = readEnv(
  "VITE_APPWRITE_PROJECT_ID",
  "REACT_APP_APPWRITE_PROJECT_ID",
)

export const APPWRITE_DATABASE_ID = readEnv(
  "VITE_APPWRITE_DATABASE_ID",
  "REACT_APP_APPWRITE_DATABASE_ID",
)

export const APPWRITE_BUCKET_MATERIALS = readEnv(
  "VITE_APPWRITE_BUCKET_MATERIALS",
  "REACT_APP_APPWRITE_BUCKET_MATERIALS",
)

export function isAppwriteConfigured(): boolean {
  return !!(APPWRITE_ENDPOINT && APPWRITE_PROJECT_ID && APPWRITE_DATABASE_ID)
}
