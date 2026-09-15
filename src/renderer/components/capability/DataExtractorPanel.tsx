import { useState } from 'react'
import { useCapabilityStore } from '../../store/capability-store'

interface DataExtractorPanelProps {
  tabId: string
  onBack: () => void
}

export function DataExtractorPanel({ tabId, onBack }: DataExtractorPanelProps): React.ReactElement {
  const { extractionStatus, extractionResult, extractionError, runExtraction, exportExtraction, resetExtraction } =
    useCapabilityStore()

  const [description, setDescription] = useState('')
  const [format, setFormat] = useState<'json' | 'csv'>('json')
  const [cssSelector, setCssSelector] = useState('')

  const handleExtract = (): void => {
    if (!description.trim()) return
    runExtraction(tabId, description.trim(), format, cssSelector.trim() || undefined)
  }

  const handleExport = async (): Promise<void> => {
    await exportExtraction()
  }

  const handleReset = (): void => {
    resetExtraction()
    setDescription('')
    setCssSelector('')
  }

  const isRunning = extractionStatus === 'extracting'

  const renderResult = (): React.ReactNode => {
    if (!extractionResult) return null

    if (format === 'json') {
      const data = extractionResult.data
      const rows = Array.isArray(data) ? data : [data]
      if (rows.length === 0) return <p className="text-gray-500 text-sm">No matching data found.</p>

      const keys = Object.keys(rows[0] as Record<string, unknown>)

      return (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                {keys.map((key) => (
                  <th key={key} className="px-2 py-1 text-left font-medium text-gray-600 dark:text-gray-400">{key}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 50).map((row, i) => (
                <tr key={i} className="border-b border-gray-100 dark:border-gray-800">
                  {keys.map((key) => (
                    <td key={key} className="px-2 py-1 text-gray-700 dark:text-gray-300">
                      {String((row as Record<string, unknown>)[key] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > 50 && (
            <p className="mt-2 text-xs text-gray-400">Showing 50 of {rows.length} rows</p>
          )}
        </div>
      )
    }

    // CSV format
    return (
      <pre className="max-h-60 overflow-auto rounded bg-gray-50 p-2 text-xs dark:bg-gray-800">
        {extractionResult.rawText}
      </pre>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-gray-200 p-3 dark:border-gray-700">
        <button onClick={onBack} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">&larr;</button>
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Data Extractor</span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Description */}
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            What to extract
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g., All product names, prices, and ratings"
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm
              placeholder-gray-400 focus:border-teal-400 focus:outline-none
              dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            rows={3}
          />
        </div>

        {/* CSS Selector (optional) */}
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            CSS Selector (optional)
          </label>
          <input
            value={cssSelector}
            onChange={(e) => setCssSelector(e.target.value)}
            placeholder="e.g., .product-list > .item"
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm
              placeholder-gray-400 focus:border-teal-400 focus:outline-none
              dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
          />
        </div>

        {/* Format */}
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Format</label>
          <div className="flex gap-2">
            <button
              onClick={() => setFormat('json')}
              className={`rounded-lg px-4 py-1.5 text-xs font-medium transition-colors ${
                format === 'json'
                  ? 'bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
              }`}
            >
              JSON
            </button>
            <button
              onClick={() => setFormat('csv')}
              className={`rounded-lg px-4 py-1.5 text-xs font-medium transition-colors ${
                format === 'csv'
                  ? 'bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
              }`}
            >
              CSV
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={handleExtract}
            disabled={isRunning || !description.trim()}
            className="flex-1 rounded-lg bg-teal-500 px-4 py-2 text-xs font-medium text-white
              transition-colors hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRunning ? 'Extracting...' : 'Extract'}
          </button>
          {extractionStatus === 'done' && (
            <>
              <button
                onClick={handleExport}
                className="rounded-lg bg-gray-100 px-3 py-2 text-xs font-medium text-gray-700
                  hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Export
              </button>
              <button
                onClick={handleReset}
                className="rounded-lg bg-gray-100 px-3 py-2 text-xs font-medium text-gray-700
                  hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Reset
              </button>
            </>
          )}
        </div>

        {/* Error */}
        {extractionError && (
          <div className="rounded-lg bg-red-50 p-3 text-xs text-red-600 dark:bg-red-900/20 dark:text-red-400">
            {extractionError}
          </div>
        )}

        {/* Result */}
        {extractionStatus === 'done' && (
          <div className="mt-2">
            <h4 className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Results</h4>
            {renderResult()}
          </div>
        )}
      </div>
    </div>
  )
}
