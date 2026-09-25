import { doc, getDoc, setDoc } from "../libs/firebase"
import { db } from "../libs/firebase"
import { setCache, getCache } from "../libs/localCache"
import { IThemeInstall } from "./themes"
import { getCurrentUser, DEMO_MODE } from "../libs/demo-helpers"

export enum EUserStatus {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
}

export interface IUserThemeSettings {
  id: string
  name: string
  config: string
  active: boolean
  themeId: string
}

export interface IUserSettings {
  themes?: IUserThemeSettings[]
}

const COLLECTION_NAME = "user-settings"
const DEFAULT_THEME = `--common-text-color:  rgb(23 23 23);--common-semidark-text-color:  rgb(64 64 64);--common-dark-text-color:  rgb(115 115 115);--common-text-hover-color:  rgb(10 10 10);--common-bg-color:  rgb(252 252 250);--common-dark-bg-color:  rgb(244 244 242);--common-darker-bg-color:  rgb(235 235 232);--common-light-bg-color:  rgb(250 250 248);--common-border-hl-color:  rgb(38 38 38);--common-border-light-color:  rgb(214 214 212);--common-btn-bg-color:  rgb(255 255 255);--common-btn-bg-hover-color:  rgb(237 237 235);--common-btn-bg-active-color:  rgb(220 220 218);--common-primary-color:  rgb(38 38 38);--common-primary-hover-color:  rgb(64 64 64);--common-primary-text-color:  rgb(252 252 250);--common-border-color:  rgb(201 201 198);--sidebar-background-color:  rgb(248 248 246);--sidebar-text-color:  rgb(82 82 82);--sidebar-text-color-hover:  rgb(23 23 23);--sidebar-title-color:  rgb(38 38 38);--sidebar-user-setting-border-color:  rgb(225 225 222);--sidebar2-background-color:  rgb(252 252 250);--sidebar2-item-active-color:  rgb(23 23 23);--sidebar2-item-hover-color:  rgb(79 79 79);--editor-text-color:  rgb(23 23 23);--editor-link-text-color:  rgb(55 65 81);--editor-quote-text-color:  rgb(64 64 64);--modal-bg-color:  rgb(252 252 250);--modal-footer-bg-color:  rgb(252 252 250);--modal-border-color:  rgb(214 214 212);--setting-bg-color:  rgb(244 244 242);--sign-bg-color:  rgb(244 244 242);--sign-form-bg-color:  rgb(255 255 255);--dropdown-bg-color:  rgb(255 255 255);--dropdown-bg-hover-color:  rgb(237 237 235);--tag-bg-color:  rgb(237 237 235);--tag-text-color:  rgb(82 82 82);--button-border-active-color:  rgb(38 38 38);--button-text-active-color:  rgb(252 252 250);--desk-background-color:  rgb(232 232 230)`

export const installTheme = async (theme: IThemeInstall): Promise<number> => {
  if (DEMO_MODE) return 1; // Skip in demo mode

  const user = getCurrentUser()
  if (!user?.uid) {
    return 0
  }

  const { id: themeId, themes: themeList } = theme
  const uid = user.uid
  const docRef = doc(db, COLLECTION_NAME, uid)
  const userSetting = await getDoc(docRef)
  let settings: IUserSettings = { themes: [] }

  if (userSetting.exists()) {
    const data = userSetting.data()
    if (data) settings = data as IUserSettings
  }

  themeList.forEach((t) => {
    settings.themes?.push({
      id: t.id,
      name: t.name,
      config: t.config,
      active: false,
      themeId: themeId || "",
    })
  })

  await setDoc(docRef, settings)
  return 1
}

export const getThemeSettingElem = () => {
  return document.querySelector("#css-variable")
}

