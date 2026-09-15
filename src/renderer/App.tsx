import { useEffect, useState, useCallback, useRef } from 'react'
import { useTabStore } from './store/tab-store'
import { useAIStore } from './store/ai-store'
import { useAgentStore } from './store/agent-store'
import { useSettingsStore } from './store/settings-store'
import { useCapabilityStore } from './store/capability-store'
import { buildTabChatSystemPrompt } from './utils/browser-tools'
import { useTheme } from './hooks/useTheme'
import { useRecommendationStore } from './store/recommendation-store'
import { TabBar } from './components/browser/TabBar'
import { AddressBar } from './components/browser/AddressBar'
import { BrowserView, extractPageContext, extractTabNamingContext } from './components/browser/BrowserView'
import { BookmarkBar } from './components/browser/BookmarkBar'
import { DownloadBar } from './components/browser/DownloadBar'
import { AISidebar } from './components/ai/AISidebar'
import { NewTabPage } from './components/recommendation/NewTabPage'
import { CommandPalette } from './components/common/CommandPalette'
import { SettingsPage } from './components/settings/SettingsPage'
import { DevToolsPanel } from './components/devtools/DevToolsPanel'
import { useDevToolsStore } from './store/devtools-store'
import { NEW_TAB_URL } from '../shared/constants'

