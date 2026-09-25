import { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../../hooks/useAuth"
import { submissionService } from "../../services/submissionService"
import { worksheetService } from "../../services/worksheetService"
import type { IWorksheet, IWorksheetSubmission } from "../../types"
import { Button } from "@/components/ui/button"

type Props = {
  classroomId: string
  /** Only rows still in progress (not turned in). */
  pendingOnly?: boolean
  /** Omit outer tab padding — use on classroom Overview. */
  embedded?: boolean
  title?: string
  lede?: string
}

export function ClassroomStudentAssignmentsPanel({
  classroomId,
  pendingOnly = false,
  embedded = false,
  title = "Assignments",
  lede = "Worksheets your teacher sends to this class open here. Your answers save automatically until you turn in.",
}: Props) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [rows, setRows] = useState<IWorksheetSubmission[]>([])
  const [titles, setTitles] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!user?.uid) {
      setRows([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const mine = await submissionService.getMySubmissions(user.uid)
      let forClass = mine.filter((s) => s.classroomId === classroomId)
      if (pendingOnly) {
        forClass = forClass.filter((s) => s.status === "pending")
      }
      setRows(forClass.sort((a, b) => (b.submittedAt || "").localeCompare(a.submittedAt || "")))

      const wsIds = [...new Set(forClass.map((s) => s.worksheetId))]
      const titleEntries = await Promise.all(
        wsIds.map(async (wid) => {
          try {
            const ws: IWorksheet = await worksheetService.getWorksheet(wid)
            return [wid, ws.title || "Worksheet"] as const
          } catch {
            return [wid, "Worksheet"] as const
          }
        })
      )
      setTitles(Object.fromEntries(titleEntries))
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [user?.uid, classroomId, pendingOnly])

  useEffect(() => {
    void load()
  }, [load])

  const emptyMessage = pendingOnly
    ? "Nothing waiting — you have no open assignments for this class right now."
    : "No worksheets for this class yet."

  const section = (
    <section className="classroom-hub__card">
      <h2 className="classroom-hub__card-title">{title}</h2>
      <p className="classroom-hub__hint">{lede}</p>
      {loading ? (
        <p className="classroom-hub__empty">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="classroom-hub__empty">{emptyMessage}</p>
      ) : (
          <ul className="classroom-hub__resource-list">
            {rows.map((s) => (
              <li key={s.id} className="classroom-hub__resource-row">
                <div className="classroom-hub__resource-main">
                  <span className="classroom-hub__resource-title">{titles[s.worksheetId] ?? "Worksheet"}</span>
                  <span className="classroom-hub__resource-meta">
                    {s.status === "pending" ? "In progress" : s.status === "submitted" ? "Turned in" : "Returned"}
                    {s.submittedAt ? ` · ${new Date(s.submittedAt).toLocaleDateString()}` : ""}
                  </span>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant={s.status === "pending" ? "default" : "outline"}
                  className="shrink-0"
                  onClick={() => navigate(`/app/pad/assignment/${encodeURIComponent(s.id)}`)}
                >
                  {s.status === "pending" ? "Continue" : "View"}
                </Button>
              </li>
            ))}
          </ul>
        )}
    </section>
  )

  if (embedded) return section

  return <div className="classroom-hub__tab-panel">{section}</div>
}
