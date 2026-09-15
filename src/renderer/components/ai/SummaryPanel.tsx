import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

type SummaryLength = 'brief' | 'standard' | 'detailed'

interface SummaryPanelProps {
  summary: string
  isGenerating: boolean
  onGenerate: (length: SummaryLength) => void
  onCopy: () => void
  onExport: () => void
}

export function SummaryPanel({
  summary,
  isGenerating,
  onGenerate,
  onCopy,
  onExport,
}: SummaryPanelProps): React.ReactElement {
  const [selectedLength, setSelectedLength] = useState<SummaryLength>('standard')

  return (
    <div className="flex h-full flex-col p-3">
      {/* Length selector */}
      <div className="mb-3 flex items-center gap-1">
        {(['brief', 'standard', 'detailed'] as const).map((len) => (
          <button
            key={len}
            onClick={() => setSelectedLength(len)}
            className={`rounded-md px-2.5 py-1 text-xs capitalize ${
              selectedLength === len
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            {len}
          </button>
        ))}
      </div>

      {/* Generate button */}
      {!summary && (
        <button
          onClick={() => onGenerate(selectedLength)}
          disabled={isGenerating}
          className="mb-3 w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white
            hover:bg-blue-700 disabled:opacity-50"
        >
          {isGenerating ? 'Generating...' : 'Generate Summary'}
        </button>
      )}

      {/* Summary content */}
      <div className="flex-1 overflow-y-auto">
        {summary ? (
          <div className="markdown-body rounded-lg bg-gray-50 p-3 text-sm leading-relaxed text-gray-700 dark:bg-gray-800 dark:text-gray-300">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {summary}
            </ReactMarkdown>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center pt-16 text-center">
            <div className="mb-3 text-4xl opacity-20">📄</div>
            <p className="text-sm text-gray-400">
              Click "Generate Summary" to get a page summary
            </p>
          </div>
        )}
      </div>

      {/* Action buttons */}
      {summary && (
        <div className="mt-3 flex gap-2">
          <button
            onClick={onCopy}
            className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs
              hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800"
          >
            Copy
          </button>
          <button
            onClick={() => {
              onGenerate(selectedLength)
            }}
            disabled={isGenerating}
            className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs
              hover:bg-gray-50 dark:border-gray-600 disabled:opacity-50"
          >
            {isGenerating ? 'Regenerating...' : 'Regenerate'}
          </button>
          <button
            onClick={onExport}
            className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs
              hover:bg-gray-50 dark:border-gray-600"
          >
            Export
          </button>
        </div>
      )}
    </div>
  )
}
