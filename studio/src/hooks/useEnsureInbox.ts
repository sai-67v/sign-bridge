import { useEffect, useRef } from "react"
import { notebookService } from "../services/notebookService"

/**
 * Idempotent per session: ensure the Inbox notebook document exists for features that anchor
 * uploads/materials on a notebook row. Standalone library Pages keep `notes.notebookId` null —
 * they must not be auto-assigned to Inbox or they appear inside a notebook unintentionally.
 */
export function useEnsureInbox(userId: string | null | undefined) {
  const ran = useRef(false)

  useEffect(() => {
    if (!userId || ran.current) return
    ran.current = true
    let cancelled = false
    ;(async () => {
      try {
        await notebookService.ensureInboxNotebook(userId)
        if (cancelled) return
      } catch (e) {
        console.warn("[PAD] ensure Inbox skipped (collections may not exist yet).", e)
        ran.current = false
      }
    })()
    return () => {
      cancelled = true
    }
  }, [userId])
}
