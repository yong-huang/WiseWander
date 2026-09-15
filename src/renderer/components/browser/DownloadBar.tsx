import { useState, useEffect, useCallback } from 'react'
import type { DownloadItem } from '../../../shared/types'

interface DownloadBarProps {
  visible: boolean
  onClose: () => void
}

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

export function DownloadBar({ visible, onClose }: DownloadBarProps): React.ReactElement | null {
  const [items, setItems] = useState<DownloadItem[]>([])

  const upsert = useCallback((item: DownloadItem) => {
    setItems((prev) => {
      const idx = prev.findIndex((d) => d.id === item.id)
      if (idx === -1) return [item, ...prev]
      const next = [...prev]
      next[idx] = item
      return next
    })
  }, [])

  const refresh = useCallback(() => {
    window.api
      .downloadList()
      .then((list: unknown) => setItems(list as DownloadItem[]))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!visible) return
    refresh()

    const offProgress = window.api.onDownloadProgress((data: unknown) => upsert(data as DownloadItem))
    const offDone = window.api.onDownloadDone((data: unknown) => upsert(data as DownloadItem))
    return () => {
      offProgress()
      offDone()
    }
  }, [visible, refresh, upsert])

  if (!visible) return null

  const inProgress = items.filter((d) => d.state === 'downloading')

  return (
    <div className="border-t border-gray-200 bg-gray-50 px-4 py-2 dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
          Downloads{items.length > 0 ? ` (${items.length})` : ''}
        </span>
        <div className="flex items-center gap-3">
          {items.length > 0 && (
            <button
              onClick={() => {
                window.api.downloadClear().then(refresh).catch(() => {})
              }}
              className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              Clear finished
            </button>
          )}
          <button
            onClick={onClose}
            className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            Close
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="py-1 text-xs text-gray-400">No downloads yet</p>
      ) : (
        <ul className="max-h-40 space-y-1 overflow-y-auto">
          {items.slice(0, 20).map((item) => {
            const percent =
              item.totalBytes > 0 ? Math.min(100, Math.round((item.receivedBytes / item.totalBytes) * 100)) : null
            return (
              <li key={item.id} className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs text-gray-700 dark:text-gray-200" title={item.filename}>
                    {item.filename}
                  </div>
                  {item.state === 'downloading' && percent !== null && (
                    <div className="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-600">
                      <div className="h-full bg-blue-500 transition-all" style={{ width: `${percent}%` }} />
                    </div>
                  )}
                </div>
                <span className="shrink-0 text-[10px] text-gray-400">
                  {item.state === 'downloading'
                    ? percent !== null
                      ? `${percent}%`
                      : formatBytes(item.receivedBytes)
                    : item.state === 'completed'
                    ? formatBytes(item.totalBytes || item.receivedBytes)
                    : item.state}
                </span>
                {item.state === 'downloading' && (
                  <button
                    onClick={() => window.api.downloadCancel(item.id).catch(() => {})}
                    className="shrink-0 text-[10px] text-red-400 hover:text-red-600"
                  >
                    Cancel
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {inProgress.length > 0 && (
        <p className="mt-1 text-[10px] text-gray-400">
          Saving to {inProgress[0].savePath}
        </p>
      )}
    </div>
  )
}
