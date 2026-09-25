import dayjs from "dayjs"
import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { HiOutlineStar, HiStar, HiOutlineTrash } from "react-icons/hi"

import { IPad, delPad } from "../../services/pads"
import ContextMenu, { useContextMenu } from "../../components/ContextMenu"
import PadActions from "../PadActions/index"
import useMobileNavigator from "../../components/MobileNavigator/useMobileNavigator"
import { confirmDanger } from "../../components/Confirm"
import { message } from "../../components/message"
import { usePadStore } from "../../store"
import { decreasePlanRecord } from "../../services/plans"
import { deleteAllImageInOnePad } from "../../services/files"

interface IPadItemProps {
  pad: IPad
  active: boolean
}

export default function PadItem({ active, pad }: IPadItemProps) {
  const { visible: isContextMenuDisplayed } = useContextMenu()
  const { setSecondSidebarVisible } = useMobileNavigator()
  const [deleting, setDeleting] = useState(false)
  const navigate = useNavigate()
  const setNeedToUpdate = usePadStore((state) => state.setNeedToUpdate)
  const d = dayjs(pad.updatedAt.toDate())

  const onClick = () => {
    setSecondSidebarVisible()
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    confirmDanger({
      title: 'Delete this note',
      desc: 'Are you sure to delete this note? All of your content will be permanently removed. This action cannot be undone.',
      yes: async () => {
        if (deleting) {
          message.warning("The pad is in deleting process")
          return
        }

        setDeleting(true)
        navigate("/app/pad/")
        const [outcome] = await Promise.all([delPad(pad.id), deleteAllImageInOnePad(pad.id)])
        if (outcome === "deleted") {
          await decreasePlanRecord()
        }

        setNeedToUpdate()
        setDeleting(false)
        message.success("Deleted pad successfully")
      },
    })
  }

  return (
    <div
      className={`${active ? "active" : ""} ${isContextMenuDisplayed ? "context-menu-opened" : ""
        } pad-item group`}
    >
      <Link to={`/app/pad/${pad.id}`} onClick={onClick}>
        <div className="flex flex-col justify-between">
          <div className="min-w-0 flex-1">
            <div className="block focus:outline-none">
              <div className="flex items-center justify-between">
                <time className="flex-shrink-0 whitespace-nowrap text-xs text-gray-500">
                  <i>{d.fromNow()}</i>
                </time>
              </div>

              <h2 className="pad-item-title mt-1" title={pad.title}>
                {pad.title}
              </h2>
              <p className="text-sm text-gray-500 truncate">
                {/* {pad.content} */}
              </p>
            </div>
          </div>
        </div>
        <div className="pad-as-important absolute bottom-5 right-4 flex items-center gap-2">
          <button
            onClick={handleDelete}
            className="pad-delete-btn opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-500"
            title="Delete pad"
          >
            <HiOutlineTrash className="w-4 h-4" />
          </button>
          {pad.important ? (
            <HiStar className="pad-important-icon" />
          ) : (
            <HiOutlineStar className="pad-unimportant-icon" />
          )}
        </div>
      </Link>
      <ContextMenu.Items>
        <PadActions data={pad} />
      </ContextMenu.Items>
    </div>
  )
}
