/**
 * Per-account localStorage keys for PAD workspace, note cache, and open-pad snapshot.
 * Prevents cross-account bleed when multiple users use the same browser profile.
 */

export const LEGACY_WORKSPACE_KEY = "pad_workspace_v1"
export const LEGACY_NOTE_STORE_KEY = "pad_note_store_v2"
export const LEGACY_CURRENT_PAD_CONTENT = "CURRENT_PAD_CONTENT"
export const LEGACY_CURRENT_PAD_ID = "currentPad"

const SCOPED_LS_MIGRATION_FLAG = "pad_client_ls_scoped_migration_v1"

let activePersistenceUid: string | null = null

export function setPadPersistenceUid(uid: string | null): void {
  activePersistenceUid = uid
}

export function getPadPersistenceUid(): string | null {
  return activePersistenceUid
}

export function workspaceStorageKey(uid: string): string {
  return `${LEGACY_WORKSPACE_KEY}:${uid}`
}

export function noteStoreStorageKey(uid: string): string {
  return `${LEGACY_NOTE_STORE_KEY}:${uid}`
}

export function currentPadContentStorageKey(uid: string): string {
  return `${LEGACY_CURRENT_PAD_CONTENT}:${uid}`
}

export function currentPadIdStorageKey(uid: string): string {
  return `${LEGACY_CURRENT_PAD_ID}:${uid}`
}

/** One-time remove of unscoped keys after introducing per-uid keys (do not migrate values — avoids cross-user merge). */
export function stripLegacyUnscopedPadKeysOnce(): void {
  if (typeof localStorage === "undefined") return
  try {
    if (localStorage.getItem(SCOPED_LS_MIGRATION_FLAG)) return
    localStorage.removeItem(LEGACY_WORKSPACE_KEY)
    localStorage.removeItem(LEGACY_NOTE_STORE_KEY)
    localStorage.removeItem(LEGACY_CURRENT_PAD_CONTENT)
    localStorage.removeItem(LEGACY_CURRENT_PAD_ID)
    localStorage.setItem(SCOPED_LS_MIGRATION_FLAG, "1")
  } catch {
    /* ignore */
  }
}

/** Remove scoped pad JSON for this user (shared-machine hygiene on sign-out). */
export function clearPadScopedStorageForUser(uid: string | null): void {
  if (typeof localStorage === "undefined" || !uid) return
  try {
    localStorage.removeItem(workspaceStorageKey(uid))
    localStorage.removeItem(noteStoreStorageKey(uid))
    localStorage.removeItem(currentPadContentStorageKey(uid))
    localStorage.removeItem(currentPadIdStorageKey(uid))
  } catch {
    /* ignore */
  }
}
