import React, { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { getPadsByUid, IPad, delPad } from "../../services/pads"
import { useActiveTabsStore } from "../../store/activeTabs"
import { HiOutlineDocument, HiOutlineTrash } from "react-icons/hi"
import { confirmDanger } from "../../components/Confirm"
import { message } from "../../components/message"
import { usePadStore } from "../../store"
import { decreasePlanRecord } from "../../services/plans"
import { deleteAllImageInOnePad } from "../../services/files"
import { useWorksheetStore } from "../../store/worksheetStore"
import { useAuth } from "../../hooks/useAuth"
import "./PadNavigation.css"

export default function PadNavigation() {
    const navigate = useNavigate()
    const { user } = useAuth()
    const ownerUid = user?.uid || "local-user-123"
    const { openTab } = useActiveTabsStore()
    const [pads, setPads] = useState<IPad[]>([])
    const { isWorksheet, getAIUsageForPad } = useWorksheetStore()

    // Fetch all pads
    useEffect(() => {
        const fetchPads = async () => {
            const allPads = await getPadsByUid(ownerUid)
            if (allPads) {
                setPads(allPads)
            }
        }
        fetchPads()
        // Refresh every 10 seconds
        const interval = setInterval(fetchPads, 10000)
        return () => clearInterval(interval)
    }, [ownerUid])

    // Instantly reflect title edits without waiting for the 10-second poll.
    useEffect(() => {
        const handleMetadataChanged = (event: CustomEvent) => {
            const { id: changedId, title } = event.detail || {}
            if (changedId && title !== undefined) {
                setPads(prev =>
                    prev.map(p => p.id === changedId ? { ...p, title } : p)
                )
            }
        }
        window.addEventListener('pad_metadata_changed', handleMetadataChanged as EventListener)
        return () => window.removeEventListener('pad_metadata_changed', handleMetadataChanged as EventListener)
    }, [])

    const handlePadClick = (padId: string) => {
        openTab(padId)
        navigate(`/app/pad/${padId}`)
    }

    const setNeedToUpdate = usePadStore((state) => state.setNeedToUpdate)

    const handleDelete = (e: React.MouseEvent, padId: string) => {
        e.preventDefault()
        e.stopPropagation()

        confirmDanger({
            title: 'Delete this note',
            desc: 'Are you sure to delete this note? All of your content will be permanently removed. This action cannot be undone.',
            yes: async () => {
                navigate("/app/pad/")
                const [outcome] = await Promise.all([delPad(padId), deleteAllImageInOnePad(padId)])
                if (outcome === "deleted") {
                  await decreasePlanRecord()
                }
                setNeedToUpdate()
                // Refresh pad list
                const allPads = await getPadsByUid(ownerUid)
                if (allPads) {
                    setPads(allPads)
                }
                message.success("Deleted pad successfully")
            },
        })
    }

    return (
        <div className="pad-navigation">
            {pads.map(pad => (
                <div
                    key={pad.id}
                    className="pad-item group"
                    onClick={() => handlePadClick(pad.id)}
                >
                    <HiOutlineDocument size={14} />
                    <span className="pad-title">{pad.title || "Untitled"}</span>
                    {/* Worksheet indicator */}
                    {isWorksheet(pad.id) && (
                        <span className="pad-badge worksheet" title="Worksheet">📋</span>
                    )}
                    {/* AI usage indicator */}
                    {getAIUsageForPad(pad.id).length > 0 && (
                        <span className="pad-badge ai" title={`${getAIUsageForPad(pad.id).length} AI interactions`}>🤖</span>
                    )}
                    <button
                        onClick={(e) => handleDelete(e, pad.id)}
                        className="pad-delete-btn"
                        title="Delete pad"
                    >
                        <HiOutlineTrash size={14} />
                    </button>
                </div>
            ))}

            {pads.length === 0 && (
                <div className="no-pads">No pads yet. Create one to get started!</div>
            )}
        </div>
    )
}
