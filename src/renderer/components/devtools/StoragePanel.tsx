import { useState } from 'react'
import { useDevToolsStore, type StorageData } from '../../store/devtools-store'

interface StoragePanelProps {
  tabId: string
}

type StorageTab = 'cookies' | 'local' | 'session'

export function StoragePanel({ tabId }: StoragePanelProps): React.ReactElement {
  const { storageData, setStorage } = useDevToolsStore()
  const [activeStorageTab, setActiveStorageTab] = useState<StorageTab>('cookies')
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState('')
  const [expandedKey, setExpandedKey] = useState<string | null>(null)

  const data = storageData.get(tabId)
  const entries = data ? data[activeStorageTab] : []
  const filtered = filter
    ? entries.filter(
        (e) => e.key.toLowerCase().includes(filter.toLowerCase()) || e.value.toLowerCase().includes(filter.toLowerCase())
      )
    : entries

  const handleRefresh = async (): Promise<void> => {
    const wv = document.querySelector(
      `webview[data-tab-id="${tabId}"]`
    ) as Electron.WebviewTag | null
    if (!wv) return
    setLoading(true)
    try {
      const raw = await wv.executeJavaScript(`
        (function(){
          var result = { cookies: [], local: [], session: [] };
          // Cookies
          document.cookie.split(';').forEach(function(c) {
            var parts = c.trim();
            if (!parts) return;
            var idx = parts.indexOf('=');
            if (idx === -1) return;
            result.cookies.push({ key: parts.slice(0, idx).trim(), value: parts.slice(idx + 1) });
          });
          // localStorage
          for (var i = 0; i < localStorage.length; i++) {
            var k = localStorage.key(i);
            result.local.push({ key: k, value: localStorage.getItem(k) || '' });
          }
          // sessionStorage
          for (var j = 0; j < sessionStorage.length; j++) {
            var k2 = sessionStorage.key(j);
            result.session.push({ key: k2, value: sessionStorage.getItem(k2) || '' });
          }
          return JSON.stringify(result);
        })()
      `)
      const parsed = JSON.parse(raw) as StorageData
      setStorage(tabId, parsed)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (key: string): Promise<void> => {
    const wv = document.querySelector(
      `webview[data-tab-id="${tabId}"]`
    ) as Electron.WebviewTag | null
    if (!wv) return
    try {
      if (activeStorageTab === 'cookies') {
        await wv.executeJavaScript(`document.cookie = "${key}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";`)
      } else if (activeStorageTab === 'local') {
        await wv.executeJavaScript(`localStorage.removeItem(${JSON.stringify(key)});`)
      } else {
        await wv.executeJavaScript(`sessionStorage.removeItem(${JSON.stringify(key)});`)
      }
      handleRefresh()
    } catch {
      // ignore
    }
  }

  const handleClearAll = async (): Promise<void> => {
    const wv = document.querySelector(
      `webview[data-tab-id="${tabId}"]`
    ) as Electron.WebviewTag | null
    if (!wv) return
    try {
      if (activeStorageTab === 'local') {
        await wv.executeJavaScript('localStorage.clear();')
      } else if (activeStorageTab === 'session') {
        await wv.executeJavaScript('sessionStorage.clear();')
      }
      handleRefresh()
    } catch {
      // ignore
    }
  }

  const tabs: { key: StorageTab; label: string; count: number }[] = [
    { key: 'cookies', label: 'Cookies', count: data?.cookies.length ?? 0 },
    { key: 'local', label: 'Local Storage', count: data?.local.length ?? 0 },
    { key: 'session', label: 'Session Storage', count: data?.session.length ?? 0 },
  ]

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex shrink-0 items-center gap-1 border-b border-gray-200 px-2 py-1 dark:border-gray-700">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveStorageTab(tab.key)}
            className={`rounded px-2 py-0.5 text-[11px] ${
              activeStorageTab === tab.key
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
        <div className="flex-1" />
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter..."
          className="w-24 rounded border border-gray-300 px-1.5 py-0.5 text-[11px] dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        />
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="rounded px-2 py-0.5 text-[11px] text-gray-500 hover:bg-gray-100 disabled:opacity-50 dark:hover:bg-gray-800"
        >
          {loading ? '...' : 'Refresh'}
        </button>
        <button
          onClick={handleClearAll}
          className="rounded px-2 py-0.5 text-[11px] text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
        >
          Clear All
        </button>
      </div>

      {/* Table header */}
      <div className="flex shrink-0 items-center border-b border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] font-semibold text-gray-500 dark:border-gray-700 dark:bg-gray-850">
        <span className="flex-1">Key</span>
        <span className="flex-1">Value</span>
        <span className="w-8" />
      </div>

      {/* Table body */}
      <div className="flex-1 overflow-y-auto font-mono text-xs">
        {!data ? (
          <div className="p-3 text-gray-400">
            Click Refresh to load storage data.
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-3 text-gray-400">No entries</div>
        ) : (
          filtered.map((entry) => (
            <div
              key={entry.key}
              className="flex items-start border-b border-gray-100 px-2 py-0.5 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/50"
            >
              <span
                className="flex-1 cursor-pointer truncate text-blue-700 dark:text-blue-400"
                onClick={() => setExpandedKey(expandedKey === entry.key ? null : entry.key)}
                title={entry.key}
              >
                {entry.key}
              </span>
              <span
                className={`flex-1 text-gray-600 dark:text-gray-400 ${
                  expandedKey === entry.key ? 'break-all' : 'truncate'
                }`}
              >
                {expandedKey === entry.key
                  ? entry.value
                  : entry.value.length > 80
                  ? entry.value.slice(0, 80) + '...'
                  : entry.value}
              </span>
              <button
                onClick={() => handleDelete(entry.key)}
                className="w-8 shrink-0 text-center text-[10px] text-gray-400 hover:text-red-500"
                title="Delete"
              >
                &times;
              </button>
            </div>
          ))
        )}
      </div>

      {/* Summary */}
      {data && (
        <div className="shrink-0 border-t border-gray-200 bg-gray-50 px-2 py-1 text-[10px] text-gray-400 dark:border-gray-700 dark:bg-gray-850">
          {filtered.length} entries |{' '}
          Total size: ~{filtered.reduce((s, e) => s + e.key.length + e.value.length, 0)} chars
        </div>
      )}
    </div>
  )
}
