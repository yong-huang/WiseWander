import { useState, useEffect, useRef } from 'react'

export interface ContextMenuItem {
  label: string
  shortcut?: string
  onClick: () => void
  disabled?: boolean
  danger?: boolean
  separator?: never
}

export interface ContextMenuSeparator {
  separator: true
}

export type ContextMenuEntry = ContextMenuItem | ContextMenuSeparator

interface ContextMenuProps {
  items: ContextMenuEntry[]
  x: number
  y: number
  visible: boolean
  onClose: () => void
}

export function ContextMenu({ items, x, y, visible, onClose }: ContextMenuProps): React.ReactElement | null {
  const menuRef = useRef<HTMLDivElement>(null)
  const [adjustedPos, setAdjustedPos] = useState({ x, y })

  // Adjust position to stay within viewport
  useEffect(() => {
    if (!visible || !menuRef.current) return
    const rect = menuRef.current.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    let newX = x
    let newY = y
    if (x + rect.width > vw) newX = x - rect.width
    if (newX < 0) newX = 4
    if (y + rect.height > vh) newY = y - rect.height
    if (newY < 0) newY = 4
    setAdjustedPos({ x: newX, y: newY })
  }, [visible, x, y, items])

  // Close on click outside, Escape key, scroll
  useEffect(() => {
    if (!visible) return
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    const handleScroll = () => onClose()
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleEscape)
      window.addEventListener('scroll', handleScroll, true)
    }, 0)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
      window.removeEventListener('scroll', handleScroll, true)
    }
  }, [visible, onClose])

  if (!visible) return null

  return (
    <div
      ref={menuRef}
      className="fixed z-[9999] min-w-[180px] overflow-hidden rounded-xl border border-gray-200/80 dark:border-gray-700/80 bg-white/95 dark:bg-gray-800/95 backdrop-blur-md shadow-[var(--shadow-overlay)] py-1 text-sm animate-fade-in"
      style={{ left: adjustedPos.x, top: adjustedPos.y }}
    >
      {items.map((item, i) =>
        'separator' in item && item.separator ? (
          <div key={`sep-${i}`} className="my-1 border-t border-gray-200/70 dark:border-gray-700/70" />
        ) : (
          <button
            key={item.label}
            onClick={() => {
              if (!item.disabled) item.onClick()
              onClose()
            }}
            disabled={item.disabled}
            className={`w-full text-left px-3 py-1.5 flex items-center justify-between ${
              item.danger
                ? 'text-red-600 dark:text-red-400'
                : 'text-gray-700 dark:text-gray-200'
            } ${
              item.disabled
                ? 'opacity-40 cursor-default'
                : 'hover:bg-indigo-50 dark:hover:bg-indigo-500/15 cursor-pointer'
            } transition-colors duration-150`}
          >
            <span>{item.label}</span>
            {item.shortcut && (
              <span className="ml-4 text-xs text-gray-400 dark:text-gray-500">{item.shortcut}</span>
            )}
          </button>
        )
      )}
    </div>
  )
}
