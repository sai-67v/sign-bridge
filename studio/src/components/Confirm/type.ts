export interface ConfirmFCProps {
  title: string
  desc: string
  yes: () => void
  no?: () => void
  /** Primary action label (default “Yes”) */
  yesLabel?: string
  /** Secondary / dismiss label (default “No”) */
  noLabel?: string
}

export type RenderFunc = {
  title: string
  container: HTMLElement
  desc: string
  yes: () => void
  no?: () => void
  yesLabel?: string
  noLabel?: string
}

export enum EConfirmBoxType {
  DANGER,
  INFO
}
