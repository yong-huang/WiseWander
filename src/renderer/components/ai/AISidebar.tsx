import { useState, useCallback, useRef, useEffect, Fragment } from 'react'
import { ChatPanel } from './ChatPanel'
import { AssistantPanel } from './AssistantPanel'
import { SummaryPanel } from './SummaryPanel'
import { TranslatePanel } from './TranslatePanel'
import { AgentPanel } from '../agent/AgentPanel'
import type { AgentTask } from '../../../shared/types'
import { ResearchPanel } from '../research/ResearchPanel'
import { CapabilityListPanel } from '../capability/CapabilityListPanel'
import { DesignAnalyzerPanel } from '../capability/DesignAnalyzerPanel'
import { WebCrawlerPanel } from '../capability/WebCrawlerPanel'
import { MarkdownExporterPanel } from '../capability/MarkdownExporterPanel'
import { ScreenshotPanel } from '../capability/ScreenshotPanel'
import { DataExtractorPanel } from '../capability/DataExtractorPanel'
import { PageMonitorPanel } from '../capability/PageMonitorPanel'
import { MultiTabAnalysisPanel } from '../capability/MultiTabAnalysisPanel'
import { CssEditorPanel } from '../capability/CssEditorPanel'
import { AccessibilityPanel } from '../capability/AccessibilityPanel'
import { ReadingQueuePanel } from '../reading/ReadingQueuePanel'
import { RecommendationPanel } from '../recommendation/RecommendationPanel'
import { useAIStore } from '../../store/ai-store'
import { useAgentStore } from '../../store/agent-store'

type SidebarTab = 'assistant' | 'chat' | 'summary' | 'agent' | 'research' | 'recommend' | 'tools' | 'reading'

interface AISidebarProps {
  activeTab: SidebarTab
  onTabChange: (tab: SidebarTab) => void
  tabId: string
  onClose: () => void
  onSend: (tabId: string, message: string) => Promise<void>
  onSummarize: (tabId: string, length?: string) => Promise<{ text: string }>
  onTranslate: (text: string, targetLang: string) => Promise<unknown>
}

/** Per-tab storage for summary and translate state */
interface TabSession {
  summaryText: string
  translatedText: string
  originalText: string
}

function useTabSessions(): {
  getSession: (tabId: string) => TabSession
  setSession: (tabId: string, patch: Partial<TabSession>) => void
} {
  const sessionsRef = useRef<Map<string, TabSession>>(new Map())

  const getSession = useCallback((id: string): TabSession => {
    let s = sessionsRef.current.get(id)
    if (!s) {
      s = { summaryText: '', translatedText: '', originalText: '' }
      sessionsRef.current.set(id, s)
    }
    return s
  }, [])

  const setSession = useCallback((id: string, patch: Partial<TabSession>): void => {
    const s = getSession(id)
    sessionsRef.current.set(id, { ...s, ...patch })
  }, [getSession])

  return { getSession, setSession }
}

