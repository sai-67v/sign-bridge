import { useEffect, useState } from "react"
import { Button } from "../../components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../../components/ui/dialog"
import { Input } from "../../components/ui/input"
import { PadTileAccentSwatches } from "./PadTileAccentSwatches"

export type FolderNameSubmitPayload = {
  name: string
  accentIndex: number
}

type Props = {
  open: boolean
  title: string
  submitLabel: string
  initialValue?: string
  /** Pick tile accent (folders); defaults to 0 */
  initialAccentIndex?: number
  /** Show color row (default true) */
  showAccentPicker?: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (payload: FolderNameSubmitPayload) => void | Promise<void>
}

export default function FolderNameDialog({
  open,
  title,
  submitLabel,
  initialValue = "",
  initialAccentIndex = 0,
  showAccentPicker = true,
  onOpenChange,
  onSubmit,
}: Props) {
  const [value, setValue] = useState(initialValue)
  const [accentIndex, setAccentIndex] = useState(initialAccentIndex)

  useEffect(() => {
    if (open) {
      setValue(initialValue)
      setAccentIndex(initialAccentIndex)
    }
  }, [initialAccentIndex, initialValue, open])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    const trimmed = value.trim()
    if (!trimmed) return
    try {
      await Promise.resolve(onSubmit({ name: trimmed, accentIndex: accentIndex % 8 }))
      onOpenChange(false)
    } catch {
      /* parent shows errors; keep dialog open */
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Input
            autoFocus
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="Folder name"
          />
          {showAccentPicker ? (
            <PadTileAccentSwatches value={accentIndex} onChange={setAccentIndex} size="sm" label="Tile color" />
          ) : null}
          <DialogFooter className="flex flex-row justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">{submitLabel}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
