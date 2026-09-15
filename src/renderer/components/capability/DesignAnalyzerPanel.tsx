import { useCapabilityStore } from '../../store/capability-store'
import { TemplatePreview } from './TemplatePreview'

interface DesignAnalyzerPanelProps {
  tabId: string
  onBack: () => void
}

export function DesignAnalyzerPanel({ tabId, onBack }: DesignAnalyzerPanelProps): React.ReactElement {
  const { designStatus, designResult, designError, designStyleData, runAnalysis } = useCapabilityStore()

  const statusLabels: Record<string, string> = {
    idle: 'Ready',
    extracting: 'Extracting styles...',
    analyzing: 'AI analyzing design...',
    done: 'Analysis complete',
    error: 'Error',
  }

  const colorPalette = designStyleData?.colors.primary ?? []

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
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Design Analyzer</h3>
      </div>

      {/* Analyze button + status */}
      <div className="border-b border-gray-200 p-3 dark:border-gray-700">
        <button
          onClick={() => void runAnalysis(tabId)}
          disabled={designStatus === 'extracting' || designStatus === 'analyzing' || !tabId}
          className="w-full rounded-lg bg-teal-600 px-3 py-2 text-sm font-medium text-white
            hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {designStatus === 'extracting'
            ? 'Extracting styles...'
            : designStatus === 'analyzing'
            ? 'AI analyzing...'
            : 'Analyze Current Page'}
        </button>

        {designStatus !== 'idle' && (
          <div className="mt-2 flex items-center gap-2">
            {(designStatus === 'extracting' || designStatus === 'analyzing') && (
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
            )}
            <span className="text-[11px] text-gray-500">{statusLabels[designStatus]}</span>
          </div>
        )}
      </div>

      {/* Error */}
      {designError && (
        <div className="border-b border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
          {designError}
        </div>
      )}

      {/* Results */}
      {designResult && (
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {/* Color palette */}
          {colorPalette.length > 0 && (
            <div>
              <h4 className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">Color Palette</h4>
              <div className="flex gap-2 flex-wrap">
                {colorPalette.map((color, i) => (
                  <div key={i} className="flex flex-col items-center gap-1">
                    <div
                      className="h-8 w-8 rounded-full border border-gray-200 dark:border-gray-600"
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                    <span className="text-[9px] text-gray-400">{color}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Analysis text */}
          {designResult.analysis && (
            <div>
              <h4 className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">Analysis</h4>
              <div className="rounded-lg bg-gray-50 p-3 text-xs leading-relaxed text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                {designResult.analysis}
              </div>
            </div>
          )}

          {/* Template preview */}
          {designResult.templateHtml && (
            <div>
              <h4 className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">Generated Template</h4>
              <TemplatePreview html={designResult.templateHtml} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
