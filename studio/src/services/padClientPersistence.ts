import { setPadPersistenceUid, stripLegacyUnscopedPadKeysOnce } from "./padClientStorage"
import { useWorkspaceStore } from "../store/workspaceStore"
import { useNoteStore } from "../store/noteStore"

/**
 * Call after Appwrite session (or demo user) is resolved so workspace / note caches
 * read and write the correct per-uid localStorage keys.
 */
export function bootstrapPadClientPersistence(uid: string | null): void {
  setPadPersistenceUid(uid)
  if (uid) {
    stripLegacyUnscopedPadKeysOnce()
  }
  useWorkspaceStore.getState().rehydrateForUser(uid)
  useNoteStore.getState().rehydrateForUser(uid)
}
