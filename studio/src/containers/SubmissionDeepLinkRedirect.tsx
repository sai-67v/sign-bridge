import { useEffect, useState } from "react"
import { Navigate, useNavigate, useParams } from "react-router-dom"
import { useAuth } from "../hooks/useAuth"
import { worksheetService } from "../services/worksheetService"

/**
 * Legacy `/app/submissions/:distributionId` → class-scoped hub with that distribution open.
 */
export default function SubmissionDeepLinkRedirect() {
  const { distributionId } = useParams<{ distributionId: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [fallback, setFallback] = useState(false)

  useEffect(() => {
    if (!user?.uid || !distributionId) {
      setFallback(true)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const dist = await worksheetService.getDistribution(distributionId)
        if (cancelled) return
        if (dist.classroomId) {
          navigate(
            `/app/pad/classroom/${dist.classroomId}?tab=submissions&distribution=${encodeURIComponent(distributionId)}`,
            { replace: true }
          )
        } else if (!cancelled) {
          setFallback(true)
        }
      } catch {
        if (!cancelled) setFallback(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user?.uid, distributionId, navigate])

  if (!user) return null
  if (fallback) return <Navigate to="/app/pad#pad-home-classes" replace />
  return (
    <div className="pad-home" style={{ padding: "2rem", textAlign: "center" }} role="status">
      <p>Opening submissions…</p>
    </div>
  )
}
