import { useState, useEffect } from 'react'
import { useCapabilityStore } from '../../store/capability-store'
import type { ScreenshotMode } from '../../../shared/types'

interface ScreenshotPanelProps {
  tabId: string
  onBack: () => void
}

export function ScreenshotPanel({ tabId, onBack }: ScreenshotPanelProps): React.ReactElement {
  const {
    screenshotStatus,
    screenshotProgress,
    screenshotResult,
    screenshotError,
    captureScreenshot,
    resetScreenshot,
    setupScreenshotProgressListener,
  } = useCapabilityStore()

  const [mode, setMode] = useState<ScreenshotMode>('visible')

  const isCapturing = screenshotStatus === 'capturing'
  const isDone = screenshotStatus === 'done'

  // Set up progress listener on mount
  useEffect(() => {
    const cleanup = setupScreenshotProgressListener()
    return cleanup
  }, [setupScreenshotProgressListener])

  const handleCapture = () => {
    void captureScreenshot(tabId, mode)
  }

  const handleSave = async () => {
    if (!screenshotResult) return
    const defaultName = `screenshot-${Date.now()}.png`
    await window.api.capabilityScreenshotSave(screenshotResult.dataUrl, defaultName)
  }

  const handleNewScreenshot = () => {
    resetScreenshot()
  }

  const formatBytes = (dataUrl: string): string => {
    const base64 = dataUrl.replace(/^data:image\/png;base64,/, '')
    const bytes = Math.round((base64.length * 3) / 4)
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const progressPercent =
    screenshotProgress && screenshotProgress.totalSections > 0
      ? Math.round((screenshotProgress.currentSection / screenshotProgress.totalSections) * 100)
      : 0

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
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Screenshot</h3>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-1 border-b border-gray-200 p-3 dark:border-gray-700">
        <button
          onClick={() => setMode('visible')}
          disabled={isCapturing}
          className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            mode === 'visible'
              ? 'bg-teal-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
          } disabled:opacity-50`}
        >
          Visible Area
        </button>
        <button
          onClick={() => setMode('full-page')}
          disabled={isCapturing}
          className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            mode === 'full-page'
              ? 'bg-teal-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
          } disabled:opacity-50`}
        >
          Full Page
        </button>
      </div>

      {/* Capture button */}
      <div className="border-b border-gray-200 p-3 dark:border-gray-700">
        {!isDone ? (
          <button
            onClick={handleCapture}
            disabled={isCapturing || !tabId}
            className="w-full rounded-lg bg-gradient-to-r from-teal-600 to-cyan-600 px-3 py-2
              text-sm font-medium text-white
              hover:from-teal-700 hover:to-cyan-700
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-all"
          >
            {isCapturing ? 'Capturing...' : 'Capture Screenshot'}
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => void handleSave()}
              className="flex-1 rounded-lg bg-gradient-to-r from-teal-600 to-cyan-600 px-3 py-2
                text-sm font-medium text-white hover:from-teal-700 hover:to-cyan-700 transition-all"
            >
              Save
            </button>
            <button
              onClick={handleNewScreenshot}
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium
                text-gray-700 transition-colors hover:bg-gray-50
                dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              New Screenshot
            </button>
          </div>
        )}

        {/* Progress bar (full-page mode) */}
        {isCapturing && screenshotProgress && mode === 'full-page' && (
          <div className="mt-2">
            <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
              <span>
                {screenshotProgress.status === 'capturing'
                  ? `Capturing section ${screenshotProgress.currentSection} of ${screenshotProgress.totalSections}`
                  : screenshotProgress.status === 'stitching'
                    ? 'Stitching image...'
                    : 'Processing...'}
              </span>
              <span>{progressPercent}%</span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
              <div
                className="h-full rounded-full bg-teal-500 transition-all duration-200"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* Spinner for visible mode */}
        {isCapturing && mode === 'visible' && (
          <div className="mt-2 flex items-center gap-2">
            <div className="h-3 w-3 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
            <span className="text-[11px] text-gray-500 dark:text-gray-400">Capturing viewport...</span>
          </div>
        )}
      </div>

      {/* Error */}
      {screenshotError && (
        <div className="border-b border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
          {screenshotError}
        </div>
      )}

      {/* Info bar */}
      {screenshotResult && isDone && (
        <div className="flex gap-2 border-b border-gray-200 px-3 py-2 dark:border-gray-700">
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
            {screenshotResult.width} x {screenshotResult.height}
          </span>
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
            {formatBytes(screenshotResult.dataUrl)}
          </span>
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
            {screenshotResult.mode === 'full-page' ? 'Full Page' : 'Visible'}
          </span>
        </div>
      )}

      {/* Image preview */}
      {screenshotResult && isDone && (
        <div className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-950">
          <div className="flex justify-center p-2">
            
            <img
              src={screenshotResult.dataUrl}
              alt="Screenshot"
              className="max-w-full rounded border border-gray-200 shadow-sm dark:border-gray-700"
              style={{ imageRendering: 'auto' }}
            />
          </div>
        </div>
      )}

      {/* Empty state */}
      {screenshotStatus === 'idle' && (
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="text-center">
            <div className="mb-2 text-3xl opacity-50">📷</div>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Navigate to a page, choose a mode,<br />
              then click Capture Screenshot
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