export function AISidebar({
  activeTab,
  onTabChange,
  tabId,
  onClose,
  onSend,
  onSummarize,
  onTranslate,
}: AISidebarProps): React.ReactElement {
  const { conversations, isStreaming, stopStreaming, pendingTranslate, setPendingTranslate } = useAIStore()
  const [selectedCapability, setSelectedCapability] = useState<string | null>(null)
  const agentStore = useAgentStore()
  const agentSession = agentStore.getTabState(tabId)
  const isExecuting = agentSession.isExecuting
  const executeTask = useCallback((desc: string) => agentStore.executeTask(tabId, desc), [tabId, agentStore])
  const cancelTask = useCallback(() => agentStore.cancelTask(tabId), [tabId, agentStore])
  const selectTask = useCallback((task: AgentTask) => agentStore.setActiveTask(tabId, task), [tabId, agentStore])

  const conversation = conversations.get(tabId)
  const messages = conversation?.messages ?? []

  // Per-tab sessions for summary and translate
  const { getSession, setSession } = useTabSessions()
  const [session, setSessionState] = useState<TabSession>(() => getSession(tabId))
  // Re-sync the local snapshot when the active tab changes
  useEffect(() => {
    setSessionState(getSession(tabId))
  }, [tabId, getSession])
  const updateSession = useCallback(
    (patch: Partial<TabSession>) => {
      setSession(tabId, patch)
      setSessionState((prev) => ({ ...prev, ...patch }))
    },
    [tabId, setSession]
  )

  // Right-click "AI translate selection": open the translate tool with prefilled text
  useEffect(() => {
    if (pendingTranslate) {
      setSelectedCapability('translate')
    }
  }, [pendingTranslate])

  const handleSend = useCallback(
    (message: string) => {
      onSend(tabId, message)
    },
    [tabId, onSend]
  )

  const handleSummarize = useCallback(
    async (length: string) => {
      const result = await onSummarize(tabId, length)
      updateSession({ summaryText: result.text })
    },
    [tabId, onSummarize, updateSession]
  )

  const handleTranslate = useCallback(
    async (text: string, targetLang: string) => {
      const result = (await onTranslate(text, targetLang)) as { text: string }
      updateSession({ translatedText: result.text, originalText: text })
    },
    [tabId, onTranslate, updateSession]
  )

  const handleBackToTools = useCallback(() => setSelectedCapability(null), [])

  const tabs: { id: SidebarTab; label: string; group?: 'ai' | 'tools' }[] = [
    { id: 'assistant', label: 'Browser', group: 'ai' },
    { id: 'chat', label: 'Page', group: 'ai' },
    { id: 'summary', label: 'Summary', group: 'tools' },
    { id: 'agent', label: 'Agent', group: 'tools' },
    { id: 'research', label: 'Research', group: 'tools' },
    { id: 'recommend', label: 'For You', group: 'tools' },
    { id: 'reading', label: 'Queue', group: 'tools' },
    { id: 'tools', label: 'Tools', group: 'tools' },
  ]

  return (
    <div className="flex w-[340px] shrink-0 flex-col border-l border-gray-200/80 bg-white shadow-[-4px_0_16px_rgb(16_24_40/0.03)] dark:border-gray-700/80 dark:bg-gray-900 dark:shadow-[-4px_0_16px_rgb(0_0_0/0.25)] animate-fade-in">
      {/* Header with tabs */}
      <div className="flex items-center border-b border-gray-200 dark:border-gray-700">
        <div className="flex flex-1 items-center overflow-x-auto px-1 py-1 gap-0.5">
          {tabs.map((tab, i) => (
            <Fragment key={tab.id}>
              {/* Divider between AI group and Tools group */}
              {i === 2 && (
                <div className="mx-1 h-4 w-px bg-gray-200 dark:bg-gray-700" />
              )}
              <button
                onClick={() => onTabChange(tab.id)}
                className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all duration-150 ${
                  activeTab === tab.id
                    ? tab.group === 'ai'
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm'
                      : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300'
                    : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200'
                }`}
              >
                {tab.label}
              </button>
            </Fragment>
          ))}
        </div>
        <div className="flex items-center gap-1 pr-2">
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-sm">
            &times;
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'assistant' && (
          <AssistantPanel />
        )}
        {activeTab === 'chat' && (
          <ChatPanel
            messages={messages
              .filter((m) => m.role !== 'system')
              .map((m, i, arr) => ({
                role: m.role as 'user' | 'assistant',
                content: m.content,
                isStreaming: isStreaming && i === arr.length - 1 && m.role === 'assistant',
              }))}
            isStreaming={isStreaming}
            onSend={handleSend}
            onStop={() => stopStreaming(tabId)}
          />
        )}
        {activeTab === 'summary' && (
          <SummaryPanel
            summary={session.summaryText}
            isGenerating={isStreaming}
            onGenerate={handleSummarize}
            onCopy={() => navigator.clipboard.writeText(session.summaryText)}
            onExport={() => {
              const blob = new Blob([session.summaryText], { type: 'text/markdown' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = 'summary.md'
              a.click()
              URL.revokeObjectURL(url)
            }}
          />
        )}
        {activeTab === 'agent' && (
          <AgentPanel tasks={agentSession.tasks} activeTask={agentSession.activeTask} isExecuting={isExecuting} onExecute={executeTask} onCancel={cancelTask} onSelectTask={selectTask} />
        )}
        {activeTab === 'research' && (
          <ResearchPanel />
        )}
        {activeTab === 'recommend' && (
          <RecommendationPanel tabId={tabId} />
        )}
        {activeTab === 'reading' && (
          <ReadingQueuePanel />
        )}
        {activeTab === 'tools' && (
          selectedCapability === 'translate' ? (
            <TranslatePanel
              translatedText={session.translatedText}
              originalText={session.originalText}
              seedText={pendingTranslate}
              onConsumeSeed={() => setPendingTranslate(null)}
              isTranslating={isStreaming}
              onTranslate={handleTranslate}
              onBack={handleBackToTools}
            />
          ) : selectedCapability === 'design-analyzer' ? (
            <DesignAnalyzerPanel tabId={tabId} onBack={handleBackToTools} />
          ) : selectedCapability === 'web-crawler' ? (
            <WebCrawlerPanel tabId={tabId} onBack={handleBackToTools} />
          ) : selectedCapability === 'markdown-exporter' ? (
            <MarkdownExporterPanel tabId={tabId} onBack={handleBackToTools} />
          ) : selectedCapability === 'screenshot' ? (
            <ScreenshotPanel tabId={tabId} onBack={handleBackToTools} />
          ) : selectedCapability === 'data-extractor' ? (
            <DataExtractorPanel tabId={tabId} onBack={handleBackToTools} />
          ) : selectedCapability === 'page-monitor' ? (
            <PageMonitorPanel tabId={tabId} onBack={handleBackToTools} />
          ) : selectedCapability === 'multi-tab-analysis' ? (
            <MultiTabAnalysisPanel tabId={tabId} onBack={handleBackToTools} />
          ) : selectedCapability === 'css-editor' ? (
            <CssEditorPanel tabId={tabId} onBack={handleBackToTools} />
          ) : selectedCapability === 'accessibility' ? (
            <AccessibilityPanel tabId={tabId} onBack={handleBackToTools} />
          ) : (
            <CapabilityListPanel onSelectCapability={setSelectedCapability} />
          )
        )}
      </div>

    </div>
  )
}
