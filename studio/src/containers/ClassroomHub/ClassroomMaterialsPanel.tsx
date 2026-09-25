import { useEffect, useRef, useState } from "react"
import { Loader2 } from "lucide-react"
import { HiOutlineUpload } from "react-icons/hi"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import type { IClassroom } from "../../types"
import { classroomService } from "../../services/classroomService"
import { folderService } from "../../services/folderService"
import { materialService, type IMaterial } from "../../services/materialService"
import { notebookService } from "../../services/notebookService"

export type ClassroomMaterialsPanelProps = {
  classroom: IClassroom
  teacherId: string
  onOpenLibrary: () => void
  /** Refresh parent `classroom` after provisioning so `materialsFolderId` stays in sync. */
  onRefreshClassroom?: () => void
}

type ProvisionOutcome = "ready" | "no_folder" | "error"

export function ClassroomMaterialsPanel({
  classroom,
  teacherId,
  onOpenLibrary,
  onRefreshClassroom,
}: ClassroomMaterialsPanelProps) {
  const [materials, setMaterials] = useState<IMaterial[]>([])
  const [loading, setLoading] = useState(true)
  const [uploadBusy, setUploadBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [provisionOutcome, setProvisionOutcome] = useState<ProvisionOutcome>("ready")
  const fileRef = useRef<HTMLInputElement>(null)
  const classroomRef = useRef(classroom)
  classroomRef.current = classroom

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      const c = classroomRef.current
      setLoading(true)
      setError(null)
      setProvisionOutcome("ready")
      try {
        const refreshed = await classroomService.ensureClassWorkspaceIfNeeded(teacherId, c)
        if (cancelled) return
        if (refreshed.materialsFolderId !== c.materialsFolderId || refreshed.rootFolderId !== c.rootFolderId) {
          onRefreshClassroom?.()
        }
        const materialsFolder = await folderService.ensureClassMaterialsFolder(teacherId, refreshed)
        if (cancelled) return
        const folderId = materialsFolder?.id ?? refreshed.materialsFolderId ?? null
        if (!folderId) {
          setMaterials([])
          setProvisionOutcome("no_folder")
          setError(
            "We could not finish setting up the class Materials folder. Check that this class has a workspace, then try again.",
          )
          return
        }
        const list = await materialService.listMaterialsInClassFolder(folderId)
        if (!cancelled) setMaterials(list)
      } catch {
        if (!cancelled) {
          setMaterials([])
          setProvisionOutcome("error")
          setError("Something went wrong while loading materials. Please try again.")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [classroom.id, classroom.rootFolderId, classroom.materialsFolderId, teacherId, onRefreshClassroom])

  const reloadMaterials = async () => {
    const c = classroomRef.current
    setLoading(true)
    setError(null)
    setProvisionOutcome("ready")
    try {
      const refreshed = await classroomService.ensureClassWorkspaceIfNeeded(teacherId, c)
      if (refreshed.materialsFolderId !== c.materialsFolderId || refreshed.rootFolderId !== c.rootFolderId) {
        onRefreshClassroom?.()
      }
      const materialsFolder = await folderService.ensureClassMaterialsFolder(teacherId, refreshed)
      const folderId = materialsFolder?.id ?? refreshed.materialsFolderId ?? null
      if (!folderId) {
        setMaterials([])
        setProvisionOutcome("no_folder")
        setError(
          "We could not finish setting up the class Materials folder. Check that this class has a workspace, then try again.",
        )
        return
      }
      const list = await materialService.listMaterialsInClassFolder(folderId)
      setMaterials(list)
    } catch {
      setMaterials([])
      setProvisionOutcome("error")
      setError("Something went wrong while loading materials. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const onPickFile = () => {
    fileRef.current?.click()
  }

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    if (file.type !== "application/pdf") {
      setError("Please choose a PDF file.")
      return
    }
    setUploadBusy(true)
    setError(null)
    try {
      const c = classroomRef.current
      const refreshed = await classroomService.ensureClassWorkspaceIfNeeded(teacherId, c)
      if (refreshed.materialsFolderId !== c.materialsFolderId || refreshed.rootFolderId !== c.rootFolderId) {
        onRefreshClassroom?.()
      }
      const materialsFolder = await folderService.ensureClassMaterialsFolder(teacherId, refreshed)
      const classFolderId = materialsFolder?.id ?? refreshed.materialsFolderId ?? null
      if (!classFolderId) {
        setProvisionOutcome("no_folder")
        setError("The class Materials folder is not available yet. Set up the class workspace, then retry.")
        return
      }
      const notebookId = await notebookService.ensureInboxNotebook(teacherId)
      if (!notebookId) {
        setError("Could not prepare your notebook for this upload. Try again.")
        return
      }
      await materialService.uploadMaterial(teacherId, notebookId, file, file.name.replace(/\.pdf$/i, "") || "Material", {
        classFolderId,
      })
      await reloadMaterials()
    } catch {
      setError("Upload did not finish. Check your connection and try again.")
    } finally {
      setUploadBusy(false)
    }
  }

  const openPdf = (m: IMaterial) => {
    const url = materialService.getFileViewUrl(m.fileId)
    window.open(url, "_blank", "noopener,noreferrer")
  }

  return (
    <div className="classroom-hub__tab-panel classroom-hub__materials-panel">
      <input
        ref={fileRef}
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        aria-hidden
        tabIndex={-1}
        onChange={(e) => void onFileChange(e)}
      />

      <Card className="classroom-hub__card border-border/80 shadow-sm">
        <CardHeader className="classroom-hub__materials-panel__head flex flex-col gap-4 space-y-0 pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <CardTitle id="classroom-materials-title" className="classroom-hub__card-title text-xl">
              Materials
            </CardTitle>
            <CardDescription className="classroom-hub__hint mt-1.5 text-pretty">
              PDFs you add here are stored in this class&apos;s workspace and appear for students in the Material pane on
              class notes.
            </CardDescription>
          </div>
          <div className="classroom-hub__materials-panel__actions flex shrink-0 flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant="outline" onClick={onOpenLibrary}>
              Library
            </Button>
            <Button type="button" size="sm" onClick={onPickFile} disabled={uploadBusy || loading}>
              {uploadBusy ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="size-4 shrink-0 animate-spin opacity-80" aria-hidden />
                  Uploading…
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <HiOutlineUpload className="size-4 shrink-0 opacity-80" aria-hidden />
                  Upload PDF
                </span>
              )}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-0">
          {error ? (
            <Alert variant="destructive">
              <AlertTitle>Something went wrong</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          {loading ? (
            <div className="space-y-2" aria-busy="true" aria-label="Loading materials">
              <Skeleton className="h-4 w-2/3 max-w-xs" />
              <Skeleton className="h-4 w-4/5 max-w-sm" />
              <Skeleton className="h-9 w-full max-w-md" />
            </div>
          ) : materials.length > 0 ? (
            <ul className="classroom-hub__resource-list flex list-none flex-col gap-0 p-0">
              {materials.map((m) => (
                <li key={m.id} className="classroom-hub__resource-row">
                  <div className="classroom-hub__resource-main min-w-0">
                    <span className="classroom-hub__resource-title truncate">{m.title}</span>
                    <span className="classroom-hub__resource-meta">
                      PDF · {m.pageCount || 1} page{(m.pageCount || 1) === 1 ? "" : "s"}
                    </span>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="shrink-0"
                    onClick={() => openPdf(m)}
                    disabled={uploadBusy}
                  >
                    Open
                  </Button>
                </li>
              ))}
            </ul>
          ) : error ? null : provisionOutcome === "no_folder" ? (
            <p className="classroom-hub__empty text-sm text-muted-foreground" role="status">
              Materials will appear here after the class workspace is ready. If this message stays, open Classroom Manager and
              ensure this class has a library root, then return to this tab.
            </p>
          ) : (
            <p className="classroom-hub__empty text-sm text-muted-foreground">
              No PDFs yet. Upload a handout or reading to share with this class.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
