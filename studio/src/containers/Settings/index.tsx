import { Fragment } from "react";
import { BiCommentError } from "react-icons/bi";
import { Menu, Transition } from "@headlessui/react";
import { Link } from "react-router-dom";
import {
  HiOutlineColorSwatch,
  HiOutlineLightningBolt,
  HiOutlineCog,
} from "react-icons/hi";
import { MdOutlinePowerSettingsNew } from "react-icons/md";
import { showShortcutModal } from "../../store/modal";
import { useThemeStore } from "../../store/themes";
import { useAuth } from "../../hooks/useAuth";
import { useProfileEmojiStore } from "../../store/profileEmojiStore";
import { ROLE_DEFAULT_EMOJI, getProfileEmoji } from "../../services/roleService";
import { isAppwriteAuthEnabled } from "../../libs/appwriteAuth";
import { useEffect } from "react";

/** Where the profile menu is anchored (affects Headless UI panel position). */
export type SettingsProfileMenuVariant =
  | "default"
  | "sidebar-expanded"
  | "sidebar-collapsed"
  | "icon-rail"

interface SettingsProps {
  profileMenuVariant?: SettingsProfileMenuVariant
}

export default function Settings({ profileMenuVariant = "default" }: SettingsProps) {
  const { setVisible: setThemeVisible } = useThemeStore()
  const { user } = useAuth()
  const profileEmoji = useProfileEmojiStore((s) => s.profileEmoji)
  const setStoreEmoji = useProfileEmojiStore((s) => s.setProfileEmoji)
  const role = user?.role ?? 'student'
  const displayEmoji = profileEmoji ?? ROLE_DEFAULT_EMOJI[role]

  useEffect(() => {
    if (!user?.uid) return
    const apply = (emoji: string | null) => setStoreEmoji(emoji)
    if (isAppwriteAuthEnabled()) {
      getProfileEmoji(user.uid).then((emoji) => {
        if (emoji) apply(emoji)
        else {
          try {
            const stored = localStorage.getItem('canis_profile_emoji')
            if (stored) apply(stored)
          } catch {}
        }
      })
    } else {
      try {
        const stored = localStorage.getItem('canis_profile_emoji')
        apply(stored || null)
      } catch {}
    }
  }, [user?.uid, setStoreEmoji])

  const isIconRail = profileMenuVariant === "icon-rail"
  const isSidebarMenu =
    profileMenuVariant === "sidebar-expanded" || profileMenuVariant === "sidebar-collapsed"
  /** Dropdown animates like bottom-anchored sidebar menus (panel slides up). */
  const isBottomAnchoredMenu = isSidebarMenu || isIconRail
  const menuRootClass =
    profileMenuVariant === "sidebar-expanded"
      ? "relative block w-full text-left"
      : profileMenuVariant === "sidebar-collapsed"
        ? "relative ml-auto w-max text-left"
        : profileMenuVariant === "icon-rail"
          ? "relative flex w-full justify-center text-left"
          : "relative inline-block text-left"
  const buttonRowClass = profileMenuVariant === "sidebar-expanded" ? "flex justify-end" : ""
  const itemsClass =
    profileMenuVariant === "default"
      ? "dropdown absolute right-0 top-full z-[160] mt-2 w-64 origin-top-right ring-1 ring-black ring-opacity-5 focus:outline-none"
      : profileMenuVariant === "sidebar-expanded"
        ? "dropdown absolute bottom-full left-0 right-0 z-[160] mb-2 w-auto origin-bottom ring-1 ring-black ring-opacity-5 focus:outline-none"
        : profileMenuVariant === "sidebar-collapsed"
          ? "dropdown absolute bottom-full right-0 z-[160] mb-2 w-64 max-w-[min(16rem,calc(100vw-1.25rem))] origin-bottom-right ring-1 ring-black ring-opacity-5 focus:outline-none"
          : "dropdown absolute left-full bottom-0 z-[160] ml-2 w-64 max-w-[min(16rem,calc(100vw-1.25rem))] max-h-[min(24rem,calc(100vh-1rem))] overflow-y-auto origin-bottom-left ring-1 ring-black ring-opacity-5 focus:outline-none"

  return (
    <Menu as="div" className={menuRootClass}>
      <div className={buttonRowClass}>
        <Menu.Button
          className={isIconRail ? "app-sidebar__rail-avatar-btn" : "avatar-btn"}
          title={user?.displayName || user?.email || "Profile & Settings"}
          aria-label="Open profile menu"
        >
          <div className={`user-avatar user-avatar-emoji${isIconRail ? " user-avatar--rail" : ""}`}>
            {displayEmoji}
          </div>
        </Menu.Button>
      </div>

      <Transition
        as={Fragment}
        enter="transition ease-out duration-150"
        enterFrom={
          isBottomAnchoredMenu
            ? "transform translate-y-2 opacity-0 scale-[0.98]"
            : "transform opacity-0 scale-95"
        }
        enterTo={
          isBottomAnchoredMenu ? "transform translate-y-0 opacity-100 scale-100" : "transform opacity-100 scale-100"
        }
        leave="transition ease-in duration-75"
        leaveFrom={
          isBottomAnchoredMenu ? "transform translate-y-0 opacity-100 scale-100" : "transform opacity-100 scale-100"
        }
        leaveTo={
          isBottomAnchoredMenu
            ? "transform translate-y-1 opacity-0 scale-[0.98]"
            : "transform opacity-0 scale-95"
        }
      >
        <Menu.Items className={itemsClass}>
          <div className="py-1">
            <Menu.Item>
              <div
                onClick={() => showShortcutModal()}
                className="dropdown-content"
              >
                <HiOutlineLightningBolt
                  className="dropdown-icon"
                  aria-hidden="true"
                />
                <span className="dropdown-text">Shortcut keys</span>
              </div>
            </Menu.Item>
            <Menu.Item>
              <a
                rel="noreferrer"
                target={"_blank"}
                href={"https://github.com/CanisWorks/canis-studio/issues"}
                className="dropdown-content"
              >
                <BiCommentError
                  className="dropdown-icon"
                  aria-hidden="true"
                />
                <span className="dropdown-text">Feedback</span>
              </a>
            </Menu.Item>
            <Menu.Item>
              <div
                onClick={() => {
                  setThemeVisible(true)
                }}
                className="dropdown-content" >
                <HiOutlineColorSwatch
                  className="dropdown-icon"
                  aria-hidden="true"
                />
                <div className="dropdown-text flex-grow flex items-center justify-between">
                  <span className="dropdown-text whitespace-nowrap">Theme color</span>
                  <div className="flex items-center gap-1">
                    <button className="kbd-btn kbd-sm">CTRL</button>
                    <button className="kbd-btn kbd-sm">T</button>
                  </div>
                </div>
              </div>
            </Menu.Item>
            <Menu.Item>
              <Link to="/setting/profile"
                className="dropdown-content">
                <HiOutlineCog
                  className="dropdown-icon"
                  aria-hidden="true"
                />
                <span className="dropdown-text">Settings</span>
              </Link>
            </Menu.Item>

            <Menu.Item>
              <Link to={"/signout"} className="dropdown-content">
                <MdOutlinePowerSettingsNew
                  className="dropdown-icon"
                  aria-hidden="true"
                />
                <span className="dropdown-text">Sign out</span>
              </Link>
            </Menu.Item>
          </div>
        </Menu.Items>
      </Transition>
    </Menu>
  );
}
