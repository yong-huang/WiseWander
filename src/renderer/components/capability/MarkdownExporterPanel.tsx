import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useCapabilityStore } from '../../store/capability-store'
import { markdownComponents } from '../ai/StreamingText'

interface MarkdownExporterPanelProps {
  tabId: string
  onBack: () => void
}

export function MarkdownExporterPanel({ tabId, onBack }: MarkdownExporterPanelProps): React.ReactElement {
  const {
    mdStatus, mdMarkdown, mdMeta, mdError, mdViewMode,
    runMarkdownExport, setMdViewMode,
  } = useCapabilityStore()

  const [copied, setCopied] = useState(false)

  const isWorking = mdStatus === 'extracting' || mdStatus === 'converting'

  const statusLabels: Record<string, string> = {
    idle: 'Ready',
    extracting: 'Reading page...',
    converting: 'Converting to Markdown...',
    done: 'Export ready',
    error: 'Error',
  }

  const handleCopy = () => {
    if (!mdMarkdown) return
    navigator.clipboard.writeText(mdMarkdown).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const handleExport = async () => {
    if (!mdMarkdown || !mdMeta) return
    const defaultName = `${(mdMeta.title || 'article').replace(/[^a-zA-Z0-9\u4e00-\u9fff-_ ]/g, '').slice(0, 60)}.md`
    await window.api.capabilityMdExport(mdMarkdown, defaultName)
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-gray-200 px-3 py-2 dark:border-gray-700">
        <button
          onClick={onBack}
          className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          ← Tools
        </button>
        <span className="text-xs text-gray-300 dark:text-gray-600">|</span>
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Markdown Exporter</h3>
      </div>

      {/* Extract button */}
      <div className="border-b border-gray-200 p-3 dark:border-gray-700">
        <button
          onClick={() => void runMarkdownExport(tabId)}
          disabled={isWorking || !tabId}
          className="w-full rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-3 py-2
            text-sm font-medium text-white
            hover:from-violet-700 hover:to-indigo-700
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-all"
        >
          {mdStatus === 'idle' || mdStatus === 'error'
            ? 'Extract & Convert'
            : mdStatus === 'extracting'
            ? 'Reading page...'
            : mdStatus === 'converting'
            ? 'Converting to Markdown...'
            : 'Re-extract Page'}
        </button>

        {mdStatus !== 'idle' && mdStatus !== 'done' && (
          <div className="mt-2 flex items-center gap-2">
            {isWorking && (
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-violet-600 border-t-transparent" />
            )}
            <span className="text-[11px] text-gray-500 dark:text-gray-400">{statusLabels[mdStatus]}</span>
          </div>
        )}
      </div>

      {/* Error */}
      {mdError && (
        <div className="border-b border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
          {mdError}
        </div>
      )}

      {/* Stats bar */}
      {mdMeta && mdStatus === 'done' && (
        <div className="border-b border-gray-200 px-3 py-2 dark:border-gray-700 animate-in fade-in duration-300">
          <div className="flex gap-2 flex-wrap">
            <StatChip label={`${mdMeta.wordCount.toLocaleString()} words`} />
            <StatChip label={`${mdMeta.readingTime} min read`} />
            <StatChip label={`${mdMeta.imageCount} images`} />
            <StatChip label={`${mdMeta.linkCount} links`} />
          </div>
          {mdMeta.byline && (
            <p className="mt-1 text-[10px] text-gray-400">By {mdMeta.byline}</p>
          )}
        </div>
      )}

      {/* Content area */}
      {mdMarkdown && mdStatus === 'done' && (
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* View mode tabs */}
          <div className="flex border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setMdViewMode('source')}
              className={`flex-1 px-3 py-1.5 text-xs font-medium transition-colors ${
                mdViewMode === 'source'
                  ? 'border-b-2 border-violet-600 text-violet-700 dark:text-violet-400'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
              }`}
            >
              Source
            </button>
            <button
              onClick={() => setMdViewMode('preview')}
              className={`flex-1 px-3 py-1.5 text-xs font-medium transition-colors ${
                mdViewMode === 'preview'
                  ? 'border-b-2 border-violet-600 text-violet-700 dark:text-violet-400'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
              }`}
            >
              Preview
            </button>
          </div>

          {/* View content */}
          <div className="flex-1 overflow-y-auto">
            {mdViewMode === 'source' ? (
              <pre className="h-full overflow-auto bg-gray-900 p-3 text-xs leading-relaxed text-gray-100 font-mono dark:bg-gray-950">
                {mdMarkdown}
              </pre>
            ) : (
              <div className="p-3 markdown-body text-sm leading-relaxed">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                  {mdMarkdown}
                </ReactMarkdown>
              </div>
            )}
          </div>

          {/* Bottom action bar */}
          <div className="flex gap-2 border-t border-gray-200 p-3 dark:border-gray-700">
            <button
              onClick={handleCopy}
              className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium
                text-gray-700 transition-colors hover:bg-gray-50
                dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <button
              onClick={() => void handleExport()}
              className="flex-1 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white
                hover:bg-violet-700 transition-colors"
            >
              Export .md
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {mdStatus === 'idle' && (
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="text-center">
            <div className="text-3xl mb-2 opacity-50">📝</div>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Navigate to an article or blog post,<br />
              then click Extract & Convert
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

/** Small stat chip for the stats bar */
function StatChip({ label }: { label: string }): React.ReactElement {
  return (
    <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
      {label}
    </span>
  )
}
