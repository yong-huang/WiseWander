import { useState, useEffect, useRef } from 'react'

interface Command {
  id: string
  label: string
  category: string
  icon?: string
  action: () => void
}

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
  commands: Command[]
}

export function CommandPalette({ isOpen, onClose, commands }: CommandPaletteProps): React.ReactElement {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  const filtered = commands.filter((cmd) =>
    cmd.label.toLowerCase().includes(query.toLowerCase())
  )

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && filtered[selectedIndex]) {
      filtered[selectedIndex].action()
      onClose()
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  if (!isOpen) return <></>

  const grouped = new Map<string, Command[]>()
  for (const cmd of filtered) {
    const list = grouped.get(cmd.category) ?? []
    list.push(cmd)
    grouped.set(cmd.category, list)
  }

  let flatIndex = 0

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-gray-900/25 backdrop-blur-[2px] animate-fade-in pt-[20vh]" onClick={onClose}>
      <div
        className="w-[560px] overflow-hidden rounded-2xl border border-gray-200/70 bg-white/95 shadow-[var(--shadow-overlay)] backdrop-blur-xl animate-slide-up dark:border-gray-700/70 dark:bg-gray-900/95"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <div className="flex items-center border-b border-gray-200 px-4 dark:border-gray-700">
          <svg viewBox="0 0 16 16" className="mr-2.5 h-4 w-4 text-indigo-500" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round"><path d="M7 11.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zM14 14l-3.2-3.2" /></svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command..."
            className="flex-1 py-3 text-sm outline-none bg-transparent dark:text-gray-100"
          />
          <kbd className="rounded-md border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] font-medium text-gray-400 dark:border-gray-700 dark:bg-gray-800">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[300px] overflow-y-auto p-2">
          {filtered.length === 0 && (
            <div className="py-8 text-center text-sm text-gray-400">No results</div>
          )}
          {Array.from(grouped.entries()).map(([category, cmds]) => (
            <div key={category}>
              <div className="px-2 py-1 text-[10px] font-semibold uppercase text-gray-400">
                {category}
              </div>
              {cmds.map((cmd) => {
                const idx = flatIndex++
                return (
                  <button
                    key={cmd.id}
                    onClick={() => {
                      cmd.action()
                      onClose()
                    }}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`flex w-full items-center rounded-md px-3 py-2 text-left text-sm ${
                      idx === selectedIndex
                        ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-300 dark:ring-indigo-500/30'
                        : 'text-gray-700 dark:text-gray-300'
                    } transition-colors`}
                  >
                    {cmd.icon && <span className="mr-2">{cmd.icon}</span>}
                    <span>{cmd.label}</span>
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
