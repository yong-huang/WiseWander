interface Capability {
  id: string
  name: string
  icon: string
  description: string
}

const capabilities: Capability[] = [
  {
    id: 'design-analyzer',
    name: 'Design Analyzer',
    icon: '🎨',
    description: 'Analyze webpage design style and generate HTML templates',
  },
  {
    id: 'web-crawler',
    name: 'Web Crawler',
    icon: '🕷️',
    description: 'Crawl pages and extract images or save full pages',
  },
  {
    id: 'markdown-exporter',
    name: 'Markdown Exporter',
    icon: '📝',
    description: 'Convert pages to clean Markdown',
  },
  {
    id: 'translate',
    name: 'Translate',
    icon: '🌐',
    description: 'Translate text between languages',
  },
  {
    id: 'screenshot',
    name: 'Screenshot',
    icon: '📷',
    description: 'Capture visible area or full-page screenshots',
  },
  {
    id: 'data-extractor',
    name: 'Data Extractor',
    icon: '📊',
    description: 'Extract structured data (JSON/CSV) from web pages',
  },
  {
    id: 'page-monitor',
    name: 'Page Monitor',
    icon: '🔔',
    description: 'Track page changes and get notified',
  },
  {
    id: 'multi-tab-analysis',
    name: 'Multi-Tab Analysis',
    icon: '🔍',
    description: 'Compare and analyze content across multiple tabs',
  },
  {
    id: 'css-editor',
    name: 'CSS Editor',
    icon: '🎯',
    description: 'Describe styles in natural language, get live CSS',
  },
  {
    id: 'accessibility',
    name: 'Accessibility',
    icon: '♿',
    description: 'Audit pages for accessibility issues with AI',
  },
]

interface CapabilityListPanelProps {
  onSelectCapability: (id: string) => void
}

export function CapabilityListPanel({ onSelectCapability }: CapabilityListPanelProps): React.ReactElement {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-gray-200 p-4 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Tools</h3>
        <p className="mt-1 text-xs text-gray-400">Browser capabilities powered by AI</p>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        <div className="grid grid-cols-2 gap-3">
          {capabilities.map((cap) => (
            <button
              key={cap.id}
              onClick={() => onSelectCapability(cap.id)}
              className="flex flex-col items-center gap-2 rounded-xl border border-gray-200 bg-white p-4
                text-center transition-colors hover:border-teal-300 hover:bg-teal-50
                dark:border-gray-700 dark:bg-gray-800 dark:hover:border-teal-600 dark:hover:bg-gray-750"
            >
              <span className="text-2xl">{cap.icon}</span>
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{cap.name}</span>
              <span className="text-[10px] leading-tight text-gray-400">{cap.description}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
