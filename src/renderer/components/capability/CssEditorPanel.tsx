import { useState } from 'react'
import { useCapabilityStore } from '../../store/capability-store'
import { useTabStore } from '../../store/tab-store'
import { injectCss, removeInjectedCss } from '../../services/css-applicator'

interface CssEditorPanelProps {
  tabId: string
  onBack: () => void
}

export function CssEditorPanel({ tabId, onBack }: CssEditorPanelProps): React.ReactElement {
  const tabUrl = useTabStore((s) => {
    const tab = s.tabs.find((t) => t.id === tabId)
    return tab?.url ?? ''
  })

  const { cssEditorStatus, cssEditorResult, cssEditorError, generateCss, resetCssEditor } = useCapabilityStore()

  const [selector, setSelector] = useState('body')
  const [description, setDescription] = useState('')
  const [isApplied, setIsApplied] = useState(false)

  const isGenerating = cssEditorStatus === 'generating'

  const handleGenerate = async (): Promise<void> => {
    if (!description.trim()) return
    await generateCss(selector.trim(), description.trim(), tabUrl)
  }

  const handlePreview = async (): Promise<void> => {
    if (!cssEditorResult) return
    await injectCss(tabId, cssEditorResult.selector, cssEditorResult.css)
    setIsApplied(true)
  }

  const handleRevert = async (): Promise<void> => {
    await removeInjectedCss(tabId)
    setIsApplied(false)
  }

  const handleReset = (): void => {
    resetCssEditor()
    setDescription('')
    setSelector('body')
    setIsApplied(false)
    removeInjectedCss(tabId).catch(() => {})
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-gray-200 p-3 dark:border-gray-700">
        <button onClick={onBack} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">&larr;</button>
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">CSS Smart Editor</span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Selector */}
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            CSS Selector
          </label>
          <input
            value={selector}
            onChange={(e) => setSelector(e.target.value)}
            placeholder="e.g., .header, #main-content, h1"
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm
              placeholder-gray-400 focus:border-teal-400 focus:outline-none font-mono
              dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            Describe the style you want
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g., Make it look like a modern dark gradient header with rounded corners and a subtle shadow"
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm
              placeholder-gray-400 focus:border-teal-400 focus:outline-none
              dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            rows={3}
          />
        </div>

        {/* Generate */}
        <button
          onClick={handleGenerate}
          disabled={isGenerating || !description.trim()}
          className="w-full rounded-lg bg-teal-500 px-4 py-2 text-xs font-medium text-white
            transition-colors hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isGenerating ? 'Generating...' : 'Generate CSS'}
        </button>

        {/* Error */}
        {cssEditorError && (
          <div className="rounded-lg bg-red-50 p-3 text-xs text-red-600 dark:bg-red-900/20 dark:text-red-400">
            {cssEditorError}
          </div>
        )}

        {/* Result */}
        {cssEditorResult && (
          <div className="space-y-2">
            {/* Explanation */}
            <div className="rounded-lg bg-blue-50 p-2 text-xs text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
              {cssEditorResult.explanation}
            </div>

            {/* CSS Preview */}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Generated CSS
              </label>
              <pre className="max-h-32 overflow-auto rounded-lg bg-gray-900 p-3 text-xs text-green-400 font-mono">
                {cssEditorResult.selector} {'{'}
                {'\n  '}{cssEditorResult.css}
                {'\n}'}
              </pre>
            </div>

            {/* Apply/Revert buttons */}
            <div className="flex gap-2">
              <button
                onClick={handlePreview}
                disabled={isApplied}
                className="flex-1 rounded-lg bg-green-500 px-4 py-2 text-xs font-medium text-white
                  transition-colors hover:bg-green-600 disabled:opacity-50"
              >
                {isApplied ? 'Applied' : 'Preview'}
              </button>
              <button
                onClick={handleRevert}
                disabled={!isApplied}
                className="flex-1 rounded-lg bg-gray-500 px-4 py-2 text-xs font-medium text-white
                  transition-colors hover:bg-gray-600 disabled:opacity-50"
              >
                Revert
              </button>
              <button
                onClick={handleReset}
                className="rounded-lg bg-gray-100 px-3 py-2 text-xs font-medium text-gray-700
                  hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300"
              >
                Reset
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
