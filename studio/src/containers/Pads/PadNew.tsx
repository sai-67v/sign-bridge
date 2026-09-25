import { useState } from "react"
import { HiOutlinePlus } from "react-icons/hi"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../../hooks/useAuth"
import { usePadStore } from "../../store"
import { useFolderStore } from "../../store/folderStore"
import { useWorkspaceStore } from "../../store/workspaceStore"
import { createQuickPad } from "./quickCreatePad"
import { message } from "../../components/message"
import FolderNameDialog from "./FolderNameDialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu"

function PadNew() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const bumpPadList = usePadStore((state) => state.setNeedToUpdate)
  const registerFolder = useWorkspaceStore((s) => s.registerFolder)
  const [busy, setBusy] = useState(false)
  const [createFolderOpen, setCreateFolderOpen] = useState(false)

  const handleNew = async (mediumType: "page" | "worksheet" | "flashcard" | "folder") => {
    if (mediumType === "folder") {
      setCreateFolderOpen(true)
      return
    }
    if (!user?.uid || busy) return
    setBusy(true)
    try {
      const folderIdAtCreate = useWorkspaceStore.getState().selectedFolderId
      await createQuickPad({
        uid: user.uid,
        folderId: folderIdAtCreate,
        mediumType,
        navigate,
        bumpPadList,
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex gap-1">
      <FolderNameDialog
        open={createFolderOpen}
        title="Create folder"
        submitLabel="Create"
        initialValue="New Folder"
        onOpenChange={setCreateFolderOpen}
        onSubmit={async ({ name, accentIndex }) => {
          if (!user?.uid) {
            message.error("Sign in to create a folder.")
            throw new Error("not signed in")
          }
          try {
            const created = await useFolderStore.getState().createFolder(user.uid, {
              name: name.trim() || "Untitled folder",
            })
            registerFolder({
              id: created.id,
              name: created.name,
              accentIndex,
            })
            message.success("Folder created")
          } catch (e) {
            console.error(e)
            message.error("Could not create folder on the server.")
            throw e instanceof Error ? e : new Error("create folder failed")
          }
        }}
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            disabled={busy || !user?.uid}
            className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-600 dark:text-gray-300 disabled:pointer-events-none disabled:opacity-50"
            title="Create item"
          >
            <HiOutlinePlus className="h-5 w-5" aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>Create</DropdownMenuLabel>
          <DropdownMenuItem onSelect={() => void handleNew("page")}>Page</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void handleNew("folder")}>Folder</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => void handleNew("worksheet")}>Worksheet (placeholder)</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void handleNew("flashcard")}>Flashcard (placeholder)</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

export default PadNew
