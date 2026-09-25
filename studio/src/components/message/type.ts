import type { Root } from "react-dom/client"

export type MessageFunc = (content: string, timeout?: number) => void

export type MessageCreateFunc = (
  type: string,
  content: string,
  timeout?: number
) => void

export type MessageClearFuncRetType = {
  root: Root | null
  container: HTMLElement
}

export interface MessageFCProps {
  type: string
  content: string
}
