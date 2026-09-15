import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export interface ConsoleEntry {
  id: string
  level: 'log' | 'warn' | 'error' | 'info'
  text: string
  source?: string
  line?: number
  timestamp: number
  isInput?: boolean
}

export interface NetworkEntry {
  id: string
  url: string
  name: string
  method: string
  status: number
  mimeType: string
  initiatorType: string
  startTime: number
  duration: number
  size: number
}

export interface DOMNode {
  type: 'element' | 'text'
  tag?: string
  attrs?: Record<string, string>
  children?: DOMNode[]
  content?: string
}

export interface StorageData {
  cookies: { key: string; value: string }[]
  local: { key: string; value: string }[]
  session: { key: string; value: string }[]
}

export interface AIDebugEntry {
  id: string
  type: 'request' | 'response' | 'error' | 'info'
  action: string // 'chat' | 'summarize' | 'translate'
  model: string
  content: string
  duration?: number
  timestamp: number
}

type Tab = 'console' | 'network' | 'elements' | 'storage' | 'ai'

interface DevToolsState {
  isOpen: boolean
  activeTab: Tab
  height: number

  consoleData: Map<string, ConsoleEntry[]>
  networkData: Map<string, NetworkEntry[]>
  elementsData: Map<string, DOMNode | null>
  storageData: Map<string, StorageData>
  aiDebugData: AIDebugEntry[]

  consoleFilter: string
  networkFilter: string

  toggle: () => void
  setOpen: (open: boolean) => void
  setActiveTab: (tab: Tab) => void
  setHeight: (h: number) => void

  addConsoleEntry: (tabId: string, entry: ConsoleEntry) => void
  clearConsole: (tabId: string) => void
  setConsoleFilter: (f: string) => void

  addNetworkEntry: (tabId: string, entry: NetworkEntry) => void
  setNetworkEntries: (tabId: string, entries: NetworkEntry[]) => void
  clearNetwork: (tabId: string) => void
  setNetworkFilter: (f: string) => void

  setElements: (tabId: string, tree: DOMNode | null) => void
  setStorage: (tabId: string, data: StorageData) => void

  addAIDebugEntry: (entry: AIDebugEntry) => void
  clearAIDebug: () => void
}

export const useDevToolsStore = create<DevToolsState>()(
  persist(
    (set) => ({
      isOpen: false,
      activeTab: 'console',
      height: 300,
      consoleData: new Map(),
      networkData: new Map(),
      elementsData: new Map(),
      storageData: new Map(),
      aiDebugData: [],
      consoleFilter: 'all',
      networkFilter: 'all',

      toggle: () => set((s) => ({ isOpen: !s.isOpen })),
      setOpen: (open) => set({ isOpen: open }),
      setActiveTab: (activeTab) => set({ activeTab }),
      setHeight: (h) => set({ height: Math.max(150, Math.min(600, h)) }),

      addConsoleEntry: (tabId, entry) =>
        set((s) => {
          const m = new Map(s.consoleData)
          const list = [...(m.get(tabId) ?? []), entry]
          if (list.length > 1000) list.splice(0, list.length - 1000)
          m.set(tabId, list)
          return { consoleData: m }
        }),

      clearConsole: (tabId) =>
        set((s) => {
          const m = new Map(s.consoleData)
          m.set(tabId, [])
          return { consoleData: m }
        }),

      setConsoleFilter: (f) => set({ consoleFilter: f }),

      addNetworkEntry: (tabId, entry) =>
        set((s) => {
          const m = new Map(s.networkData)
          const list = [...(m.get(tabId) ?? []), entry]
          if (list.length > 500) list.splice(0, list.length - 500)
          m.set(tabId, list)
          return { networkData: m }
        }),

      setNetworkEntries: (tabId, entries) =>
        set((s) => {
          const m = new Map(s.networkData)
          m.set(tabId, entries)
          return { networkData: m }
        }),

      clearNetwork: (tabId) =>
        set((s) => {
          const m = new Map(s.networkData)
          m.set(tabId, [])
          return { networkData: m }
        }),

      setNetworkFilter: (f) => set({ networkFilter: f }),

      setElements: (tabId, tree) =>
        set((s) => {
          const m = new Map(s.elementsData)
          m.set(tabId, tree ?? null)
          return { elementsData: m }
        }),

      setStorage: (tabId, data) =>
        set((s) => {
          const m = new Map(s.storageData)
          m.set(tabId, data)
          return { storageData: m }
        }),

      addAIDebugEntry: (entry) =>
        set((s) => {
          const list = [...s.aiDebugData, entry]
          if (list.length > 200) list.splice(0, list.length - 200)
          return { aiDebugData: list }
        }),

      clearAIDebug: () => set({ aiDebugData: [] }),
    }),
    {
      name: 'wisewander-devtools',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        isOpen: state.isOpen,
        activeTab: state.activeTab,
        height: state.height,
      }),
    }
  )
)