// Helper to log AI debug entries
function logAIDebug(type: 'request' | 'response' | 'error' | 'info', action: string, model: string, content: string, duration?: number): void {
  useDevToolsStore.getState().addAIDebugEntry({
    id: `ai-${type}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type,
    action,
    model,
    content,
    duration,
    timestamp: Date.now(),
  })
}

type SidebarTab = 'assistant' | 'chat' | 'summary' | 'agent' | 'research' | 'recommend' | 'tools' | 'reading'

export default function App(): React.ReactElement {
  const { tabs, activeTabId, createTab, closeTab, updateTab } = useTabStore()
  const { setupStreamListener, ollamaStatus, setOllamaStatus, providerStatuses } = useAIStore()
  const { setupStepListener } = useAgentStore()
  const { setupCrawlProgressListener } = useCapabilityStore()
  const { setupStreamListener: setupRecommendationStream } = useRecommendationStore()
  const { sidebarOpen, toggleSidebar, showBookmarkBar } = useSettingsStore()
  const { isOpen: devToolsOpen, toggle: toggleDevTools } = useDevToolsStore()

  // Apply theme (light / dark / system) to <html> element
  useTheme()

  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [downloadBarOpen, setDownloadBarOpen] = useState(false)
  const [activeSidebarTab, setActiveSidebarTab] = useState<SidebarTab>('chat')

  const smartTabTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? null

  // Initialize listeners (runs once)
  useEffect(() => {
    const cleanupStream = setupStreamListener()
    const cleanupStep = setupStepListener()
    const cleanupCrawl = setupCrawlProgressListener()
    const cleanupRec = setupRecommendationStream()
    const cleanupContextMenu = window.api.onContextMenuAction((data: unknown) => {
      const action = data as { type: string; url?: string; text?: string; title?: string }
      const { sidebarOpen: so, toggleSidebar: ts } = useSettingsStore.getState()
      const { activeTabId: aid, createTab: ct } = useTabStore.getState()
      switch (action.type) {
        case 'open-link-new-tab':
          if (action.url) ct(action.url)
          break
        case 'search-selection':
          if (action.text) ct(`https://www.google.com/search?q=${encodeURIComponent(action.text)}`)
          break
        case 'ai-summarize-selection': {
          if (action.text) {
            if (!so) ts()
            setActiveSidebarTab('summary')
            setTimeout(() => {
              sendAIWithPageContext(aid ?? '', `Summarize this: ${action.text}`)
            }, 100)
          }
          break
        }
        case 'ai-translate-selection': {
          if (action.text) {
            if (!so) ts()
            useAIStore.getState().setPendingTranslate(action.text)
            setActiveSidebarTab('tools')
          }
          break
        }
        case 'bookmark-page':
          if (action.title && action.url) {
            window.api.bookmarkAdd(action.title, action.url)
            window.dispatchEvent(new CustomEvent('bookmark-changed'))
          }
          break
      }
    })
    const cleanupOpenSettings = window.api.onOpenSettings(() => setSettingsOpen(true))
    checkOllama()
    return () => {
      cleanupStream()
      cleanupStep()
      cleanupCrawl()
      cleanupRec()
      cleanupContextMenu()
      cleanupOpenSettings()
      smartTabTimersRef.current.forEach((timer) => clearTimeout(timer))
      smartTabTimersRef.current.clear()
    }
  }, [])

  // Create initial tab only once after persist rehydrates
  const initializedRef = useRef(false)
  useEffect(() => {
    if (initializedRef.current) return
    if (tabs.length > 0) {
      // Tabs restored from session — just mark as initialized
      initializedRef.current = true
      return
    }
    initializedRef.current = true
    window.api.settingsGet().then((raw: Record<string, unknown>) => {
      const browser = raw?.browser as Record<string, unknown> | undefined
      const homePage = (browser?.homePage as string) ?? 'https://www.google.com'
      createTab(homePage)
    }).catch(() => {
      createTab('https://www.google.com')
    })
  }, [tabs])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCommandPaletteOpen(true)
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'S' || e.key === 's')) {
        e.preventDefault()
        toggleSidebar()
      }
      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault()
        setSettingsOpen(true)
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'w') {
        e.preventDefault()
        if (activeTabId) closeTab(activeTabId)
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 't') {
        e.preventDefault()
        createTab()
      }
      // Cmd+Shift+T: Restore tab
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'T' || e.key === 't')) {
        e.preventDefault()
        const { recentlyClosed, restoreTab } = useTabStore.getState()
        if (recentlyClosed.length > 0) {
          restoreTab(recentlyClosed[0])
        }
      }
      // Cmd+D: Bookmark (toggle)
      if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
        e.preventDefault()
        if (activeTab) {
          window.api.bookmarkAdd(activeTab.title, activeTab.url)
          window.dispatchEvent(new CustomEvent('bookmark-changed'))
        }
      }
      // F12 or Cmd+Option+I: Toggle DevTools
      if (e.key === 'F12' || ((e.metaKey || e.ctrlKey) && e.altKey && e.key === 'I')) {
        e.preventDefault()
        toggleDevTools()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeTabId, closeTab, createTab, toggleSidebar, activeTab])

  // Reload from main-process menu (works even when webview has focus)
  useEffect(() => {
    const unsubscribe = window.api.onReloadActiveTab((ignoreCache: boolean) => {
      const el = document.querySelector(`webview[data-tab-id="${activeTabId}"]`) as Electron.WebviewTag | null
      if (ignoreCache) {
        el?.reloadIgnoringCache()
      } else {
        el?.reload()
      }
    })
    return unsubscribe
  }, [activeTabId])

  const checkOllama = async (): Promise<void> => {
    try {
      setOllamaStatus('checking')
      const status = await window.api.ollamaStatus()
      setOllamaStatus(status.status === 'ok' ? 'online' : 'offline')
    } catch {
      setOllamaStatus('offline')
    }
  }

  const handleNavigate = useCallback(
    (url: string) => {
      if (activeTabId) {
        updateTab(activeTabId, { url, status: 'loading' })
      }
    },
    [activeTabId, updateTab]
  )

  // Per-tab callbacks — receive tabId so updates go to the correct tab
  const handleTitleUpdate = useCallback(
    (tabId: string, title: string) => {
      updateTab(tabId, { title })
    },
    [updateTab]
  )

  const handleUrlUpdate = useCallback(
    (tabId: string, url: string) => {
      updateTab(tabId, { url, status: 'loaded' })
      // Record in history
      const tab = useTabStore.getState().tabs.find((t) => t.id === tabId)
      if (tab) {
        window.api.historyAdd(url, tab.title)
      }
    },
    [updateTab]
  )

  const handleFaviconUpdate = useCallback(
    (tabId: string, favicon: string) => {
      updateTab(tabId, { favicon })
    },
    [updateTab]
  )

  const handleLoadStateChange = useCallback(
    (tabId: string, loading: boolean) => {
      updateTab(tabId, { status: loading ? 'loading' : 'loaded' })
    },
    [updateTab]
  )

  /**
   * Wrapper around ai-store sendMessage that extracts page context
   * from the active webview before sending.
   */
  const sendAIWithPageContext = useCallback(
    async (tabId: string, message: string) => {
      // Extract page context with a timeout to avoid blocking on unresponsive webviews
      let pageContext: string | undefined
      try {
        pageContext = await Promise.race([
          extractPageContext(tabId) as Promise<string | null>,
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
        ]) ?? undefined
      } catch {
        pageContext = undefined
      }

      const { isStreaming } = useAIStore.getState()
      if (isStreaming) return

      // Add user message to conversation locally
      const { conversations } = useAIStore.getState()
      const conversation = conversations.get(tabId)
      const updatedMessages = [
        ...(conversation?.messages ?? []),
        { role: 'user' as const, content: message },
        { role: 'assistant' as const, content: '' },
      ]

      useAIStore.setState((state) => {
        const newConvos = new Map(state.conversations)
        newConvos.set(tabId, {
          id: tabId,
          tabUrl: '',
          model: state.currentModel,
          messages: updatedMessages,
          createdAt: conversation?.createdAt ?? Date.now(),
        })
        return { conversations: newConvos, isStreaming: true }
      })

      // Wrap message with tab-chat system prompt (includes page context) and use assistant template
      const systemPrompt = buildTabChatSystemPrompt(pageContext ?? undefined)
      const wrappedMessage = `<system>${systemPrompt}</system>\n\n${message}`

      try {
        logAIDebug('request', 'chat', useAIStore.getState().currentModel || 'default', message.slice(0, 200))
        await window.api.aiChatSend(tabId, wrappedMessage, undefined, 'assistant')
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error)
        logAIDebug('error', 'chat', '', errMsg)
        console.error('Failed to send AI message:', error)
        useAIStore.setState({ isStreaming: false })
      }
    },
    []
  )

  const summarizeWithPageContext = useCallback(
    async (tabId: string, length?: string) => {
      const startTime = Date.now()
      const model = useAIStore.getState().currentModel || 'default'
      try {
        logAIDebug('request', 'summarize', model, `length=${length ?? 'standard'}`)
        const pageContext = await extractPageContext(tabId)
        const result = await window.api.aiSummarize(tabId, pageContext ?? undefined, length)
        logAIDebug('response', 'summarize', model, (result as { text: string }).text.slice(0, 200), Date.now() - startTime)
        return result as { text: string }
      } catch (error) {
        logAIDebug('error', 'summarize', model, error instanceof Error ? error.message : String(error), Date.now() - startTime)
        throw error
      }
    },
    []
  )

  const translateWithContext = useCallback(
    async (text: string, targetLang: string) => {
      const startTime = Date.now()
      const model = useAIStore.getState().currentModel || 'default'
      try {
        logAIDebug('request', 'translate', model, `→ ${targetLang}: ${text.slice(0, 100)}`)
        const result = await window.api.aiTranslate(text, targetLang)
        logAIDebug('response', 'translate', model, (result as { text: string }).text.slice(0, 200), Date.now() - startTime)
        return result
      } catch (error) {
        logAIDebug('error', 'translate', model, error instanceof Error ? error.message : String(error), Date.now() - startTime)
        throw error
      }
    },
    []
  )

  const handleSmartTabNaming = useCallback(
    (tabId: string, url: string) => {
      const isInternal = url.startsWith('about:') || url.startsWith('chrome://') || url.startsWith('wisewander://')
      if (isInternal) return

      if (ollamaStatus !== 'online') return

      window.api.settingsGet().then((raw: Record<string, unknown>) => {
        const browser = raw?.browser as Record<string, unknown> | undefined
        if (!browser?.smartTabNaming) return

        const currentTab = useTabStore.getState().tabs.find((t) => t.id === tabId)
        if (!currentTab || currentTab.title.length < 50) return

        const existing = smartTabTimersRef.current.get(tabId)
        if (existing) clearTimeout(existing)

        const timer = setTimeout(async () => {
          smartTabTimersRef.current.delete(tabId)
          try {
            const ctx = await extractTabNamingContext(tabId)
            if (!ctx) return

            const result = await window.api.aiSmartTabName(ctx.title, ctx.content, ctx.url) as { title: string | null }
            if (!result.title) return

            const tab = useTabStore.getState().tabs.find((t) => t.id === tabId)
            if (!tab || tab.url !== url) return

            updateTab(tabId, { title: result.title })
          } catch {
            // Silently fall back to original title
          }
        }, 2000)

        smartTabTimersRef.current.set(tabId, timer)
      }).catch(() => {})
    },
    [ollamaStatus, updateTab]
  )

  // Command palette commands
  const commands = [
    { id: 'new-tab', label: 'New Tab', category: 'Browser', action: () => createTab() },
    { id: 'close-tab', label: 'Close Tab', category: 'Browser', action: () => activeTabId && closeTab(activeTabId) },
    { id: 'toggle-sidebar', label: 'Toggle AI Sidebar', category: 'View', action: toggleSidebar },
    { id: 'sidebar-assistant', label: 'Browser AI', category: 'AI', action: () => { if (!sidebarOpen) toggleSidebar(); setActiveSidebarTab('assistant') } },
    { id: 'sidebar-chat', label: 'Page AI', category: 'AI', action: () => { if (!sidebarOpen) toggleSidebar(); setActiveSidebarTab('chat') } },
    { id: 'sidebar-summary', label: 'Summarize Page', category: 'AI', action: () => { if (!sidebarOpen) toggleSidebar(); setActiveSidebarTab('summary') } },
    { id: 'sidebar-translate', label: 'Translate', category: 'AI', action: () => { if (!sidebarOpen) toggleSidebar(); setActiveSidebarTab('tools') } },
    { id: 'sidebar-agent', label: 'AI Automation', category: 'Agent', action: () => { if (!sidebarOpen) toggleSidebar(); setActiveSidebarTab('agent') } },
    { id: 'sidebar-research', label: 'Research Assistant', category: 'Research', action: () => { if (!sidebarOpen) toggleSidebar(); setActiveSidebarTab('research') } },
    { id: 'sidebar-recommend', label: 'For You', category: 'Recommend', action: () => { if (!sidebarOpen) toggleSidebar(); setActiveSidebarTab('recommend') } },
    { id: 'sidebar-tools', label: 'Tools', category: 'Tools', action: () => { if (!sidebarOpen) toggleSidebar(); setActiveSidebarTab('tools') } },
    { id: 'settings', label: 'Settings', category: 'App', action: () => setSettingsOpen(true) },
    { id: 'devtools', label: 'Developer Tools', category: 'App', action: toggleDevTools },
    { id: 'downloads', label: 'Downloads', category: 'Browser', action: () => setDownloadBarOpen(true) },
  ]

  return (
    <div className="flex h-screen flex-col bg-white dark:bg-gray-900">
      <TabBar />
      <AddressBar onNavigate={handleNavigate} url={activeTab?.url ?? ''} onOpenSettings={() => setSettingsOpen(true)} />
      <BookmarkBar onNavigate={handleNavigate} visible={showBookmarkBar} />

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Browser Views — one webview per tab, hidden/shown */}
          <div className="relative flex-1 bg-white dark:bg-gray-950">
            {tabs.map((tab) =>
              tab.url === NEW_TAB_URL ? (
                <NewTabPage
                  key={tab.id}
                  tabId={tab.id}
                  isActive={tab.id === activeTabId}
                  onNavigate={handleNavigate}
                />
              ) : (
              <BrowserView
                key={tab.id}
                tabId={tab.id}
                url={tab.url}
                isActive={tab.id === activeTabId}
                onTitleUpdate={handleTitleUpdate}
                onUrlUpdate={handleUrlUpdate}
                onFaviconUpdate={handleFaviconUpdate}
                onLoadStateChange={handleLoadStateChange}
                onPageLoaded={handleSmartTabNaming}
              />
              )
            )}

            {tabs.length === 0 && (
              <div className="flex h-full items-center justify-center">
                <div className="text-center">
                  <div className="mb-4 text-6xl opacity-10">🌐</div>
                  <h2 className="text-xl font-semibold text-gray-400">WiseWander</h2>
                  <p className="mt-1 text-sm text-gray-400">Open a new tab to start browsing</p>
                  <button
                    onClick={() => createTab()}
                    className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
                  >
                    New Tab
                  </button>
                </div>
              </div>
            )}

            {/* AI Model status indicator */}
            {(() => {
              const hasProvider = providerStatuses.some(p => p.online)
              const isOnline = ollamaStatus === 'online' || hasProvider
              const isChecking = ollamaStatus === 'checking' && !hasProvider
              return (
                <div className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-full bg-black/35 px-2.5 py-1 shadow-sm ring-1 ring-white/10 backdrop-blur-md">
                  <div
                    className={`h-2 w-2 rounded-full ${
                      isOnline
                        ? 'bg-green-400'
                        : isChecking
                        ? 'animate-pulse bg-yellow-400'
                        : 'bg-red-400'
                    }`}
                  />
                  <span className="text-[10px] text-white/70">AI Model {isOnline ? 'online' : isChecking ? 'checking' : 'offline'}</span>
                </div>
              )
            })()}
          </div>

          {/* DevTools Panel */}
          {devToolsOpen && activeTabId && <DevToolsPanel tabId={activeTabId} />}
        </div>

        {/* AI Sidebar */}
        {sidebarOpen && (
          <AISidebar
            activeTab={activeSidebarTab}
            onTabChange={setActiveSidebarTab}
            tabId={activeTabId ?? ''}
            onClose={toggleSidebar}
            onSend={sendAIWithPageContext}
            onSummarize={summarizeWithPageContext}
            onTranslate={translateWithContext}
          />
        )}
      </div>

      <DownloadBar visible={downloadBarOpen} onClose={() => setDownloadBarOpen(false)} />
      <CommandPalette isOpen={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} commands={commands} />
      {settingsOpen && <SettingsPage onClose={() => setSettingsOpen(false)} />}
    </div>
  )
}
