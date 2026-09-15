import { useState, useRef, useEffect } from 'react'
import { useDevToolsStore } from '../../store/devtools-store'

interface ConsolePanelProps {
  tabId: string
}

const LEVEL_STYLES: Record<string, { color: string; icon: string }> = {
  log: { color: 'text-gray-800 dark:text-gray-200', icon: '' },
  info: { color: 'text-blue-600 dark:text-blue-400', icon: '\u2139' },
  warn: { color: 'text-amber-600 dark:text-amber-400', icon: '\u26A0' },
  error: { color: 'text-red-600 dark:text-red-400', icon: '\u2716' },
}

export function ConsolePanel({ tabId }: ConsolePanelProps): React.ReactElement {
  const { consoleData, consoleFilter, setConsoleFilter, clearConsole } = useDevToolsStore()
  const [inputValue, setInputValue] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const copyText = (text: string, id: string): void => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 1200)
    })
  }

  const messages = consoleData.get(tabId) ?? []
  const filtered =
    consoleFilter === 'all' ? messages : messages.filter((m) => m.level === consoleFilter)

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [filtered.length])

  const handleExecute = async (): Promise<void> => {
    const code = inputValue.trim()
    if (!code) return
    setInputValue('')

    useDevToolsStore.getState().addConsoleEntry(tabId, {
      id: `in-${Date.now()}`,
      level: 'log',
      text: `> ${code}`,
      timestamp: Date.now(),
      isInput: true,
    })

    try {
      const wv = document.querySelector(
        `webview[data-tab-id="${tabId}"]`
      ) as Electron.WebviewTag | null
      if (!wv) return
      const result = await wv.executeJavaScript(
        `(function(){try{return String(eval(${JSON.stringify(code)}))}catch(e){return 'Error: '+e.message}})()`
      )
      useDevToolsStore.getState().addConsoleEntry(tabId, {
        id: `r-${Date.now()}`,
        level: 'log',
        text: result,
        timestamp: Date.now(),
      })
    } catch (err) {
      useDevToolsStore.getState().addConsoleEntry(tabId, {
        id: `e-${Date.now()}`,
        level: 'error',
        text: `Error: ${err instanceof Error ? err.message : String(err)}`,
        timestamp: Date.now(),
      })
    }
  }

  const counts: Record<string, number> = {
    log: messages.filter((m) => m.level === 'log' && !m.isInput).length,
    info: messages.filter((m) => m.level === 'info').length,
    warn: messages.filter((m) => m.level === 'warn').length,
    error: messages.filter((m) => m.level === 'error').length,
  }

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex shrink-0 items-center gap-1 border-b border-gray-200 px-2 py-1 dark:border-gray-700">
        {(['all', 'log', 'info', 'warn', 'error'] as const).map((level) => (
          <button
            key={level}
            onClick={() => setConsoleFilter(level)}
            className={`rounded px-2 py-0.5 text-[11px] ${
              consoleFilter === level
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            {level === 'all' ? 'All' : level.charAt(0).toUpperCase() + level.slice(1)}
            {level !== 'all' && counts[level] > 0 && (
              <span className="ml-1 text-[10px] opacity-60">({counts[level]})</span>
            )}
          </button>
        ))}
        <div className="flex-1" />
        <button
          onClick={() => clearConsole(tabId)}
          className="rounded px-2 py-0.5 text-[11px] text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
          title="Clear console"
        >
          Clear
        </button>
        <button
          onClick={() => {
            const text = filtered.map((m) => `[${m.level.toUpperCase()}] ${m.text}`).join('\n')
            navigator.clipboard.writeText(text)
          }}
          className="rounded px-2 py-0.5 text-[11px] text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
          title="Copy all visible messages"
        >
          Copy All
        </button>
      </div>

      {/* Messages */}
      <div ref={listRef} className="flex-1 overflow-y-auto font-mono text-xs">
        {filtered.length === 0 ? (
          <div className="p-3 text-gray-400">No console messages</div>
        ) : (
          filtered.map((msg) => {
            const style = LEVEL_STYLES[msg.level] ?? LEVEL_STYLES.log
            return (
              <div
                key={msg.id}
                onClick={() => copyText(msg.text, msg.id)}
                className={`group relative flex cursor-pointer items-start gap-1.5 border-b border-gray-100 px-2 py-0.5 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/50 ${
                  msg.level === 'error'
                    ? 'bg-red-50 dark:bg-red-950/20'
                    : msg.level === 'warn'
                    ? 'bg-amber-50 dark:bg-amber-950/20'
                    : msg.isInput
                    ? 'bg-blue-50/50 dark:bg-blue-950/10'
                    : ''
                }`}
                title="Click to copy"
              >
                <span className="w-3 shrink-0 text-center text-[10px] text-gray-400">
                  {msg.isInput ? '>' : style.icon}
                </span>
                <span
                  className={`flex-1 break-all select-text ${
                    msg.isInput ? 'text-blue-600 dark:text-blue-400' : style.color
                  }`}
                >
                  {msg.text}
                </span>
                {msg.source && (
                  <span
                    className="shrink-0 text-[10px] text-gray-400"
                    title={`${msg.source}:${msg.line}`}
                  >
                    {msg.source.split('/').pop()}:{msg.line}
                  </span>
                )}
                {/* Copy feedback */}
                {copiedId === msg.id && (
                  <span className="absolute right-2 top-0 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white">
                    Copied
                  </span>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center">
          <span className="px-2 text-xs text-blue-500">&gt;</span>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleExecute()}
            placeholder="Execute JavaScript..."
            className="flex-1 bg-transparent py-1.5 font-mono text-xs text-gray-800 outline-none dark:text-gray-200"
          />
        </div>
      </div>
    </div>
  )
}
