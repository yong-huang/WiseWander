import { useState, useEffect, useCallback } from 'react'

interface BookmarkItem {
  id: string
  title: string
  url: string
  faviconUrl?: string
  score?: number
}

interface BookmarkBarProps {
  onNavigate: (url: string) => void
  visible: boolean
}

export function BookmarkBar({ onNavigate, visible }: BookmarkBarProps): React.ReactElement {
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchMode, setSearchMode] = useState<'text' | 'semantic'>('text')
  const [isSearching, setIsSearching] = useState(false)

  useEffect(() => {
    loadBookmarks()
    const handler = (): void => { loadBookmarks() }
    window.addEventListener('bookmark-changed', handler)
    return () => { window.removeEventListener('bookmark-changed', handler) }
  }, [])

  const loadBookmarks = async (): Promise<void> => {
    try {
      const list = await window.api.bookmarkList()
      setBookmarks((list as BookmarkItem[]) ?? [])
    } catch {
      // bookmarks not available yet
    }
  }

  const handleSearch = useCallback(async (query: string): Promise<void> => {
    if (!query.trim()) {
      loadBookmarks()
      return
    }

    if (searchMode === 'semantic') {
      setIsSearching(true)
      try {
        const results = await window.api.bookmarkSemanticSearch(query) as BookmarkItem[]
        setBookmarks(results)
      } catch {
        // fallback to text search
        const results = await window.api.bookmarkSearch(query) as BookmarkItem[]
        setBookmarks(results)
      }
      setIsSearching(false)
    } else {
      const results = await window.api.bookmarkSearch(query) as BookmarkItem[]
      setBookmarks(results)
    }
  }, [searchMode])

  const handleRemove = useCallback(async (id: string, e: React.MouseEvent): Promise<void> => {
    e.stopPropagation()
    try {
      await window.api.bookmarkRemove(id)
      setBookmarks((prev) => prev.filter((b) => b.id !== id))
    } catch {
      // ignore
    }
  }, [])

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      handleSearch(searchQuery)
    }
    if (e.key === 'Escape') {
      setSearchQuery('')
      loadBookmarks()
    }
  }

  if (!visible) return <></>

  return (
    <div className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-850">
      {/* Search bar */}
      <div className="flex items-center gap-1 px-3 py-0.5 border-b border-gray-200 dark:border-gray-700">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleSearchKeyDown}
          placeholder="Search bookmarks..."
          className="flex-1 bg-transparent text-[11px] text-gray-600 dark:text-gray-400 placeholder-gray-400 focus:outline-none"
        />
        <button
          onClick={() => {
            const next = searchMode === 'text' ? 'semantic' : 'text'
            setSearchMode(next)
            if (searchQuery.trim()) handleSearch(searchQuery)
          }}
          className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-medium ${
            searchMode === 'semantic'
              ? 'bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300'
              : 'text-gray-400 hover:text-gray-600'
          }`}
          title={searchMode === 'semantic' ? 'Switch to text search' : 'Switch to semantic search'}
        >
          AI
        </button>
        {isSearching && <span className="text-[9px] text-gray-400">...</span>}
      </div>

      {/* Bookmarks list */}
      <div className="flex items-center gap-0.5 overflow-x-auto px-3 py-0.5">
        {bookmarks.length === 0 ? (
          <span className="text-[11px] text-gray-400 py-0.5">
            {searchQuery ? 'No bookmarks found' : 'No bookmarks \u2014 press Cmd+D to add'}
          </span>
        ) : (
          bookmarks.slice(0, 30).map((bm) => (
            <div key={bm.id} className="group flex items-center">
              <button
                onClick={() => onNavigate(bm.url)}
                className="flex shrink-0 items-center gap-1 rounded px-2 py-0.5 text-[11px]
                  text-gray-600 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-700"
                title={bm.url}
              >
                {bm.faviconUrl && (
                  <img src={bm.faviconUrl} alt="" className="h-3 w-3" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                )}
                <span className="max-w-[100px] truncate">{bm.title}</span>
                {bm.score !== undefined && searchMode === 'semantic' && (
                  <span className="text-[8px] text-teal-500">{Math.round(bm.score * 100)}%</span>
                )}
              </button>
              <button
                onClick={(e) => handleRemove(bm.id, e)}
                className="ml-0.5 text-[8px] text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Remove bookmark"
              >
                &times;
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
