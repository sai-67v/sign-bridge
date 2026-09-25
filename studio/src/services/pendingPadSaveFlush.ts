/** Lets UI (e.g. sidebar Home) await the same flush PadEditor runs on unmount. */

type FlushFn = () => Promise<void>

const flushers = new Map<string, FlushFn>()

export function registerPendingPadSaveFlush(noteId: string, flush: FlushFn): () => void {
  flushers.set(noteId, flush)
  return () => {
    if (flushers.get(noteId) === flush) {
      flushers.delete(noteId)
    }
  }
}

export async function flushPendingPadSaveForNote(noteId: string): Promise<void> {
  const fn = flushers.get(noteId)
  if (fn) await fn()
}
