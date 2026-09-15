import { useState, useEffect } from 'react'
import type { ReadingListItem } from '../../../shared/types'

export function ReadingQueuePanel(): React.ReactElement {
  const [items, setItems] = useState<ReadingListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [summarizingId, setSummarizingId] = useState<number | null>(null)

  const loadItems = async (): Promise<void> => {
    setLoading(true)
    try {
      const result = (await window.api.readingListList()) as { entries: ReadingListItem[] }
      const entries = result.entries || []
      setItems(entries)

      // Auto-summarize items that don't have a summary yet (limit to 1 at a time)
      const withoutSummary = entries.find((item) => !item.aiSummary)
      if (withoutSummary) {
        handleSummarize(withoutSummary.id)
      }
    } catch {
      // ignore
    }
    setLoading(false)
  }

  useEffect(() => {
    loadItems()
  }, [])

  const handleSummarize = async (id: number): Promise<void> => {
    setSummarizingId(id)
    try {
      const result = (await window.api.readingListSummarize(id)) as { summary: string }
      if (result.summary) {
        setItems((prev) =>
          prev.map((item) => (item.id === id ? { ...item, aiSummary: result.summary } : item))
        )
      }
    } catch {
      // ignore
    }
    setSummarizingId(null)
  }

  const handleRemove = async (id: number): Promise<void> => {
    await window.api.readingListRemove(id)
    setItems((prev) => prev.filter((item) => item.id !== id))
  }

  const formatTime = (ts: number): string => {
    const d = new Date(ts)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    if (diff < 60_000) return 'just now'
    if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`
    if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`
    return d.toLocaleDateString()
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-gray-200 p-3 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Reading Queue</h3>
        <p className="text-[10px] text-gray-400">Articles saved for later reading</p>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {loading && (
          <div className="text-center text-xs text-gray-400 py-4">Loading...</div>
        )}

        {!loading && items.length === 0 && (
          <div className="text-center py-8">
            <div className="text-2xl mb-2">&#128214;</div>
            <p className="text-xs text-gray-400">Your reading queue is empty</p>
            <p className="text-[10px] text-gray-400 mt-1">Use "Add to Queue" from the address bar</p>
          </div>
        )}

        {items.map((item) => (
          <div key={item.id} className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <a
                  href={item.url}
                  className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400 block truncate"
                  onClick={(e) => {
                    e.preventDefault()
                    window.open(item.url, '_blank')
                  }}
                >
                  {item.title}
                </a>
                <div className="text-[10px] text-gray-400 mt-0.5">{formatTime(item.addedAt)}</div>
              </div>
              <div className="flex gap-1 shrink-0">
                {!item.aiSummary && (
                  <button
                    onClick={() => handleSummarize(item.id)}
                    disabled={summarizingId === item.id}
                    className="text-[10px] text-teal-600 hover:text-teal-700 dark:text-teal-400
                      disabled:opacity-50 px-1"
                    title="Generate AI summary"
                  >
                    {summarizingId === item.id ? '...' : 'AI'}
                  </button>
                )}
                <button
                  onClick={() => handleRemove(item.id)}
                  className="text-[10px] text-red-400 hover:text-red-600 px-1"
                  title="Remove"
                >
                  &#x2715;
                </button>
              </div>
            </div>

            {/* AI Summary */}
            {item.aiSummary && (
              <div className="mt-2 rounded bg-gray-50 p-2 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                {item.aiSummary}
              </div>
            )}

            {/* Excerpt */}
            {item.excerpt && !item.aiSummary && (
              <p className="mt-1 text-[10px] text-gray-400 line-clamp-2">{item.excerpt}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
