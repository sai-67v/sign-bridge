import { useNavigate } from "react-router-dom"
import { HiOutlineCog, HiOutlineColorSwatch, HiOutlineLightningBolt, HiOutlineUser } from "react-icons/hi"
import { useOverlayStore } from "../../store/overlayStore"

/**
 * Lightweight settings entry surface inside the overlay panel.
 * Deep settings still render at /setting/* via App.tsx; this is a hub.
 */
export default function SettingsOverlayBody() {
  const navigate = useNavigate()
  const close = useOverlayStore((s) => s.close)

  const go = (path: string) => {
    close()
    navigate(path)
  }

  const items: { label: string; sub: string; path: string; Icon: typeof HiOutlineCog }[] = [
    { label: "Profile", sub: "Display name and avatar", path: "/setting/profile", Icon: HiOutlineUser },
    { label: "Theme", sub: "Light / dark and accent", path: "/setting/theme", Icon: HiOutlineColorSwatch },
    { label: "Shortcuts", sub: "Command palette", path: "/setting/command-palletes", Icon: HiOutlineLightningBolt },
    { label: "Privacy", sub: "Encryption & sharing", path: "/setting/privacy", Icon: HiOutlineCog },
  ]

  return (
    <div className="settings-overlay-grid">
      {items.map(({ label, sub, path, Icon }) => (
        <button
          key={path}
          type="button"
          className="settings-overlay-tile"
          onClick={() => go(path)}
        >
          <Icon className="h-5 w-5" aria-hidden />
          <span className="settings-overlay-tile__label">{label}</span>
          <span className="settings-overlay-tile__sub">{sub}</span>
        </button>
      ))}
    </div>
  )
}
