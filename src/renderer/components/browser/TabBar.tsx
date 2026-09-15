import { useState } from 'react'
import { useTabStore } from '../../store/tab-store'
import { Tooltip } from '../common/Tooltip'
import { ContextMenu, type ContextMenuEntry } from '../common/ContextMenu'
import { useContextMenu } from '../../hooks/useContextMenu'

export function TabBar(): React.ReactElement {
  const { tabs, activeTabId, createTab, closeTab, activateTab, reorderTabs, recentlyClosed, restoreTab } = useTabStore()
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const { menuVisible, menuX, menuY, menuItems, showMenu, hideMenu } = useContextMenu()

  const handleClose = (id: string, e: React.MouseEvent): void => {
    e.stopPropagation()
    closeTab(id)
  }

  // Drag and drop handlers
  const handleDragStart = (index: number, e: React.DragEvent): void => {
    setDragIndex(index)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', index.toString())
  }

  const handleDragOver = (index: number, e: React.DragEvent): void => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverIndex(index)
  }

  const handleDrop = (index: number): void => {
    if (dragIndex !== null && dragIndex !== index) {
      const tabIds = [...tabs.map((t) => t.id)]
      const [moved] = tabIds.splice(dragIndex, 1)
      tabIds.splice(index, 0, moved)
      reorderTabs(tabIds)
    }
    setDragIndex(null)
    setDragOverIndex(null)
  }

  const handleDragEnd = (): void => {
    setDragIndex(null)
    setDragOverIndex(null)
  }

  const buildTabMenuItems = (tab: { id: string; url: string; title: string }): ContextMenuEntry[] => {
    const tabIdx = tabs.findIndex((t) => t.id === tab.id)
    const otherTabIds = tabs.filter((t) => t.id !== tab.id).map((t) => t.id)
    const rightTabIds = tabs.slice(tabIdx + 1).map((t) => t.id)
    return [
      {
        label: 'Close Tab',
        danger: true,
        onClick: () => closeTab(tab.id),
      },
      {
        label: 'Close Other Tabs',
        disabled: otherTabIds.length === 0,
        onClick: () => otherTabIds.forEach((id) => closeTab(id)),
      },
      {
        label: 'Close Tabs to Right',
        disabled: rightTabIds.length === 0,
        onClick: () => rightTabIds.forEach((id) => closeTab(id)),
      },
      { separator: true } as ContextMenuEntry,
      {
        label: 'Duplicate Tab',
        onClick: () => createTab(tab.url),
      },
      {
        label: 'Copy Tab URL',
        onClick: () => {
          navigator.clipboard.writeText(tab.url).catch(() => {})
        },
      },
    ]
  }

  return (
    <div className="flex items-center bg-gray-100 dark:bg-gray-800 h-9 pl-20 pr-2 select-none drag-region border-b border-gray-200/80 dark:border-black/40 shadow-[inset_0_-1px_0_rgb(0_0_0/0.02)]">
      <div className="flex items-center gap-0.5 overflow-x-auto">
        {tabs.map((tab, index) => (
          <div
            key={tab.id}
            draggable
            onDragStart={(e) => handleDragStart(index, e)}
            onDragOver={(e) => handleDragOver(index, e)}
            onDrop={() => handleDrop(index)}
            onDragEnd={handleDragEnd}
            onClick={() => activateTab(tab.id)}
            onContextMenu={(e) => showMenu(e, buildTabMenuItems(tab))}
            className={`group flex items-center gap-1.5 px-3 py-1 rounded-t text-xs cursor-pointer flex-1 min-w-[100px] transition-colors ${
              dragOverIndex === index && dragIndex !== index
                ? 'border-l-2 border-blue-500'
                : ''
            } ${
              tab.id === activeTabId
                ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
            } ${dragIndex === index ? 'opacity-50' : ''}`}
          >
            {/* Favicon / loading spinner */}
            {tab.status === 'loading' ? (
              <span className="h-3 w-3 shrink-0 animate-spin rounded-full border-[1.5px] border-gray-300 border-t-indigo-500" />
            ) : tab.favicon ? (
              <img src={tab.favicon} alt="" className="h-3 w-3 shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
            ) : (
              <span className="h-3 w-3 shrink-0 text-[10px] opacity-40">&#9675;</span>
            )}

            {/* Title with tooltip preview */}
            <Tooltip content={tab.url} position="bottom" className="flex-1 min-w-0">
              <span className="truncate block w-full">{tab.title || 'Loading...'}</span>
            </Tooltip>

            {/* Close button */}
            <button
              onClick={(e) => handleClose(tab.id, e)}
              className="shrink-0 h-4 w-4 leading-none flex items-center justify-center text-[11px] text-gray-400 hover:text-gray-800 dark:hover:text-gray-100 rounded-full hover:bg-gray-300/70 dark:hover:bg-gray-600 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all duration-150"
            >
              &times;
            </button>
          </div>
        ))}

        {/* Recently closed tabs — show restore hint */}
        {recentlyClosed.length > 0 && (
          <button
            onClick={() => restoreTab(recentlyClosed[0])}
            className="flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium text-gray-500 hover:bg-gray-200/80 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors"
          >
            <svg viewBox="0 0 14 14" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round"><path d="M2 7a5 5 0 1 1 1.5 3.6M2 10.5V7.5h3" /></svg>
            Restore ({recentlyClosed.length})
          </button>
        )}

        {/* New tab button */}
        <button
          onClick={() => createTab()}
          className="ml-1 mr-1 shrink-0 flex items-center justify-center h-6 w-6 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100 text-base leading-none rounded-md hover:bg-gray-200/80 dark:hover:bg-gray-700 transition-colors"
          title="New Tab (Cmd+T)"
        >
          <svg viewBox="0 0 14 14" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round"><path d="M7 2v10M2 7h10" /></svg>
        </button>
      </div>
      <ContextMenu items={menuItems} x={menuX} y={menuY} visible={menuVisible} onClose={hideMenu} />
    </div>
  )
}
