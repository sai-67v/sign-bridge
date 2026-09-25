import { create } from "zustand"
import { persist } from "zustand/middleware"

/** Most-recent pads shown in the sidebar (replaces unlimited “open tabs”). */
const RECENT_PADS_MAX = 5

interface IActiveTabsStore {
  /** Pad IDs, most recently used first (max length {@link RECENT_PADS_MAX}). */
  openTabs: string[]
  activeTab: string | null

  openTab: (id: string) => void
  closeTab: (id: string) => void
  setActiveTab: (id: string) => void
  isTabOpen: (id: string) => boolean
  /** Clears persisted recent pads (e.g. after deleting all library pages). */
  clearAllTabs: () => void
}

export const useActiveTabsStore = create<IActiveTabsStore>()(
  persist(
    (set, get) => ({
      openTabs: [],
      activeTab: null,

      openTab: (id: string) => {
        set((state) => {
          const without = state.openTabs.filter((t) => t !== id)
          const openTabs = [id, ...without].slice(0, RECENT_PADS_MAX)
          return { openTabs, activeTab: id }
        })
      },

      closeTab: (id: string) => {
        const { openTabs, activeTab } = get()
        const newTabs = openTabs.filter((tabId) => tabId !== id)
        let newActiveTab = activeTab

        if (activeTab === id) {
          const closedIndex = openTabs.indexOf(id)
          if (newTabs.length > 0) {
            newActiveTab = newTabs[Math.min(closedIndex, newTabs.length - 1)]
          } else {
            newActiveTab = null
          }
        }

        set({ openTabs: newTabs, activeTab: newActiveTab })
      },

      setActiveTab: (id: string) => {
        set((state) => {
          if (!state.openTabs.includes(id)) {
            return { activeTab: id }
          }
          const without = state.openTabs.filter((t) => t !== id)
          const openTabs = [id, ...without].slice(0, RECENT_PADS_MAX)
          return { openTabs, activeTab: id }
        })
      },

      isTabOpen: (id: string) => {
        return get().openTabs.includes(id)
      },

      clearAllTabs: () => set({ openTabs: [], activeTab: null }),
    }),
    {
      name: "canis-active-tabs",
      version: 2,
      merge: (persisted, currentState) => {
        const p = persisted as { openTabs?: string[]; activeTab?: string | null }
        const tabs = p.openTabs ?? []
        return {
          ...currentState,
          openTabs: tabs.slice(0, RECENT_PADS_MAX),
          activeTab: p.activeTab ?? null,
        }
      },
    }
  )
)
