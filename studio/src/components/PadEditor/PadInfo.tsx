import { Unsubscribe } from "../../libs/firebase"
import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import { useAuth } from "../../hooks/useAuth"
import { IPad, watchPadById } from "../../services/pads"
import { useWorksheetStore } from "../../store/worksheetStore"
import { isWorksheetPad as padIsWorksheet } from "../../utils/worksheetPadDetection"
import { PaperButton } from "../ui"
import { HiOutlinePaperAirplane } from "react-icons/hi"
import DistributeModal from "../../containers/PadActions/DistributeModal"

interface IPadInfoContentProps {
  info: IPad
}

function PadInfoContent({ info }: IPadInfoContentProps) {
  const { id } = useParams()
  const { user } = useAuth()
  const { clearWorksheet } = useWorksheetStore()
  const worksheetToolbar = padIsWorksheet(info, info.content ?? "")
  const isTeacher = user?.role === "teacher" || user?.role === "admin"
  const [distributeOpen, setDistributeOpen] = useState(false)

  const handleClearWorksheet = () => {
    if (id && window.confirm("Are you sure you want to clear all student answers and AI history for this worksheet?")) {
      clearWorksheet(id)
      setTimeout(() => window.location.reload(), 100)
    }
  }

  if (!worksheetToolbar || !isTeacher) return null

  return (
    <div className="pad-info-wrapper pad-info-wrapper--worksheet-toolbar pad-info-wrapper--worksheet-toolbar-bottom relative">
      <div className="pad-infos pad-infos--compact pad-infos--worksheet-toolbar relative">
        <div className="worksheet-toolbar-row">
          <div className="worksheet-toolbar-row__primary">
            <PaperButton type="button" onClick={() => setDistributeOpen(true)} className="inline-flex items-center gap-2">
              <HiOutlinePaperAirplane className="w-4 h-4" aria-hidden="true" />
              Send to Class
            </PaperButton>
          </div>
          <PaperButton
            type="button"
            variant="outline"
            onClick={handleClearWorksheet}
            className="worksheet-toolbar-row__danger text-xs shrink-0"
          >
            Clear worksheet
          </PaperButton>
        </div>
      </div>
      {distributeOpen && info ? <DistributeModal pad={info} onClose={() => setDistributeOpen(false)} /> : null}
    </div>
  )
}

function PadInfo() {
  const { id } = useParams()
  const [info, setInfo] = useState<IPad>()

  useEffect(() => {
    let unsub: Unsubscribe
    if (id) {
      unsub = watchPadById(id, (err, data) => {
        if (err) return

        setInfo(data)
      })
    }

    return () => {
      unsub && unsub()
    }
  }, [id])

  useEffect(() => {
    const handleMetadataChanged = (event: CustomEvent) => {
      const { id: changedId, ...fields } = event.detail || {}
      if (changedId === id && id) {
        setInfo((prev) => (prev ? { ...prev, ...fields } : prev))
      }
    }

    window.addEventListener("pad_metadata_changed", handleMetadataChanged as EventListener)
    return () => {
      window.removeEventListener("pad_metadata_changed", handleMetadataChanged as EventListener)
    }
  }, [id])

  return info ? <PadInfoContent info={info} /> : null
}

export default PadInfo
