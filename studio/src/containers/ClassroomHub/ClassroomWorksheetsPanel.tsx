import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../../hooks/useAuth"
import { api, type Note } from "../../services/api"
import { classroomService } from "../../services/classroomService"
import { folderService } from "../../services/folderService"
import { startNewClassroomWorksheet } from "../../services/classroomWorksheetOpen"
import { useFolderStore } from "../../store/folderStore"
import { Button } from "@/components/ui/button"

type Props = {
  classroomId: string
  onOpenLibrary: () => void
  /** Called after folders are refreshed so the hub can reload classroom (e.g. new rootFolderId). */
  onAfterProvision?: () => void
}

function formatUpdatedAt(ms: number): string {
  const diff = Date.now() - ms
  if (diff < 45_000) return "just now"
  const mins = Math.floor(diff / 60_000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  try {
    return new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" })
  } catch {
    return "—"
  }
}

export function ClassroomWorksheetsPanel({ classroomId, onOpenLibrary, onAfterProvision }: Props) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const fetchFolders = useFolderStore((s) => s.fetchFolders)

  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading")
  const [errorText, setErrorText] = useState<string | null>(null)
  const [worksheets, setWorksheets] = useState<Note[]>([])
  const [creating, setCreating] = useState(false)

  const loadWorksheets = useCallback(async () => {
    if (!user?.uid) {
      setPhase("error")
      setErrorText("Sign in to manage worksheets.")
      return
    }
    setPhase("loading")
    setErrorText(null)
    try {
      let classroom = await classroomService.getClassroom(classroomId)
      classroom = await classroomService.ensureClassWorkspaceIfNeeded(user.uid, classroom)
      const worksheetsFolder = await folderService.ensureClassWorksheetsFolder(user.uid, classroom)
      if (!worksheetsFolder?.id) {
        setWorksheets([])
        setPhase("error")
        setErrorText("Could not open the class Worksheets folder. Try again from the Library tab.")
        return
      }
      const notes = await api.getNotes(undefined, user.uid, worksheetsFolder.id)
      const ws = notes
        .filter((n) => n.padType === "worksheet")
        .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))
      setWorksheets(ws)
      setPhase("ready")
    } catch (e) {
      setPhase("error")
      setErrorText(e instanceof Error ? e.message : "Could not load worksheets.")
    }
  }, [user?.uid, classroomId])

  useEffect(() => {
    void loadWorksheets()
  }, [loadWorksheets])

  const empty = useMemo(() => phase === "ready" && worksheets.length === 0, [phase, worksheets.length])

  const handleNewWorksheet = useCallback(async () => {
    if (!user?.uid) return
    setCreating(true)
    setErrorText(null)
    try {
      const padId = await startNewClassroomWorksheet(user.uid, classroomId)
      await fetchFolders(user.uid)
      onAfterProvision?.()
      navigate(`/app/pad/${padId}`, { replace: true })
    } catch (e) {
      setErrorText(e instanceof Error ? e.message : "Could not create a worksheet.")
      setPhase("error")
    } finally {
      setCreating(false)
    }
  }, [user?.uid, classroomId, fetchFolders, navigate, onAfterProvision])

  return (
    <div className="classroom-hub__tab-panel">
      <div className="classroom-hub__tab-panel__toolbar">
        <p className="classroom-hub__tab-panel__lede">
          Open or edit worksheets you have created for this class. Use <strong>New worksheet</strong> when you want a
          fresh draft in the class Worksheets folder.
        </p>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button type="button" size="sm" variant="default" disabled={creating} onClick={() => void handleNewWorksheet()}>
            {creating ? "Creating…" : "New worksheet"}
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={phase === "loading"} onClick={() => void loadWorksheets()}>
            Refresh
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onOpenLibrary}>
            Library
          </Button>
        </div>
      </div>

      <section className="classroom-hub__card">
        <h2 className="classroom-hub__card-title">Your worksheets</h2>
        {phase === "loading" ? (
          <p className="classroom-hub__empty">Loading worksheets…</p>
        ) : phase === "error" ? (
          <>
            <p className="classroom-hub__empty">{errorText ?? "Something went wrong."}</p>
            <div className="classroom-hub__tab-panel__footer">
              <Button type="button" size="sm" variant="default" onClick={() => void loadWorksheets()}>
                Try again
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={onOpenLibrary}>
                Library
              </Button>
            </div>
          </>
        ) : empty ? (
          <>
            <p className="classroom-hub__empty">No worksheets in this class yet. Create one to start drafting.</p>
            <div className="classroom-hub__tab-panel__footer">
              <Button type="button" size="sm" variant="default" disabled={creating} onClick={() => void handleNewWorksheet()}>
                {creating ? "Creating…" : "New worksheet"}
              </Button>
            </div>
          </>
        ) : (
          <ul className="classroom-hub__resource-list">
            {worksheets.map((n) => (
              <li key={n.id} className="classroom-hub__resource-row">
                <div className="classroom-hub__resource-main">
                  <span className="classroom-hub__resource-title">{n.title?.trim() || "Untitled worksheet"}</span>
                  <span className="classroom-hub__resource-meta">Updated {formatUpdatedAt(n.updatedAt)}</span>
                </div>
                <Button type="button" size="sm" variant="outline" className="shrink-0" onClick={() => navigate(`/app/pad/${n.id}`)}>
                  Open
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
