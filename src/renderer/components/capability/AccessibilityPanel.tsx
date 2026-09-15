import { useCapabilityStore } from '../../store/capability-store'

interface AccessibilityPanelProps {
  tabId: string
  onBack: () => void
}

export function AccessibilityPanel({ tabId, onBack }: AccessibilityPanelProps): React.ReactElement {
  const { a11yStatus, a11yResult, a11yError, runA11yAudit, exportA11yReport, resetA11y } = useCapabilityStore()

  const isAuditing = a11yStatus === 'auditing'

  const severityOrder = ['critical', 'warning', 'info'] as const
  const severityColor: Record<string, string> = {
    critical: 'text-red-600 dark:text-red-400',
    warning: 'text-yellow-600 dark:text-yellow-400',
    info: 'text-blue-600 dark:text-blue-400',
  }
  const severityBg: Record<string, string> = {
    critical: 'bg-red-50 dark:bg-red-900/20',
    warning: 'bg-yellow-50 dark:bg-yellow-900/20',
    info: 'bg-blue-50 dark:bg-blue-900/20',
  }

  const scoreColor = a11yResult
    ? a11yResult.score >= 80
      ? 'text-green-500'
      : a11yResult.score >= 50
        ? 'text-yellow-500'
        : 'text-red-500'
    : ''

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-gray-200 p-3 dark:border-gray-700">
        <button onClick={onBack} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">&larr;</button>
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Accessibility Audit</span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Run Audit */}
        <button
          onClick={() => runA11yAudit(tabId)}
          disabled={isAuditing}
          className="w-full rounded-lg bg-teal-500 px-4 py-2 text-xs font-medium text-white
            transition-colors hover:bg-teal-600 disabled:opacity-50"
        >
          {isAuditing ? 'Auditing...' : 'Run Audit'}
        </button>

        {/* Error */}
        {a11yError && (
          <div className="rounded-lg bg-red-50 p-3 text-xs text-red-600 dark:bg-red-900/20 dark:text-red-400">
            {a11yError}
          </div>
        )}

        {/* Results */}
        {a11yResult && (
          <>
            {/* Score */}
            <div className="flex items-center justify-between">
              <div className="text-center">
                <div className={`text-3xl font-bold ${scoreColor}`}>{a11yResult.score}</div>
                <div className="text-[10px] text-gray-400">out of 100</div>
              </div>
              <div className="text-right text-xs text-gray-500">
                <div>{a11yResult.summary}</div>
              </div>
            </div>

            {/* Issues */}
            <div>
              <h4 className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                Issues ({a11yResult.issues.length})
              </h4>
              <div className="space-y-2">
                {a11yResult.issues
                  .sort((a, b) => severityOrder.indexOf(a.severity as never) - severityOrder.indexOf(b.severity as never))
                  .map((issue, i) => (
                    <div key={i} className={`rounded-lg p-3 ${severityBg[issue.severity]}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-bold uppercase ${severityColor[issue.severity]}`}>
                          {issue.severity}
                        </span>
                        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{issue.rule}</span>
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                        <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">{issue.selector}</code>
                      </div>
                      <p className="text-xs text-gray-700 dark:text-gray-300">{issue.description}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        <span className="font-medium">Fix:</span> {issue.suggestion}
                      </p>
                    </div>
                  ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={exportA11yReport}
                className="flex-1 rounded-lg bg-gray-100 px-3 py-2 text-xs font-medium text-gray-700
                  hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Export Report
              </button>
              <button
                onClick={resetA11y}
                className="rounded-lg bg-gray-100 px-3 py-2 text-xs font-medium text-gray-700
                  hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Reset
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
