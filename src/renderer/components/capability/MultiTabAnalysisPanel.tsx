import { useState } from 'react'
import { useCapabilityStore } from '../../store/capability-store'
import { useTabStore } from '../../store/tab-store'
import type { MultiTabAnalysisMode } from '../../../shared/types'

interface MultiTabAnalysisPanelProps {
  tabId: string
  onBack: () => void
}

export function MultiTabAnalysisPanel({ tabId, onBack }: MultiTabAnalysisPanelProps): React.ReactElement {
  const tabs = useTabStore((s) => s.tabs)
  const { multiTabStatus, multiTabResult, multiTabError, runMultiTabAnalysis, resetMultiTab } = useCapabilityStore()

  const [selectedTabs, setSelectedTabs] = useState<Set<string>>(new Set([tabId]))
  const [mode, setMode] = useState<MultiTabAnalysisMode>('compare')
  const [query, setQuery] = useState('')

  const isAnalyzing = multiTabStatus === 'analyzing'

  const toggleTab = (tabId: string): void => {
    setSelectedTabs((prev) => {
      const next = new Set(prev)
      if (next.has(tabId)) next.delete(tabId)
      else next.add(tabId)
      return next
    })
  }

  const handleAnalyze = (): void => {
    if (selectedTabs.size < 2) return
    runMultiTabAnalysis([...selectedTabs], mode, query.trim() || undefined)
  }

  const modes: { value: MultiTabAnalysisMode; label: string; desc: string }[] = [
    { value: 'compare', label: 'Compare', desc: 'Compare content across tabs' },
    { value: 'aggregate', label: 'Aggregate', desc: 'Synthesize into a unified summary' },
    { value: 'contradiction', label: 'Contradictions', desc: 'Find conflicting claims' },
  ]

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-gray-200 p-3 dark:border-gray-700">
        <button onClick={onBack} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">&larr;</button>
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Multi-Tab Analysis</span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Tab Selection */}
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            Select tabs ({selectedTabs.size} selected, min 2)
          </label>
          <div className="max-h-32 overflow-y-auto space-y-1">
            {tabs.map((tab) => (
              <label key={tab.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedTabs.has(tab.id)}
                  onChange={() => toggleTab(tab.id)}
                  className="rounded border-gray-300 text-teal-500 focus:ring-teal-400"
                />
                <span className="text-xs text-gray-700 dark:text-gray-300 truncate max-w-[220px]">
                  {tab.title || tab.url}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Analysis Mode */}
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Analysis Mode</label>
          <div className="space-y-1">
            {modes.map((m) => (
              <label key={m.value} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer">
                <input
                  type="radio"
                  name="mode"
                  checked={mode === m.value}
                  onChange={() => setMode(m.value)}
                  className="text-teal-500 focus:ring-teal-400"
                />
                <div>
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{m.label}</span>
                  <span className="text-[10px] text-gray-400 ml-1">{m.desc}</span>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Query (optional) */}
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            Focus question (optional)
          </label>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g., What are the different opinions on X?"
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm
              placeholder-gray-400 focus:border-teal-400 focus:outline-none
              dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
          />
        </div>

        {/* Action */}
        <div className="flex gap-2">
          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing || selectedTabs.size < 2}
            className="flex-1 rounded-lg bg-teal-500 px-4 py-2 text-xs font-medium text-white
              transition-colors hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isAnalyzing ? 'Analyzing...' : `Analyze ${selectedTabs.size} Tabs`}
          </button>
          {multiTabStatus === 'done' && (
            <button
              onClick={resetMultiTab}
              className="rounded-lg bg-gray-100 px-3 py-2 text-xs font-medium text-gray-700
                hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Reset
            </button>
          )}
        </div>

        {/* Error */}
        {multiTabError && (
          <div className="rounded-lg bg-red-50 p-3 text-xs text-red-600 dark:bg-red-900/20 dark:text-red-400">
            {multiTabError}
          </div>
        )}

        {/* Result */}
        {multiTabResult && (
          <div className="mt-2">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-medium text-gray-600 dark:text-gray-400">Analysis Result</h4>
              <span className="text-[10px] text-gray-400">{multiTabResult.tabCount} tabs analyzed</span>
            </div>
            <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-700 dark:bg-gray-800 dark:text-gray-300 whitespace-pre-wrap">
              {multiTabResult.analysis}
            </div>
            <button
              onClick={() => navigator.clipboard.writeText(multiTabResult.analysis)}
              className="mt-2 text-xs text-teal-600 hover:text-teal-700 dark:text-teal-400"
            >
              Copy to clipboard
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
