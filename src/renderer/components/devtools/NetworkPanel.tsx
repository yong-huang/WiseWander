import { useState } from 'react'
import { useDevToolsStore } from '../../store/devtools-store'

interface NetworkPanelProps {
  tabId: string
}

const TYPE_ICONS: Record<string, string> = {
  document: '\uD83D\uDCC4',
  script: '\u2699',
  stylesheet: '\uD83C\uDFA8',
  img: '\uD83D\uDDBC',
  xmlhttprequest: '\u2194',
  fetch: '\u2194',
  other: '\u2022',
}

function getResourceType(initiator: string): string {
  if (initiator === 'navigation') return 'document'
  if (initiator === 'script') return 'script'
  if (initiator === 'link') return 'stylesheet'
  if (initiator === 'img') return 'img'
  if (initiator === 'xmlhttprequest') return 'xmlhttprequest'
  if (initiator === 'fetch') return 'fetch'
  return 'other'
}

function formatSize(bytes: number): string {
  if (bytes <= 0) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatTime(ms: number): string {
  if (ms <= 0) return '-'
  if (ms < 1000) return `${ms.toFixed(0)} ms`
  return `${(ms / 1000).toFixed(2)} s`
}

function shortUrl(url: string): string {
  try {
    const u = new URL(url)
    const path = u.pathname === '/' ? '' : u.pathname
    return u.host + path + u.search
  } catch {
    return url.slice(0, 80)
  }
}

const FILTERS = ['all', 'document', 'script', 'stylesheet', 'img', 'xhr', 'other'] as const

export function NetworkPanel({ tabId }: NetworkPanelProps): React.ReactElement {
  const { networkData, networkFilter, setNetworkFilter, clearNetwork, setNetworkEntries } =
    useDevToolsStore()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const entries = networkData.get(tabId) ?? []
  const filtered =
    networkFilter === 'all'
      ? entries
      : networkFilter === 'xhr'
      ? entries.filter(
          (e) => e.initiatorType === 'xmlhttprequest' || e.initiatorType === 'fetch'
        )
      : entries.filter((e) => getResourceType(e.initiatorType) === networkFilter)

  const selected = entries.find((e) => e.id === selectedId)

  const handleRefresh = async (): Promise<void> => {
    const wv = document.querySelector(
      `webview[data-tab-id="${tabId}"]`
    ) as Electron.WebviewTag | null
    if (!wv) return

    try {
      const raw = await wv.executeJavaScript(`
        (function(){
          try {
            var entries = performance.getEntriesByType('resource');
            return JSON.stringify(entries.map(function(e, i) {
              return {
                name: e.name,
                initiatorType: e.initiatorType || 'other',
                duration: Math.round(e.duration),
                startTime: Math.round(e.startTime),
                transferSize: e.transferSize || 0,
                responseStatus: e.responseStatus || 0
              };
            }));
          } catch(e) { return '[]'; }
        })()
      `)
      const items = JSON.parse(raw) as Array<{
        name: string
        initiatorType: string
        duration: number
        startTime: number
        transferSize: number
        responseStatus: number
      }>

      const mapped = items.map((item, i) => ({
        id: `net-${i}-${Date.now()}`,
        url: item.name,
        name: shortUrl(item.name),
        method: getResourceType(item.initiatorType) === 'document' ? 'GET' : '',
        status: item.responseStatus,
        mimeType: '',
        initiatorType: item.initiatorType,
        startTime: item.startTime,
        duration: item.duration,
        size: item.transferSize,
      }))

      setNetworkEntries(tabId, mapped)
    } catch {
      // ignore
    }
  }

  const totalSize = filtered.reduce((s, e) => s + e.size, 0)
  const totalTime = filtered.length > 0 ? Math.max(...filtered.map((e) => e.duration)) : 0

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex shrink-0 items-center gap-1 border-b border-gray-200 px-2 py-1 dark:border-gray-700">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setNetworkFilter(f)}
            className={`rounded px-2 py-0.5 text-[11px] ${
              networkFilter === f
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            {f === 'all' ? 'All' : f.toUpperCase()}
          </button>
        ))}
        <div className="flex-1" />
        <span className="mr-2 text-[10px] text-gray-400">
          {filtered.length} requests | {formatSize(totalSize)} | {formatTime(totalTime)}
        </span>
        <button
          onClick={handleRefresh}
          className="rounded px-2 py-0.5 text-[11px] text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          Refresh
        </button>
        <button
          onClick={() => clearNetwork(tabId)}
          className="rounded px-2 py-0.5 text-[11px] text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          Clear
        </button>
      </div>

      {/* Table header */}
      <div className="flex shrink-0 items-center border-b border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] font-semibold text-gray-500 dark:border-gray-700 dark:bg-gray-850">
        <span className="w-6"> </span>
        <span className="flex-1">Name</span>
        <span className="w-14 text-center">Status</span>
        <span className="w-16 text-center">Type</span>
        <span className="w-16 text-right">Size</span>
        <span className="w-16 text-right">Time</span>
      </div>

      {/* Table body */}
      <div className="flex-1 overflow-y-auto font-mono text-xs">
        {filtered.length === 0 ? (
          <div className="p-3 text-gray-400">
            No network data. Click Refresh or navigate to a page.
          </div>
        ) : (
          filtered.map((entry) => {
            const rtype = getResourceType(entry.initiatorType)
            return (
              <div
                key={entry.id}
                onClick={() => setSelectedId(selectedId === entry.id ? null : entry.id)}
                className={`flex cursor-pointer items-center border-b border-gray-100 px-2 py-0.5 hover:bg-blue-50 dark:border-gray-800 dark:hover:bg-blue-950/30 ${
                  selectedId === entry.id ? 'bg-blue-50 dark:bg-blue-950/30' : ''
                }`}
              >
                <span className="w-6 text-center text-[10px]">
                  {TYPE_ICONS[rtype] || TYPE_ICONS.other}
                </span>
                <span
                  className={`flex-1 truncate ${
                    rtype === 'document' ? 'font-semibold' : ''
                  }`}
                  title={entry.url}
                >
                  {entry.name}
                </span>
                <span className="w-14 text-center text-gray-500">
                  {entry.status > 0 ? entry.status : '-'}
                </span>
                <span className="w-16 text-center text-gray-500">{rtype}</span>
                <span className="w-16 text-right text-gray-500">
                  {formatSize(entry.size)}
                </span>
                <span className="w-16 text-right text-gray-500">
                  {formatTime(entry.duration)}
                </span>
              </div>
            )
          })
        )}
      </div>

      {/* Detail panel */}
      {selected && (
        <div className="shrink-0 border-t border-gray-200 bg-gray-50 p-2 dark:border-gray-700 dark:bg-gray-850">
          <div className="text-[11px] font-semibold text-gray-600 dark:text-gray-400">
            Request Detail
          </div>
          <div className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[11px]">
            <span className="text-gray-400">URL:</span>
            <span className="break-all text-gray-700 dark:text-gray-300">{selected.url}</span>
            <span className="text-gray-400">Type:</span>
            <span className="text-gray-700 dark:text-gray-300">
              {selected.initiatorType}
            </span>
            <span className="text-gray-400">Status:</span>
            <span className="text-gray-700 dark:text-gray-300">{selected.status || '-'}</span>
            <span className="text-gray-400">Size:</span>
            <span className="text-gray-700 dark:text-gray-300">
              {formatSize(selected.size)}
            </span>
            <span className="text-gray-400">Duration:</span>
            <span className="text-gray-700 dark:text-gray-300">
              {formatTime(selected.duration)}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
