import { useCapabilityStore } from '../../store/capability-store'
import { useTabStore } from '../../store/tab-store'
import type { CrawlMode } from '../../../shared/types'

interface WebCrawlerPanelProps {
  tabId: string
  onBack: () => void
}

export function WebCrawlerPanel({ tabId, onBack }: WebCrawlerPanelProps): React.ReactElement {
  const {
    crawlStatus,
    crawlProgress,
    crawlResult,
    crawlError,
    crawlConfig,
    dryRunStatus,
    crawlDryRunResult,
    dryRunError,
    startCrawl,
    dryRunCrawl,
    cancelCrawl,
    resetCrawl,
    updateCrawlConfig,
  } = useCapabilityStore()

  const isRunning = crawlStatus === 'running' || crawlStatus === 'cancelling'
  const isDryRunning = dryRunStatus === 'running'

  const handleAnalyze = (): void => {
    const url = crawlConfig.startUrl || tabUrl
    dryRunCrawl(url, tabId)
  }

  const tabUrl = useTabStore((s) => {
    const tab = s.tabs.find((t) => t.id === tabId)
    return tab?.url ?? ''
  })

  const handleStart = (): void => {
    const url = crawlConfig.startUrl || tabUrl
    startCrawl(url, tabId)
  }

  const handleExport = async (): Promise<void> => {
    if (!crawlResult) return
    const res = (await window.api.capabilityCrawlExport(crawlResult)) as {
      success: boolean
      path?: string
      error?: string
    }
    if (!res.success && res.error !== 'Cancelled') {
      alert('Export failed: ' + res.error)
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-gray-200 p-3 dark:border-gray-700">
        <button
          onClick={onBack}
          className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          ← Back
        </button>
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          🕷️ Web Crawler
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* ── Settings ── */}
        {!crawlResult && crawlStatus !== 'running' && crawlStatus !== 'cancelling' && (
          <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
            <label className="block">
              <span className="text-xs text-gray-500 dark:text-gray-400">Start URL</span>
              <input
                type="url"
                value={crawlConfig.startUrl}
                onChange={(e) => updateCrawlConfig({ startUrl: e.target.value })}
                placeholder={tabUrl || 'https://example.com (leave empty for current page)'}
                className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
              />
            </label>

            <label className="block">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Max Depth: {crawlConfig.maxDepth}
              </span>
              <input
                type="range"
                min={0}
                max={5}
                value={crawlConfig.maxDepth}
                onChange={(e) => updateCrawlConfig({ maxDepth: Number(e.target.value) })}
                className="mt-1 w-full"
              />
              <div className="flex justify-between text-[10px] text-gray-400">
                <span>This page only</span>
                <span>5 levels deep</span>
              </div>
            </label>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                <input
                  type="radio"
                  name="crawlMode"
                  checked={crawlConfig.mode === 'images'}
                  onChange={() => updateCrawlConfig({ mode: 'images' as CrawlMode })}
                />
                Images
              </label>
              <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                <input
                  type="radio"
                  name="crawlMode"
                  checked={crawlConfig.mode === 'full-pages'}
                  onChange={() => updateCrawlConfig({ mode: 'full-pages' as CrawlMode })}
                />
                Full Pages
              </label>
            </div>

            <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
              <input
                type="checkbox"
                checked={crawlConfig.sameDomainOnly}
                onChange={(e) => updateCrawlConfig({ sameDomainOnly: e.target.checked })}
              />
              Same domain only
            </label>

            <label className="block">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Max Pages: {crawlConfig.maxPages}
              </span>
              <input
                type="range"
                min={5}
                max={200}
                step={5}
                value={crawlConfig.maxPages}
                onChange={(e) => updateCrawlConfig({ maxPages: Number(e.target.value) })}
                className="mt-1 w-full"
              />
            </label>
          </div>
        )}

        {/* ── Error ── */}
        {crawlError && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-600 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400">
            {crawlError}
          </div>
        )}

        {/* ── Dry run error ── */}
        {dryRunError && !crawlError && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-600 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400">
            {dryRunError}
          </div>
        )}

        {/* ── Dry run progress ── */}
        {isDryRunning && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/30">
            <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400">
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
              Analyzing page...
            </div>
          </div>
        )}

        {/* ── Dry run results ── */}
        {dryRunStatus === 'done' && crawlDryRunResult && !crawlResult && !isRunning && (
          <div className="space-y-3">
            <div className="rounded-lg border border-purple-200 bg-purple-50 p-3 dark:border-purple-800 dark:bg-purple-900/30">
              <p className="text-xs font-medium text-purple-700 dark:text-purple-400">
                Analysis Preview
              </p>
              <div className="mt-2 space-y-1 text-xs text-gray-700 dark:text-gray-300">
                <p>
                  <span className="text-gray-500">Page:</span>{' '}
                  {crawlDryRunResult.startPage.title}
                </p>
                <p>
                  <span className="text-gray-500">URL:</span>{' '}
                  <span className="truncate text-blue-500">{crawlDryRunResult.startPage.url}</span>
                </p>
                <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-base font-bold text-gray-800 dark:text-gray-200">
                      {crawlDryRunResult.startPage.linkCount}
                    </p>
                    <p className="text-[10px] text-gray-500">links</p>
                  </div>
                  <div>
                    <p className="text-base font-bold text-gray-800 dark:text-gray-200">
                      {crawlDryRunResult.startPage.imageCount}
                    </p>
                    <p className="text-[10px] text-gray-500">images</p>
                  </div>
                  <div>
                    <p className="text-base font-bold text-gray-800 dark:text-gray-200">
                      {crawlDryRunResult.estimatedPages}
                    </p>
                    <p className="text-[10px] text-gray-500">est. pages</p>
                  </div>
                </div>
              </div>
            </div>

            {crawlDryRunResult.links.length > 0 && (
              <div className="max-h-40 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700">
                <p className="sticky top-0 bg-gray-50 px-2 py-1 text-[10px] font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                  Discoverable links ({crawlDryRunResult.links.length})
                </p>
                {crawlDryRunResult.links.slice(0, 50).map((link, i) => (
                  <div
                    key={i}
                    className="truncate border-t border-gray-100 px-2 py-1 text-[11px] text-gray-600 dark:border-gray-700 dark:text-gray-400"
                  >
                    <span className="text-gray-400">{link.title}</span>
                    <span className="mx-1 text-gray-300">—</span>
                    <span className="text-blue-500">{link.url}</span>
                  </div>
                ))}
                {crawlDryRunResult.links.length > 50 && (
                  <p className="border-t border-gray-100 px-2 py-1 text-[10px] text-gray-400 dark:border-gray-700">
                    +{crawlDryRunResult.links.length - 50} more links
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Progress ── */}
        {(crawlStatus === 'running' || crawlStatus === 'cancelling') && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/30">
            <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400">
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
              {crawlStatus === 'cancelling' ? 'Cancelling...' : 'Crawling...'}
            </div>
            {crawlProgress && (
              <div className="mt-2 space-y-1 text-[11px] text-gray-600 dark:text-gray-400">
                <p>Pages visited: {crawlProgress.pagesVisited}</p>
                <p>Images found: {crawlProgress.imagesFound}</p>
                {crawlProgress.currentUrl && (
                  <p className="truncate">
                    Current: <span className="text-blue-500">{crawlProgress.currentUrl}</span>
                  </p>
                )}
                <p>Queue: {crawlProgress.queueSize}</p>
                {crawlProgress.errors.length > 0 && (
                  <p className="text-yellow-600">
                    {crawlProgress.errors.length} error{crawlProgress.errors.length !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Results ── */}
        {crawlResult && (
          <div className="space-y-3">
            <div className="rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-900/30">
              <p className="text-xs font-medium text-green-700 dark:text-green-400">
                Crawl complete
              </p>
              <div className="mt-1 grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-lg font-bold text-gray-800 dark:text-gray-200">
                    {crawlResult.totalPages}
                  </p>
                  <p className="text-[10px] text-gray-500">pages</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-gray-800 dark:text-gray-200">
                    {crawlResult.totalImages}
                  </p>
                  <p className="text-[10px] text-gray-500">images</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-gray-800 dark:text-gray-200">
                    {(crawlResult.duration / 1000).toFixed(1)}s
                  </p>
                  <p className="text-[10px] text-gray-500">duration</p>
                </div>
              </div>
            </div>

            {/* Images grid or page list */}
            {crawlResult.config.mode === 'images' ? (
              <div className="grid grid-cols-3 gap-2">
                {crawlResult.pages.flatMap((p) => p.images).slice(0, 60).map((img, i) => (
                  <div
                    key={i}
                    className="group relative aspect-square overflow-hidden rounded-md border border-gray-200 dark:border-gray-700"
                  >
                    <img
                      src={img.src}
                      alt={img.alt}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-1">
                {crawlResult.pages.map((page, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs dark:border-gray-700 dark:bg-gray-800"
                  >
                    <span className="text-gray-400">#{page.depth}</span>
                    <span className="flex-1 truncate text-gray-700 dark:text-gray-300">
                      {page.title}
                    </span>
                    <span className="text-[10px] text-gray-400">
                      {page.images.length} img
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Action bar ── */}
      <div className="border-t border-gray-200 p-3 dark:border-gray-700">
        <div className="flex gap-2">
          {!isRunning && !isDryRunning && !crawlResult && (
            <button
              onClick={handleAnalyze}
              disabled={!crawlConfig.startUrl && !tabUrl}
              className="flex-1 rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-purple-700 disabled:opacity-40"
            >
              Analyze
            </button>
          )}
          {!isRunning && !isDryRunning && !crawlResult && (
            <button
              onClick={handleStart}
              disabled={!crawlConfig.startUrl && !tabUrl}
              className="flex-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-40"
            >
              Start Crawl
            </button>
          )}
          {isRunning && (
            <button
              onClick={cancelCrawl}
              className="flex-1 rounded-lg bg-red-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-600"
            >
              Cancel
            </button>
          )}
          {crawlResult && (
            <>
              <button
                onClick={handleExport}
                className="flex-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
              >
                Export
              </button>
              <button
                onClick={resetCrawl}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800"
              >
                New Crawl
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
