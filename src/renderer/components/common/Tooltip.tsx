import { useState, useRef } from 'react'

interface TooltipProps {
  content: string
  children: React.ReactNode
  position?: 'top' | 'bottom' | 'left' | 'right'
  className?: string
}

export function Tooltip({ content, children, position = 'top', className }: TooltipProps): React.ReactElement {
  const [visible, setVisible] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const show = (): void => {
    timeoutRef.current = setTimeout(() => setVisible(true), 400)
  }

  const hide = (): void => {
    clearTimeout(timeoutRef.current)
    setVisible(false)
  }

  const posClasses: Record<string, string> = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-1',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-1',
    left: 'right-full top-1/2 -translate-y-1/2 mr-1',
    right: 'left-full top-1/2 -translate-y-1/2 ml-1',
  }

  return (
    <div className={`relative ${className ?? 'inline-flex'}`} onMouseEnter={show} onMouseLeave={hide}>
      {children}
      {visible && (
        <div
          className={`pointer-events-none absolute z-50 whitespace-nowrap rounded-md
            bg-gray-800 px-2 py-1 text-xs text-white shadow-lg
            ${posClasses[position]}`}
        >
          {content}
        </div>
      )}
    </div>
  )
}
