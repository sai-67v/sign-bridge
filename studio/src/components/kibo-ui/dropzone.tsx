import * as React from "react"
import { cn } from "../../lib/utils"

type DropzoneProps = React.HTMLAttributes<HTMLDivElement> & {
  onFilesDrop?: (files: File[]) => void
  accept?: string
  disabled?: boolean
}

export function Dropzone({
  className,
  onFilesDrop,
  accept,
  disabled = false,
  children,
  ...props
}: DropzoneProps) {
  const [isOver, setIsOver] = React.useState(false)

  const accepts = React.useMemo(() => {
    if (!accept) return []
    return accept
      .split(",")
      .map((part) => part.trim().toLowerCase())
      .filter(Boolean)
  }, [accept])

  const fileAccepted = React.useCallback(
    (file: File) => {
      if (accepts.length === 0) return true
      const mime = file.type.toLowerCase()
      const name = file.name.toLowerCase()
      return accepts.some((rule) => {
        if (rule.endsWith("/*")) {
          return mime.startsWith(rule.replace("/*", "/"))
        }
        if (rule.startsWith(".")) {
          return name.endsWith(rule)
        }
        return mime === rule
      })
    },
    [accepts]
  )

  const emitFiles = React.useCallback(
    (files: FileList | null) => {
      if (disabled || !files || files.length === 0) return
      const accepted = Array.from(files).filter(fileAccepted)
      if (accepted.length > 0) onFilesDrop?.(accepted)
    },
    [disabled, fileAccepted, onFilesDrop]
  )

  return (
    <div
      {...props}
      className={cn(
        "relative flex w-full flex-col items-center justify-center rounded-lg border border-dashed border-[var(--common-border-color)] bg-[var(--common-dark-bg-color)] p-4 text-center transition-colors",
        isOver && !disabled && "border-[var(--common-primary-color)] bg-[var(--common-btn-bg-hover-color)]",
        disabled && "cursor-not-allowed opacity-60",
        className
      )}
      onDragOver={(event) => {
        if (disabled) return
        event.preventDefault()
        setIsOver(true)
      }}
      onDragLeave={() => setIsOver(false)}
      onDrop={(event) => {
        if (disabled) return
        event.preventDefault()
        setIsOver(false)
        emitFiles(event.dataTransfer.files)
      }}
      aria-disabled={disabled}
    >
      <input
        type="file"
        accept={accept}
        disabled={disabled}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        onChange={(event) => {
          emitFiles(event.target.files)
          event.currentTarget.value = ""
        }}
        aria-label="Upload files"
      />
      {children}
    </div>
  )
}

export function DropzoneContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("pointer-events-none flex w-full flex-col items-center gap-2", className)} {...props} />
}

export function DropzoneEmptyState({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("pointer-events-none text-xs leading-relaxed text-[var(--common-semidark-text-color)]", className)}
      {...props}
    />
  )
}
