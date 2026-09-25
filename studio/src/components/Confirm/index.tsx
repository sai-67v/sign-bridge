import { FC } from "react"
import { createRoot, type Root } from "react-dom/client"
import { ConfirmFCProps, EConfirmBoxType, RenderFunc } from "./type"
import { HiOutlineExclamation, HiOutlineExclamationCircle } from "react-icons/hi"
import "./style.css"

const container = document.createElement("div")
const backdrop = document.createElement("div")
let wrapper = document.querySelector<HTMLElement>(".modal-wrapper")
let confirmBoxType: EConfirmBoxType = EConfirmBoxType.DANGER
let confirmRoot: Root | null = null

const _createElement = () => {
  if (!wrapper) {
    wrapper = document.createElement("div")
    wrapper.classList.add("modal-wrapper")
    document.body.appendChild(wrapper)
  }

  wrapper.classList.remove("modal-none")
  container.classList.add("modal-container")
  backdrop.classList.add("modal-backdrop")

  wrapper.appendChild(backdrop)
  wrapper.appendChild(container)

  return container
}

const Confirm: FC<ConfirmFCProps> = (props) => {
  const { title, desc, yes, no, yesLabel = "Yes", noLabel = "No" } = props

  const onYes = () => {
    if (!wrapper) {
      return
    }
    yes()
    wrapper.classList.add("modal-none")
  }

  const onNo = () => {
    if (!wrapper) {
      return
    }
    no?.()
    wrapper.classList.add("modal-none")
  }

  const variantClass =
    confirmBoxType === EConfirmBoxType.DANGER ? "confirm-modal--danger" : "confirm-modal--info"

  const renderIcon = () => {
    if (confirmBoxType === EConfirmBoxType.DANGER) {
      return <HiOutlineExclamation aria-hidden />
    }
    if (confirmBoxType === EConfirmBoxType.INFO) {
      return <HiOutlineExclamationCircle aria-hidden />
    }
    return null
  }

  return (
    <div className={`modal-box confirm-modal ${variantClass}`} role="alertdialog" aria-modal="true" aria-labelledby="confirm-modal-title" aria-describedby="confirm-modal-desc">
      <div className="confirm-modal__icon">{renderIcon()}</div>
      <h3 id="confirm-modal-title" className="confirm-modal__title">
        {title}
      </h3>
      <p id="confirm-modal-desc" className="confirm-modal__desc">
        {desc}
      </p>
      <div className="confirm-modal__actions">
        <button type="button" className="confirm-modal__btn confirm-modal__btn--secondary" onClick={onNo}>
          {noLabel}
        </button>
        <button type="submit" className="confirm-modal__btn confirm-modal__btn--primary" onClick={onYes}>
          {yesLabel}
        </button>
      </div>
    </div>
  )
}

const handleClickOutSide = (e: MouseEvent) => {
  if (!wrapper || e.target !== backdrop) {
    return
  }

  wrapper.classList.add("modal-none")
}

const closeByPressingEsc = (e: KeyboardEvent) => {
  if (e.key !== "Escape" || !wrapper) {
    return
  }

  wrapper.classList.add("modal-none")
}

const _render = (props: RenderFunc) => {
  const { container: mountNode, ...restProps } = props
  if (!confirmRoot) {
    confirmRoot = createRoot(mountNode)
  }
  confirmRoot.render(<Confirm {...restProps} />)

  document.removeEventListener("click", handleClickOutSide)
  document.addEventListener("click", handleClickOutSide)

  document.removeEventListener("keyup", closeByPressingEsc)
  document.addEventListener("keyup", closeByPressingEsc)
}

const _create = ({ title, desc, yes, no, yesLabel, noLabel }: ConfirmFCProps) => {
  const mountNode = _createElement()

  _render({
    title,
    container: mountNode,
    desc,
    yes,
    no,
    yesLabel,
    noLabel,
  })
}

export const confirmDanger = (props: ConfirmFCProps) => {
  confirmBoxType = EConfirmBoxType.DANGER
  _create(props)
}

export const confirmInfo = (props: ConfirmFCProps) => {
  confirmBoxType = EConfirmBoxType.INFO
  _create(props)
}
