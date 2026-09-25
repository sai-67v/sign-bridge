import React, { useEffect, useState } from "react"
import { useActiveTabsStore } from "../../store/activeTabs"
import { useNavigate, useParams } from "react-router-dom"
import { getPadById, IPad } from "../../services/pads"
import Settings from "../../containers/Settings"
import "./TopBar.css"
import { AiOutlineMenu, AiOutlineClose } from "react-icons/ai"
import { Popover } from "@headlessui/react"
import PadNavigation from "../../containers/PadNavigation"
import PadNew from "../../containers/Pads/PadNew"
import { useAuth } from "../../hooks/useAuth"
import NotificationBell from "../NotificationBell"
import { isWorksheetPad } from "../../utils/worksheetPadDetection"
import { HiOutlineChartBar, HiOutlineClipboardList, HiOutlinePaperAirplane } from "react-icons/hi"
import DistributeModal from "../../containers/PadActions/DistributeModal"
import ClassroomSelector from "../ClassroomSelector"
import { useClassroomStore } from "../../store/classroomStore"
import { flushPendingPadSaveForNote } from "../../services/pendingPadSaveFlush"

interface TabInfo {
    id: string
    title: string
}

export default function TopBar() {
    const navigate = useNavigate()
    const { id } = useParams()
    const { openTabs, closeTab, setActiveTab } = useActiveTabsStore()
    const { user } = useAuth()
    const currentClassroom = useClassroomStore((s) => s.currentClassroom)
    const role = user?.role || 'student'
    const [tabInfos, setTabInfos] = useState<TabInfo[]>([])
    const [currentPad, setCurrentPad] = useState<IPad | null>(null)
    const [distributeOpen, setDistributeOpen] = useState(false)

    useEffect(() => {
        const fetchTabInfos = async () => {
            const infos: TabInfo[] = []
            for (const tabId of openTabs) {
                try {
                    const pad = await getPadById(tabId)
                    if (pad) {
                        infos.push({ id: tabId, title: pad.title || "Untitled" })
                    } else {
                        infos.push({ id: tabId, title: "Untitled" })
                    }
                } catch {
                    infos.push({ id: tabId, title: "Untitled" })
                }
            }
            setTabInfos(infos)
        }
        fetchTabInfos()
    }, [openTabs])

    // Keep tab titles in sync when a pad's metadata is updated without
    // requiring a full re-fetch (avoids the stale-data race condition).
    useEffect(() => {
        const handleMetadataChanged = (event: CustomEvent) => {
            const { id: changedId, title } = event.detail || {}
            if (changedId && title !== undefined) {
                setTabInfos(prev =>
                    prev.map(t => t.id === changedId ? { ...t, title } : t)
                )
            }
        }
        window.addEventListener('pad_metadata_changed', handleMetadataChanged as EventListener)
        return () => window.removeEventListener('pad_metadata_changed', handleMetadataChanged as EventListener)
    }, [])

    // Load current pad for teachers so we can show "Send to Class" when it's a worksheet
    useEffect(() => {
        if (!id || (role !== 'teacher' && role !== 'admin')) {
            setCurrentPad(null)
            return
        }
        let cancelled = false
        getPadById(id).then((pad) => {
            if (!cancelled && pad) setCurrentPad(pad)
            else if (!cancelled) setCurrentPad(null)
        })
        return () => { cancelled = true }
    }, [id, role])

    const isWorksheet = currentPad
        ? isWorksheetPad(currentPad, currentPad.content ?? "")
        : false

    const handleTabClick = (tabId: string) => {
        setActiveTab(tabId)
        navigate(`/app/pad/${tabId}`)
    }

    const handleCloseTab = async (e: React.MouseEvent, tabId: string) => {
        e.stopPropagation()
        if (id === tabId) {
            await flushPendingPadSaveForNote(tabId)
        }
        closeTab(tabId)
        if (id === tabId) {
            const remainingTabs = openTabs.filter(t => t !== tabId)
            if (remainingTabs.length > 0) {
                navigate(`/app/pad/${remainingTabs[0]}`)
            } else {
                navigate("/app/pad")
            }
        }
    }

    return (
        <div className="top-bar">
            <div className="top-bar-left">
                <Popover className="relative">
                    <Popover.Button className="menu-btn" aria-label="Open navigation menu">
                        <AiOutlineMenu size={20} aria-hidden="true" />
                    </Popover.Button>

                    <Popover.Panel className="absolute left-0 mt-2 w-72 rounded-xl shadow-lg p-4 z-50 max-h-[80vh] overflow-y-auto" style={{ backgroundColor: 'var(--common-bg-color)', border: '1px solid var(--common-border-color)', color: 'var(--common-text-color)' }}>
                        <div className="space-y-4">
                            <div>
                                <h3 className="font-bold mb-2 text-xs uppercase" style={{ color: 'var(--common-dark-text-color)' }}>All Pads</h3>
                                <PadNavigation />
                            </div>
                        </div>
                    </Popover.Panel>
                </Popover>
                <span className="brand-name">canis.studio</span>
            </div>

            <div className="top-bar-tabs">
                {tabInfos.map((tab) => (
                    <div
                        key={tab.id}
                        className={`tab-item ${id === tab.id ? "active" : ""}`}
                        onClick={() => handleTabClick(tab.id)}
                        title={tab.title}
                    >
                        <span className="tab-title">{tab.title}</span>
                        <button
                            className="tab-close"
                            onClick={(e) => handleCloseTab(e, tab.id)}
                            aria-label={`Close ${tab.title}`}
                            title="Close tab"
                        >
                            <AiOutlineClose size={12} />
                        </button>
                    </div>
                ))}
            </div>

            <div className="top-bar-right">
                {user && <ClassroomSelector />}
                {(role === 'teacher' || role === 'admin') && (
                    <>
                        {isWorksheet && (
                            <button
                                onClick={() => setDistributeOpen(true)}
                                className="teacher-dashboard-btn send-to-class-btn"
                                title="Send this worksheet to a class"
                            >
                                <HiOutlinePaperAirplane className="w-4 h-4" aria-hidden="true" />
                                Send to Class
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() =>
                                currentClassroom
                                    ? navigate(`/app/pad/classroom/${currentClassroom.id}?tab=submissions`)
                                    : navigate("/app/pad#pad-home-classes")
                            }
                            className="teacher-dashboard-btn"
                            title="View submissions"
                        >
                            <HiOutlineClipboardList className="h-4 w-4 shrink-0" aria-hidden />
                            <span>Submissions</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => navigate('/app/teacher')}
                            className="teacher-dashboard-btn"
                            title="Teacher Dashboard"
                        >
                            <HiOutlineChartBar className="h-4 w-4 shrink-0" aria-hidden />
                            <span>Dashboard</span>
                        </button>
                    </>
                )}
                <NotificationBell />
                <PadNew />
                <div className="header-user-section">
                    <Settings />
                </div>
            </div>
            {distributeOpen && currentPad && (
                <DistributeModal pad={currentPad} onClose={() => setDistributeOpen(false)} />
            )}
        </div>
    )
}
