import { useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { HiOutlineArrowLeft } from "react-icons/hi"
import { useAuth } from "../../hooks/useAuth"
import { useWorkspaceStore } from "../../store/workspaceStore"
import "./TeacherDashboard.css"

export default function TeacherDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const setSelectedFolderId = useWorkspaceStore((s) => s.setSelectedFolderId)
  const setMediumFilter = useWorkspaceStore((s) => s.setMediumFilter)

  const goLibrary = useCallback(() => {
    setSelectedFolderId(null)
    setMediumFilter("all")
    navigate("/app/pad")
  }, [navigate, setMediumFilter, setSelectedFolderId])

  if (!user) return null

  return (
    <main className="pad-home teacher-dashboard" aria-labelledby="teacher-dashboard-title">
      <div className="teacher-dashboard__masthead">
        <button type="button" className="pad-home__back" onClick={goLibrary}>
          <HiOutlineArrowLeft className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
          Library
        </button>
        <h1 id="teacher-dashboard-title" className="teacher-dashboard__title">
          Teach
        </h1>
        <p className="teacher-dashboard__lede">
          Open a class from <strong>Library</strong> → <strong>Your classes</strong>. Worksheets, materials, and
          submissions are scoped to that class.
        </p>
      </div>
    </main>
  )
}
