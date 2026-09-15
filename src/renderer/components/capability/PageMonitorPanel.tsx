import { useState, useEffect } from 'react'
import { useCapabilityStore } from '../../store/capability-store'
import { useTabStore } from '../../store/tab-store'

interface PageMonitorPanelProps {
  tabId: string
  onBack: () => void
}

export function PageMonitorPanel({ tabId, onBack }: PageMonitorPanelProps): React.ReactElement {
  const tabUrl = useTabStore((s) => {
    const tab = s.tabs.find((t) => t.id === tabId)
    return tab?.url ?? ''
  })
  const tabTitle = useTabStore((s) => {
    const tab = s.tabs.find((t) => t.id === tabId)
    return tab?.title ?? ''
  })

  const {
    monitoredPages,
    monitorChanges,
    monitorLoading,
    loadMonitoredPages,
    addMonitoredPage,
    removeMonitoredPage,
    toggleMonitoredPage,
    loadMonitorHistory,
    checkNow,
    setupMonitorListener,
  } = useCapabilityStore()

  const [interval, setInterval] = useState(300)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    loadMonitoredPages()
    const cleanup = setupMonitorListener()
    return () => cleanup()
  }, [])

  const handleAdd = async (): Promise<void> => {
    if (!tabUrl) return
    await addMonitoredPage(tabUrl, tabTitle, interval * 1000)
  }

  const handleToggleExpand = async (pageId: string): Promise<void> => {
    if (expandedId === pageId) {
      setExpandedId(null)
    } else {
      setExpandedId(pageId)
      await loadMonitorHistory(pageId)
    }
  }

  const formatTime = (ts: number): string => new Date(ts).toLocaleString()

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-gray-200 p-3 dark:border-gray-700">
        <button onClick={onBack} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">&larr;</button>
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Page Monitor</span>
        {monitoredPages.length > 0 && (
          <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-medium text-teal-700 dark:bg-teal-900 dark:text-teal-300">
            {monitoredPages.length}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Add Current Page */}
        {tabUrl && (
          <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-2 truncate">
              {tabTitle || tabUrl}
            </div>
            <div className="flex gap-2">
              <select
                value={interval}
                onChange={(e) => setInterval(Number(e.target.value))}
                className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs
                  dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
              >
                <option value={60}>1 min</option>
                <option value={300}>5 min</option>
                <option value={600}>10 min</option>
                <option value={1800}>30 min</option>
                <option value={3600}>1 hour</option>
              </select>
              <button
                onClick={handleAdd}
                className="flex-1 rounded-lg bg-teal-500 px-3 py-1.5 text-xs font-medium text-white
                  hover:bg-teal-600 transition-colors"
              >
                Monitor This Page
              </button>
            </div>
          </div>
        )}

        {/* Loading */}
        {monitorLoading && (
          <div className="text-center text-xs text-gray-400 py-4">Loading...</div>
        )}

        {/* Monitored Pages List */}
        {!monitorLoading && monitoredPages.length === 0 && (
          <div className="text-center py-8">
            <div className="text-2xl mb-2">&#128269;</div>
            <p className="text-xs text-gray-400">No pages being monitored</p>
            <p className="text-[10px] text-gray-400 mt-1">Navigate to a page and click "Monitor This Page"</p>
          </div>
        )}

        <div className="space-y-2">
          {monitoredPages.map((page) => (
            <div key={page.id} className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="flex items-center gap-2 p-2">
                {/* Toggle */}
                <button
                  onClick={() => toggleMonitoredPage(page.id)}
                  className={`w-8 h-4 rounded-full transition-colors ${
                    page.enabled ? 'bg-teal-500' : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                >
                  <div className={`w-3 h-3 rounded-full bg-white shadow transition-transform ${
                    page.enabled ? 'translate-x-4' : 'translate-x-0.5'
                  }`} />
                </button>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">
                    {page.title}
                  </div>
                  <div className="text-[10px] text-gray-400 truncate">{page.url}</div>
                </div>

                {/* Actions */}
                <button
                  onClick={() => checkNow(page.id)}
                  className="text-[10px] text-teal-600 hover:text-teal-700 dark:text-teal-400 px-1"
                  title="Check now"
                >
                  &#x21bb;
                </button>
                <button
                  onClick={() => handleToggleExpand(page.id)}
                  className="text-[10px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 px-1"
                  title="Change history"
                >
                  {expandedId === page.id ? '\u25B2' : '\u25BC'}
                </button>
                <button
                  onClick={() => removeMonitoredPage(page.id)}
                  className="text-[10px] text-red-400 hover:text-red-600 px-1"
                  title="Remove"
                >
                  &#x2715;
                </button>
              </div>

              {/* Status bar */}
              <div className="flex items-center gap-2 px-2 pb-1">
                <span className={`w-1.5 h-1.5 rounded-full ${page.enabled ? 'bg-green-400' : 'bg-gray-400'}`} />
                <span className="text-[10px] text-gray-400">
                  Every {Math.round(page.checkIntervalMs / 60000)} min
                  {page.lastCheckedAt ? ` · Last: ${formatTime(page.lastCheckedAt)}` : ''}
                </span>
              </div>

              {/* Change History (expanded) */}
              {expandedId === page.id && monitorChanges.length > 0 && (
                <div className="border-t border-gray-100 dark:border-gray-700 px-2 py-2 space-y-1">
                  <div className="text-[10px] font-medium text-gray-500 mb-1">Change History</div>
                  {monitorChanges.map((change) => (
                    <div key={change.id} className="rounded bg-gray-50 dark:bg-gray-800 p-2">
                      <div className="text-[10px] text-gray-500">{formatTime(change.detectedAt)}</div>
                      {change.diffSummary && (
                        <div className="text-xs text-gray-700 dark:text-gray-300 mt-0.5">
                          {change.diffSummary}
                        </div>
                      )}
                    </div>
                  ))}
                  {monitorChanges.length === 0 && (
                    <div className="text-[10px] text-gray-400">No changes detected yet</div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
