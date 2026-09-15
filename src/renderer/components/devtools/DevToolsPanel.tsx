import { useDevToolsStore } from '../../store/devtools-store'
import { ConsolePanel } from './ConsolePanel'
import { NetworkPanel } from './NetworkPanel'
import { ElementsPanel } from './ElementsPanel'
import { StoragePanel } from './StoragePanel'
import { AIPanel } from './AIPanel'

type Tab = 'console' | 'network' | 'elements' | 'storage' | 'ai'

const TABS: { key: Tab; label: string }[] = [
  { key: 'console', label: 'Console' },
  { key: 'network', label: 'Network' },
  { key: 'elements', label: 'Elements' },
  { key: 'ai', label: 'AI' },
  { key: 'storage', label: 'Storage' },
]

interface DevToolsPanelProps {
  tabId: string
}

export function DevToolsPanel({ tabId }: DevToolsPanelProps): React.ReactElement {
  const { activeTab, height, setActiveTab, setHeight, toggle } = useDevToolsStore()

  const handleResizeStart = (e: React.MouseEvent): void => {
    e.preventDefault()
    const startY = e.clientY
    const startH = height
    const onMove = (ev: MouseEvent): void => {
      setHeight(startH - (ev.clientY - startY))
    }
    const onUp = (): void => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.body.style.cursor = 'ns-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  return (
    <div
      className="flex shrink-0 flex-col border-t border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-900"
      style={{ height }}
    >
      {/* Drag handle */}
      <div
        onMouseDown={handleResizeStart}
        className="h-1 shrink-0 cursor-ns-resize bg-gray-200 hover:bg-blue-400 dark:bg-gray-700 dark:hover:bg-blue-600"
      />

      {/* Tab bar */}
      <div className="flex shrink-0 items-center border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-850">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-3 py-1.5 text-[11px] font-medium ${
              activeTab === tab.key
                ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
        <div className="flex-1" />
        <button
          onClick={toggle}
          className="px-2 py-1 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          title="Close DevTools"
        >
          &#10005;
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'console' && <ConsolePanel tabId={tabId} />}
        {activeTab === 'network' && <NetworkPanel tabId={tabId} />}
        {activeTab === 'elements' && <ElementsPanel tabId={tabId} />}
        {activeTab === 'ai' && <AIPanel />}
        {activeTab === 'storage' && <StoragePanel tabId={tabId} />}
      </div>
    </div>
  )
}
