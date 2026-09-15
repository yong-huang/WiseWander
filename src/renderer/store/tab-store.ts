import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { Tab } from '@shared/types'
import { MAX_RECENTLY_CLOSED } from '../../shared/constants'

interface TabState {
  tabs: Tab[]
  activeTabId: string | null
  recentlyClosed: Tab[]
}

interface TabActions {
  createTab: (url?: string) => Promise<void>
  closeTab: (id: string) => Promise<void>
  activateTab: (id: string) => Promise<void>
  restoreTab: (tab: Tab) => Promise<void>
  reorderTabs: (tabIds: string[]) => void
  updateTab: (id: string, updates: Partial<Tab>) => void
  setTabs: (tabs: Tab[]) => void
}

export type TabStore = TabState & TabActions

export const useTabStore = create<TabStore>()(
  persist(
    (set, get) => ({
      tabs: [],
      activeTabId: null,
      recentlyClosed: [],

      createTab: async (url?: string) => {
        const tab = await window.api.tabCreate(url)
        if (tab) {
          set((state) => ({
            tabs: [...state.tabs, tab as Tab],
            activeTabId: (tab as Tab).id,
          }))
        }
      },

      closeTab: async (id: string) => {
        const { tabs, activeTabId } = get()
        const tabIndex = tabs.findIndex((t) => t.id === id)
        if (tabIndex === -1) return

        const closedTab = tabs[tabIndex]

        await window.api.tabClose(id)

        const remaining = tabs.filter((t) => t.id !== id)
        const updatedRecentlyClosed = [closedTab, ...get().recentlyClosed].slice(0, MAX_RECENTLY_CLOSED)

        let newActiveId = activeTabId
        if (activeTabId === id) {
          if (remaining.length > 0) {
            const fallbackIndex = tabIndex < remaining.length ? tabIndex : remaining.length - 1
            newActiveId = remaining[fallbackIndex].id
          } else {
            newActiveId = null
          }
        }

        set({
          tabs: remaining,
          activeTabId: newActiveId,
          recentlyClosed: updatedRecentlyClosed,
        })
      },

      activateTab: async (id: string) => {
        const { tabs } = get()
        const tab = tabs.find((t) => t.id === id)
        if (!tab) return

        await window.api.tabActivate(id)

        set({
          activeTabId: id,
          tabs: tabs.map((t) =>
            t.id === id ? { ...t, lastAccessed: Date.now() } : t
          ),
        })
      },

      restoreTab: async (tab: Tab) => {
        const newTab = await window.api.tabCreate(tab.url)
        if (newTab) {
          set((state) => ({
            tabs: [...state.tabs, newTab as Tab],
            activeTabId: (newTab as Tab).id,
            recentlyClosed: state.recentlyClosed.filter((t) => t.id !== tab.id),
          }))
        }
      },

      reorderTabs: (tabIds: string[]) => {
        const { tabs } = get()
        const reordered = tabIds
          .map((id) => tabs.find((t) => t.id === id))
          .filter((t): t is Tab => t !== undefined)

        const unlisted = tabs.filter((t) => !tabIds.includes(t.id))

        set({ tabs: [...reordered, ...unlisted] })
      },

      updateTab: (id: string, updates: Partial<Tab>) => {
        set((state) => ({
          tabs: state.tabs.map((t) => (t.id === id ? { ...t, ...updates } : t)),
        }))
      },

      setTabs: (tabs: Tab[]) => {
        set({ tabs })
      },
    }),
    {
      name: 'wisewander-tabs',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        tabs: state.tabs.map((t) => ({ id: t.id, url: t.url, title: t.title, favicon: t.favicon })),
        activeTabId: state.activeTabId,
      }),
    }
  )
)
