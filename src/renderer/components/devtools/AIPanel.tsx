import { useState } from 'react'
import { useDevToolsStore } from '../../store/devtools-store'

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString()
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

const TYPE_COLORS: Record<string, string> = {
  request: 'text-blue-600 dark:text-blue-400',
  response: 'text-green-600 dark:text-green-400',
  error: 'text-red-600 dark:text-red-400',
  info: 'text-gray-600 dark:text-gray-400',
}

const TYPE_LABELS: Record<string, string> = {
  request: 'REQ',
  response: 'RES',
  error: 'ERR',
  info: 'INFO',
}

export function AIPanel(): React.ReactElement {
  const { aiDebugData, clearAIDebug } = useDevToolsStore()
  const [filter, setFilter] = useState<string>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const filtered =
    filter === 'all'
      ? aiDebugData
      : aiDebugData.filter((e) => e.type === filter)

  const counts = {
    request: aiDebugData.filter((e) => e.type === 'request').length,
    response: aiDebugData.filter((e) => e.type === 'response').length,
    error: aiDebugData.filter((e) => e.type === 'error').length,
  }

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex shrink-0 items-center gap-1 border-b border-gray-200 px-2 py-1 dark:border-gray-700">
        {(['all', 'request', 'response', 'error'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded px-2 py-0.5 text-[11px] ${
              filter === f
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            {f === 'all' ? 'All' : f.toUpperCase()}
            {f !== 'all' && counts[f] > 0 && (
              <span className="ml-1 text-[10px] opacity-60">({counts[f]})</span>
            )}
          </button>
        ))}
        <div className="flex-1" />
        <button
          onClick={async () => {
            try {
              const status = await window.api.ollamaStatus()
              useDevToolsStore.getState().addAIDebugEntry({
                id: `info-${Date.now()}`,
                type: 'info',
                action: 'status',
                model: '',
                content: `Ollama: ${status.status}${status.status === 'ok' ? ' (connected)' : ' (offline)'}`,
                timestamp: Date.now(),
              })
            } catch {
              useDevToolsStore.getState().addAIDebugEntry({
                id: `info-${Date.now()}`,
                type: 'error',
                action: 'status',
                model: '',
                content: 'Failed to check Ollama status',
                timestamp: Date.now(),
              })
            }
          }}
          className="rounded px-2 py-0.5 text-[11px] text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          Check Status
        </button>
        <button
          onClick={clearAIDebug}
          className="rounded px-2 py-0.5 text-[11px] text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          Clear
        </button>
      </div>

      {/* Log entries */}
      <div className="flex-1 overflow-y-auto font-mono text-xs">
        {filtered.length === 0 ? (
          <div className="p-3 text-gray-400">
            No AI interaction logs. Send a chat message to see debug info.
          </div>
        ) : (
          filtered.map((entry) => (
            <div
              key={entry.id}
              onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
              className={`cursor-pointer border-b border-gray-100 px-2 py-1 dark:border-gray-800 ${
                entry.type === 'error'
                  ? 'bg-red-50 dark:bg-red-950/20'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`w-8 text-center text-[10px] font-bold ${
                    TYPE_COLORS[entry.type]
                  }`}
                >
                  {TYPE_LABELS[entry.type]}
                </span>
                <span className="text-[10px] text-gray-400">
                  {formatTime(entry.timestamp)}
                </span>
                <span className="rounded bg-gray-100 px-1 py-0.5 text-[10px] text-gray-500 dark:bg-gray-800">
                  {entry.action}
                </span>
                {entry.model && (
                  <span className="text-[10px] text-purple-600 dark:text-purple-400">
                    {entry.model}
                  </span>
                )}
                {entry.duration !== undefined && (
                  <span className="text-[10px] text-gray-400">
                    {formatDuration(entry.duration)}
                  </span>
                )}
              </div>
              <div className="mt-0.5 truncate pl-10 text-gray-600 dark:text-gray-400">
                {entry.content}
              </div>
              {expandedId === entry.id && (
                <div className="mt-1 whitespace-pre-wrap break-all rounded bg-gray-100 p-2 text-[11px] text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                  {entry.content}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-gray-200 bg-gray-50 px-2 py-1 text-[10px] text-gray-400 dark:border-gray-700 dark:bg-gray-850">
        {aiDebugData.length} entries |
        Errors: {counts.error} |
        Avg duration:{' '}
        {aiDebugData.filter((e) => e.duration).length > 0
          ? formatDuration(
              Math.round(
                aiDebugData
                  .filter((e) => e.duration)
                  .reduce((s, e) => s + (e.duration ?? 0), 0) /
                  aiDebugData.filter((e) => e.duration).length
              )
            )
          : '-'}
      </div>
    </div>
  )
}
