import { useCallback, useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { HiOutlineArrowLeft } from "react-icons/hi"
import { useAuth } from "../hooks/useAuth"
import { submissionService } from "../services/submissionService"
import { worksheetService } from "../services/worksheetService"
import type { IWorksheet, IWorksheetSubmission } from "../types"
import WorksheetViewer from "../components/WorksheetViewer/WorksheetViewer"
import { Button } from "@/components/ui/button"

export default function StudentWorksheetAssignment() {
  const { submissionId } = useParams<{ submissionId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [submission, setSubmission] = useState<IWorksheetSubmission | null>(null)
  const [worksheet, setWorksheet] = useState<IWorksheet | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!user?.uid || !submissionId) {
      setError("Missing assignment.")
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const sub = await submissionService.getSubmission(submissionId)
      if (sub.studentId !== user.uid) {
        setError("This assignment belongs to another account.")
        setSubmission(null)
        setLoading(false)
        return
      }
      setSubmission(sub)
      let parsed: Record<string, string> = {}
      try {
        if (sub.studentAnswers) parsed = JSON.parse(sub.studentAnswers) as Record<string, string>
      } catch {
        parsed = {}
      }
      setAnswers(parsed)
      const ws = await worksheetService.getWorksheet(sub.worksheetId)
      setWorksheet(ws)
    } catch {
      setError("Could not load this assignment. Ask your teacher to send it again, or open it from the class page.")
      setSubmission(null)
      setWorksheet(null)
    } finally {
      setLoading(false)
    }
  }, [submissionId, user?.uid])

  useEffect(() => {
    void reload()
  }, [reload])

  const backToClass = () => {
    if (submission?.classroomId) {
      navigate(`/app/pad/classroom/${encodeURIComponent(submission.classroomId)}?tab=assignments`)
    } else {
      navigate("/app/pad")
    }
  }

  if (!user) return null

  return (
    <main className="pad-home classroom-hub student-assignment" style={{ padding: "1rem 1.25rem 2rem" }}>
      <div className="classroom-hub__masthead" style={{ marginBottom: "1rem" }}>
        <button type="button" className="pad-home__back" onClick={backToClass}>
          <HiOutlineArrowLeft className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
          Class
        </button>
        <div>
          <h1 className="classroom-hub__name">{worksheet?.title ?? "Worksheet"}</h1>
          {submission ? (
            <p className="classroom-hub__subject">
              {submission.status === "pending" ? "Complete and turn in when ready." : "Submitted — read only."}
            </p>
          ) : null}
        </div>
      </div>

      {loading ? <p className="classroom-hub__empty">Loading…</p> : null}
      {error ? <p className="classroom-hub__error">{error}</p> : null}

      {!loading && !error && worksheet && submission ? (
        <>
          <WorksheetViewer
            padId={worksheet.id}
            content={worksheet.content}
            serverAnswers={answers}
            readOnly={submission.status !== "pending"}
            submissionIdForAnswers={submission.status === "pending" ? submission.id : undefined}
            submissionStatus={submission.status}
            onSubmitted={() => void reload()}
          />
          {submission.status !== "pending" ? (
            <div style={{ marginTop: "1rem" }}>
              <Button type="button" variant="outline" size="sm" onClick={backToClass}>
                Back to assignments
              </Button>
            </div>
          ) : null}
        </>
      ) : null}
    </main>
  )
}
