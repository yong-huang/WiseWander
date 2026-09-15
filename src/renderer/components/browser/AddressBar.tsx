import { useState, useCallback, useEffect, useRef } from 'react'
import { useTabStore } from '../../store/tab-store'
import { useSettingsStore } from '../../store/settings-store'
import { useDevToolsStore } from '../../store/devtools-store'
import { ContextMenu, type ContextMenuEntry } from '../common/ContextMenu'
import { useContextMenu } from '../../hooks/useContextMenu'

interface AddressBarProps {
  onNavigate: (url: string) => void
  url: string
  onOpenSettings?: () => void
}

export function AddressBar({ onNavigate, url, onOpenSettings }: AddressBarProps): React.ReactElement {
  const [inputValue, setInputValue] = useState(url)
  const [isFocused, setIsFocused] = useState(false)
  const [isBookmarked, setIsBookmarked] = useState(false)
  const { toggleSidebar, sidebarOpen } = useSettingsStore()
  const { toggle: toggleDevTools, isOpen: devToolsOpen } = useDevToolsStore()
  const { activeTabId, updateTab } = useTabStore()
  const activeTab = useTabStore((s) => s.tabs.find((t) => t.id === s.activeTabId))
  const prevUrlRef = useRef(url)
  const inputRef = useRef<HTMLInputElement>(null)
  const { menuVisible, menuX, menuY, menuItems, showMenu, hideMenu } = useContextMenu()

  // Sync input with current tab URL (only when not focused)
  useEffect(() => {
    if (!isFocused && url !== prevUrlRef.current) {
      setInputValue(url)
      prevUrlRef.current = url
    }
  }, [url, isFocused])

  // Check if current URL is bookmarked (on URL change and after any bookmark toggle)
  const checkBookmarked = useCallback((): void => {
    if (!url || url === 'about:blank') {
      setIsBookmarked(false)
      return
    }
    window.api.bookmarkList().then((list: unknown) => {
      const items = list as Array<{ url: string }>
      setIsBookmarked(items.some((b) => b.url === url))
    }).catch(() => {})
  }, [url])

  useEffect(() => {
    checkBookmarked()
    window.addEventListener('bookmark-changed', checkBookmarked)
    return () => { window.removeEventListener('bookmark-changed', checkBookmarked) }
  }, [checkBookmarked])

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    const input = inputRef.current
    if (!input) return
    const selStart = input.selectionStart ?? 0
    const selEnd = input.selectionEnd ?? 0
    const hasSelection = selStart !== selEnd
    const value = input.value
    const selectedText = hasSelection ? value.slice(selStart, selEnd) : ''

    const items: ContextMenuEntry[] = [
      {
        label: 'Cut',
        disabled: !hasSelection,
        onClick: () => {
          navigator.clipboard.writeText(selectedText)
          setInputValue(value.slice(0, selStart) + value.slice(selEnd))
        },
      },
      {
        label: 'Copy',
        disabled: !hasSelection,
        onClick: () => navigator.clipboard.writeText(selectedText),
      },
      {
        label: 'Paste',
        onClick: () => {
          navigator.clipboard.readText().then((text) => {
            const start = input.selectionStart ?? inputValue.length
            const end = input.selectionEnd ?? inputValue.length
            const newValue = inputValue.slice(0, start) + text + inputValue.slice(end)
            setInputValue(newValue)
          }).catch(() => {})
        },
      },
      {
        label: 'Select All',
        disabled: value.length === 0,
        onClick: () => input.select(),
      },
      { separator: true } as ContextMenuEntry,
      {
        label: 'Paste and Go',
        onClick: () => {
          navigator.clipboard.readText().then((text) => {
            setInputValue(text)
            // Trigger navigation with the pasted text
            const target = text.trim()
            if (target) {
              let navUrl: string
              if (target.startsWith('http://') || target.startsWith('https://')) {
                navUrl = target
              } else if (
                target.startsWith('localhost') ||
                target.startsWith('127.0.0.1') ||
                target.startsWith('0.0.0.0') ||
                target.startsWith('[::1]')
              ) {
                navUrl = `http://${target}`
              } else if (target.includes('.') && !target.includes(' ')) {
                navUrl = `https://${target}`
              } else {
                navUrl = `https://www.google.com/search?q=${encodeURIComponent(target)}`
              }
              onNavigate(navUrl)
              if (activeTabId) updateTab(activeTabId, { url: navUrl, status: 'loading' })
            }
          }).catch(() => {})
        },
      },
      { separator: true } as ContextMenuEntry,
      {
        label: 'Copy URL',
        disabled: !value,
        onClick: () => navigator.clipboard.writeText(value),
      },
    ]
    showMenu(e, items)
  }, [inputValue, activeTabId, onNavigate, updateTab, showMenu])

  const handleNavigate = useCallback((): void => {
    const input = inputValue.trim()
    if (!input || !activeTabId) return

    let target: string
    if (input.startsWith('http://') || input.startsWith('https://')) {
      target = input
    } else if (
      input.startsWith('localhost') ||
      input.startsWith('127.0.0.1') ||
      input.startsWith('0.0.0.0') ||
      input.startsWith('[::1]')
    ) {
      target = `http://${input}`
    } else if (input.includes('.') && !input.includes(' ')) {
      target = `https://${input}`
    } else {
      target = `https://www.google.com/search?q=${encodeURIComponent(input)}`
    }

    onNavigate(target)
    updateTab(activeTabId, { url: target, status: 'loading' })
  }, [inputValue, activeTabId, onNavigate, updateTab])

  const getActiveWebview = (): Electron.WebviewTag | null => {
    const el = document.querySelector(`webview[data-tab-id="${activeTabId}"]`)
    return (el as Electron.WebviewTag) ?? null
  }

  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50/95 dark:bg-gray-850 border-b border-gray-200/80 dark:border-gray-700/80 drag-region">
      {/* Navigation buttons */}
      <div className="flex items-center gap-0.5">
        <button
          onClick={() => getActiveWebview()?.goBack()}
          className="p-1.5 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 rounded-full hover:bg-gray-200/80 dark:hover:bg-gray-700 active:scale-95 transition-all"
        >
          <span className="text-base leading-none">&larr;</span>
        </button>
        <button
          onClick={() => getActiveWebview()?.goForward()}
          className="p-1.5 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 rounded-full hover:bg-gray-200/80 dark:hover:bg-gray-700 active:scale-95 transition-all"
        >
          <span className="text-base leading-none">&rarr;</span>
        </button>
        <button
          onClick={() => getActiveWebview()?.reload()}
          className="p-1.5 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 rounded-full hover:bg-gray-200/80 dark:hover:bg-gray-700 active:scale-95 transition-all"
        >
          <span className="text-base leading-none">&#8635;</span>
        </button>
      </div>

      {/* URL Input */}
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && handleNavigate()}
        onFocus={(e) => {
          setIsFocused(true)
          e.target.select()
        }}
        onBlur={() => setIsFocused(false)}
        onContextMenu={handleContextMenu}
        className="flex-1 px-4 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600/80 rounded-full shadow-sm focus:outline-none focus:border-indigo-400 dark:focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:text-gray-100 dark:placeholder-gray-500 transition-all duration-150"
        placeholder="Search or enter URL..."
      />

      {/* Action buttons */}
      <div className="flex items-center gap-0.5">
        <button
          onClick={async () => {
            if (activeTabId) {
              const result = await window.api.bookmarkAdd(
                activeTab?.title || 'Untitled',
                inputValue
              ) as { action: 'added' | 'removed' }
              setIsBookmarked(result.action === 'added')
              window.dispatchEvent(new CustomEvent('bookmark-changed'))
            }
          }}
          className={`p-1.5 rounded-full active:scale-90 transition-all ${
            isBookmarked
              ? 'text-amber-500 dark:text-amber-400'
              : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 hover:bg-gray-200/80 dark:hover:bg-gray-700'
          }`}
          title={isBookmarked ? 'Remove bookmark (Cmd+D)' : 'Bookmark this page (Cmd+D)'}
        >
          {isBookmarked ? '\u2605' : '\u2606'}
        </button>
        <button
          onClick={async () => {
            if (activeTabId && activeTab?.url && activeTab.url !== 'about:blank') {
              await window.api.readingListAdd({
                url: activeTab.url,
                title: activeTab.title || 'Untitled',
              })
            }
          }}
          className="p-1.5 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 rounded-full hover:bg-gray-200/80 dark:hover:bg-gray-700 active:scale-95 transition-all"
          title="Add to Reading Queue"
        >
          &#43;
        </button>
        <button
          onClick={toggleSidebar}
          className={`p-1.5 rounded-full active:scale-95 transition-all ${
            sidebarOpen
              ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300'
              : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 hover:bg-gray-200/80 dark:hover:bg-gray-700'
          }`}
          title="Toggle AI Sidebar (Cmd+Shift+S)"
        >
          &#9776;
        </button>
        <button
          onClick={toggleDevTools}
          className={`p-1.5 rounded-full active:scale-95 transition-all ${
            devToolsOpen
              ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300'
              : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 hover:bg-gray-200/80 dark:hover:bg-gray-700'
          }`}
          title="Developer Tools (F12)"
        >
          <span className="text-[10px] font-mono">{"</>"}</span>
        </button>
        <button
          onClick={onOpenSettings}
          className="p-1.5 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 rounded-full hover:bg-gray-200/80 dark:hover:bg-gray-700 active:scale-95 transition-all"
          title="Settings (Cmd+,)"
        >
          &#9881;
        </button>
      </div>
      <ContextMenu items={menuItems} x={menuX} y={menuY} visible={menuVisible} onClose={hideMenu} />
    </div>
  )
}
