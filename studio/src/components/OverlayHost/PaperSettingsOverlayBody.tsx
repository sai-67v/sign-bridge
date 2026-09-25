import { useCallback, useEffect, useState } from "react"
import { useMatch } from "react-router-dom"
import { PaperTemplateMenu } from "../PaperChrome/PaperTemplateMenu"
import { PadTileAccentSwatches } from "../../containers/Pads/PadTileAccentSwatches"
import { padHomeDualAccentFromId } from "../../containers/Pads/padHomeIconAccent"
import { getPadById, updatePadMetadata } from "../../services/pads"
import { usePadStore } from "../../store"

export default function PaperSettingsOverlayBody() {
  const m = useMatch("/app/pad/:id")
  const id = m?.params.id
  const bumpPadList = usePadStore((s) => s.setNeedToUpdate)
  const [accent, setAccent] = useState(0)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    void getPadById(id).then((p) => {
      if (cancelled || !p) return
      setAccent(p.tileAccentIndex ?? padHomeDualAccentFromId(id))
    })
    return () => {
      cancelled = true
    }
  }, [id])

  const onAccentChange = useCallback(
    async (next: number) => {
      if (!id) return
      setAccent(next)
      setSaving(true)
      try {
        await updatePadMetadata({ id, tileAccentIndex: next })
        bumpPadList()
      } finally {
        setSaving(false)
      }
    },
    [id, bumpPadList]
  )

  if (!id) {
    return (
      <p className="px-1 text-sm" style={{ color: "var(--common-semidark-text-color)" }}>
        Open a page to change paper template and tile color.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-6 px-1">
      <PadTileAccentSwatches
        value={accent}
        onChange={onAccentChange}
        disabled={saving}
        label="Library tile color"
      />
      <PaperTemplateMenu variant="sidebar" />
    </div>
  )
}
