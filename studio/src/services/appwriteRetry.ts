/** HTTP status codes we treat as transient for Appwrite Cloud (rate limits / overload). */
const RETRIABLE_CODES = new Set([429, 503])

const DEFAULT_MAX_ATTEMPTS = 10
const BASE_BACKOFF_MS = 500
const CAP_BACKOFF_MS = 45_000

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Numeric Appwrite `code` from thrown value (SDK AppwriteException). */
export function getAppwriteErrorCode(e: unknown): number {
  if (e && typeof e === "object" && "code" in e) {
    const c = Number((e as { code: unknown }).code)
    return Number.isFinite(c) ? c : 0
  }
  return 0
}

/**
 * Some responses may embed retry hints; Appwrite Web SDK exposes raw `response` string (often JSON).
 */
function retryAfterMsFromError(e: unknown): number | null {
  if (!e || typeof e !== "object") return null
  const r = (e as { response?: unknown }).response
  if (typeof r !== "string" || !r.trim()) return null
  try {
    const j = JSON.parse(r) as Record<string, unknown>
    const ra = j.retryAfter ?? j.retry_after ?? j["Retry-After"]
    if (typeof ra === "number" && ra > 0) return Math.min(CAP_BACKOFF_MS, ra * 1000)
    if (typeof ra === "string") {
      const n = parseFloat(ra)
      if (n > 0) return Math.min(CAP_BACKOFF_MS, n * 1000)
    }
  } catch {
    /* not JSON */
  }
  return null
}

function backoffMs(attemptIndex: number, fromError: number | null): number {
  if (fromError != null && fromError > 0) return fromError
  const exp = BASE_BACKOFF_MS * Math.pow(2, attemptIndex)
  const jitter = Math.random() * 250
  return Math.min(CAP_BACKOFF_MS, exp + jitter)
}

/**
 * Run `fn` with retries on 429 / 503 (exponential backoff + jitter, optional Retry-After from body).
 */
export async function withAppwriteRetry<T>(
  fn: () => Promise<T>,
  options?: { maxAttempts?: number }
): Promise<T> {
  const maxAttempts = options?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS
  let lastError: unknown
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (e) {
      lastError = e
      const code = getAppwriteErrorCode(e)
      if (!RETRIABLE_CODES.has(code) || attempt === maxAttempts - 1) {
        throw e
      }
      const hint = retryAfterMsFromError(e)
      await sleep(backoffMs(attempt, hint))
    }
  }
  throw lastError
}
