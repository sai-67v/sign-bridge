import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

interface InputDialogProps {
    isOpen: boolean
    onClose: () => void
    onSubmit: (value: string) => void
    title: string
    placeholder?: string
    defaultValue?: string
    submitLabel?: string
}

export function InputDialog({
    isOpen,
    onClose,
    onSubmit,
    title,
    placeholder = "Enter URL...",
    defaultValue = "",
    submitLabel = "Add"
}: InputDialogProps) {
    const [value, setValue] = useState(defaultValue)

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (value.trim()) {
            onSubmit(value.trim())
            setValue("")
            onClose()
        }
    }

    const handleClose = () => {
        setValue(defaultValue)
        onClose()
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose() }}>
            <DialogContent className="max-w-md border-[color:var(--modal-border-color)] bg-[color:var(--modal-bg-color)] text-[color:var(--common-text-color)] sm:rounded-xl">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <Input
                        type="text"
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        placeholder={placeholder}
                        className="mt-2 bg-[color:var(--common-bg-color)] text-[color:var(--common-text-color)]"
                        autoFocus
                    />
                    <DialogFooter className="mt-4 gap-2 sm:gap-0">
                        <Button type="button" variant="outline" onClick={handleClose}>
                            Cancel
                        </Button>
                        <Button type="submit">{submitLabel}</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
