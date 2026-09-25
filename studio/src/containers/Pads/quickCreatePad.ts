import type { NavigateFunction } from "react-router-dom"
import { message } from "../../components/message"
import { addPad } from "../../services/pads"
import { IPlan, isPlanExceed, updatePlanByUid } from "../../services/plans"

/** Create an empty "Untitled" pad and open it (same behavior as the removed new-pad modal submit). */
export async function createQuickPad(options: {
  uid: string
  folderId?: string | null
  mediumType?: "page" | "worksheet" | "flashcard"
  navigate: NavigateFunction
  bumpPadList: () => void
}): Promise<boolean> {
  const { uid, folderId, mediumType = "page", navigate, bumpPadList } = options

  let planData: IPlan
  try {
    planData = (await isPlanExceed()) as IPlan
  } catch (error) {
    if (error === "EXCEED_PLAN") {
      message.warning("Current plan is exceeded !")
      return false
    }
    console.log(error)
    message.error("Create new pad error !")
    return false
  }

  try {
    const id = await addPad({
      uid,
      title: "Untitled",
      shortDesc: "",
      notebookId: undefined,
      folderId: folderId ?? undefined,
      padType: mediumType === "worksheet" ? "worksheet" : "note",
    })

    if (!id) {
      message.error("Create new pad error !")
      return false
    }

    updatePlanByUid({ currentRecord: planData.currentRecord + 1 })
    navigate(`/app/pad/${id}`)
    bumpPadList()
    return true
  } catch (error) {
    console.log(error)
    message.error("Create new pad error !")
    return false
  }
}
