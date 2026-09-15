import { create } from 'zustand'

type Theme = 'light' | 'dark' | 'system'

interface SettingsState {
  theme: Theme
  sidebarOpen: boolean
  sidebarWidth: number
  showBookmarkBar: boolean
  privacyMode: boolean
  loaded: boolean
}

interface SettingsActions {
  toggleSidebar: () => void
  setSidebarWidth: (width: number) => void
  setTheme: (theme: Theme) => void
  toggleBookmarkBar: () => void
  togglePrivacyMode: () => void
  updateSettings: (key: string, value: unknown) => Promise<void>
  loadSettings: () => Promise<void>
}

export type SettingsStore = SettingsState & SettingsActions

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  theme: 'system',
  sidebarOpen: true,
  sidebarWidth: 380,
  showBookmarkBar: true,
  privacyMode: false,
  loaded: false,

  toggleSidebar: () => {
    set((state) => ({ sidebarOpen: !state.sidebarOpen }))
  },

  setSidebarWidth: (width: number) => {
    set({ sidebarWidth: width })
    window.api.settingsSet?.('appearance.sidebarWidth', width).catch(() => {})
  },

  setTheme: (theme: Theme) => {
    set({ theme })
    // Persist under the same nested key the settings page uses
    window.api.settingsSet?.('appearance.theme', theme).catch(() => {
      // settingsSet may not exist; ignore
    })
  },

  toggleBookmarkBar: () => {
    const next = !get().showBookmarkBar
    set({ showBookmarkBar: next })
    window.api.settingsSet?.('appearance.showBookmarkBar', next).catch(() => {})
  },

  togglePrivacyMode: () => {
    // Main process owns the state (privacy mode forces local-only AI routing)
    window.api
      .privacyModeToggle()
      .then((enabled: boolean) => set({ privacyMode: enabled }))
      .catch(() => {})
  },

  updateSettings: async (key: string, value: unknown) => {
    // Optimistically update local state
    set((state) => {
      const updates: Partial<SettingsState> = {}
      if (key in state) {
        ;(updates as Record<string, unknown>)[key] = value
      }
      return updates
    })

    try {
      await window.api.settingsSet?.(key, value)
    } catch (error) {
      console.error(`Failed to persist setting "${key}":`, error)
    }
  },

  loadSettings: async () => {
    try {
      const settings = (await window.api.settingsGet?.()) as Record<string, unknown> | undefined
      const appearance = (settings?.appearance as Record<string, unknown> | undefined) ?? {}
      set({
        theme: (appearance.theme as Theme) ?? 'system',
        sidebarWidth: (appearance.sidebarWidth as number) ?? 380,
        showBookmarkBar: (appearance.showBookmarkBar as boolean) ?? true,
        loaded: true,
      })
    } catch (error) {
      console.error('Failed to load settings:', error)
      set({ loaded: true })
    }
  },
}))

// Auto-load settings when the store module is first imported
useSettingsStore.getState().loadSettings()