export const uninstallTheme = async (themeId: string): Promise<number> => {
  if (DEMO_MODE) return 1; // Skip in demo mode

  const user = getCurrentUser()
  if (!user?.uid) {
    return 0
  }

  const uid = user.uid
  const docRef = doc(db, COLLECTION_NAME, uid)
  const userSetting = await getDoc(docRef)
  let settings: IUserSettings = { themes: [] }

  if (userSetting.exists()) {
    const data = userSetting.data()
    if (data) settings = data as IUserSettings
  }

  if (settings.themes) {
    settings.themes = settings.themes.filter((t) => t && t.themeId !== themeId)
  }

  await setDoc(docRef, settings)

  return 1
}

export const selectTheme = async (id: string): Promise<number> => {
  if (DEMO_MODE) return 1; // Skip in demo mode

  const user = getCurrentUser()
  if (!user?.uid) {
    return 0
  }

  const uid = user.uid
  const docRef = doc(db, COLLECTION_NAME, uid)
  const userSetting = await getDoc(docRef)
  let settings: IUserSettings = { themes: [] }

  if (userSetting.exists()) {
    const data = userSetting.data()
    if (data) settings = data as IUserSettings
  }

  if (settings.themes) {
    settings.themes = settings.themes.map((t) => {
      t.active = t.id === id
      return t
    })
  }

  await setDoc(docRef, settings)
  return 1
}

export const customThemeById = async (
  id: string,
  title: string,
  config: string
): Promise<number> => {
  if (DEMO_MODE) return 1; // Skip in demo mode

  const user = getCurrentUser()
  if (!user?.uid) {
    return 0
  }

  const uid = user.uid
  const docRef = doc(db, COLLECTION_NAME, uid)
  const userSetting = await getDoc(docRef)
  let settings: IUserSettings = { themes: [] }

  if (userSetting.exists()) {
    const data = userSetting.data()
    if (data) settings = data as IUserSettings
  }

  if (settings.themes) {
    settings.themes = settings.themes.map((t) => {
      if (t.id === id) {
        t.name = title
        t.config = config
      }
      return t
    })
  }

  await setDoc(docRef, settings)
  return 1
}

export const getUserSetting = async (): Promise<IUserSettings> => {
  if (DEMO_MODE) return {}; // Return empty in demo mode

  const user = getCurrentUser()
  if (!user?.uid) return {}
  const uid = user.uid
  const ref = doc(db, COLLECTION_NAME, uid)
  const settingRef = await getDoc(ref)

  if (!settingRef.exists()) {
    return {}
  }

  const data = settingRef.data()
  return data ? (data as IUserSettings) : {}
}

export const getThemeConfigFromStorage = (): string => {
  return getCache("THEME") || DEFAULT_THEME
}

export const updateThemeConfigFromUserSetting = async () => {
  try {
    const setting = await getUserSetting()
    if (!setting.themes) return {}

    const themeElem = getThemeSettingElem()
    const activeTheme = setting.themes.find((t) => t.active === true)
    const config = activeTheme && activeTheme.config ? activeTheme.config : "{}"

    setThemeConfigToStorage(config)
    if (themeElem) {
      try {
        const cssVars = JSON.parse(config) as Record<string, string>
        const colorScheme = cssVars["--color-scheme"] || "light"
        themeElem.textContent = `:root { ${getCache("THEME")}; color-scheme: ${colorScheme} }`
      } catch {
        themeElem.textContent = `:root { ${getCache("THEME")}; color-scheme: light }`
      }
    }

    return JSON.parse(config)
  } catch (error) {
    console.log("getThemeconfig Error", error)
    return {}
  }
}

export const cvtThemeConfigToCssVars = (config: string) => {
  try {
    const cssVars = JSON.parse(config)
    const css = []
    for (let variable in cssVars) {
      css.push(`${variable}: ${cssVars[variable]}`)
    }

    return css.join(";")
  } catch (error) {
    console.log("setThemeSetting Error", error)
    return ""
  }
}

export const setThemeConfigToStorage = (value: string) => {
  setCache("THEME", cvtThemeConfigToCssVars(value))
}
