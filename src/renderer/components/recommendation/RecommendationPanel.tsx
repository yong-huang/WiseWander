import { useEffect } from 'react'
import { useRecommendationStore } from '../../store/recommendation-store'
import { RecommendationCard } from './RecommendationCard'
import { ReadingListCard } from './ReadingListCard'
import { useTabStore } from '../../store/tab-store'

interface RecommendationPanelProps {
  tabId: string
}

export function RecommendationPanel({ tabId }: RecommendationPanelProps): React.ReactElement {
  const {
    recommendations,
    interestProfiles,
    recommendationStatus,
    readingList,
    loadRecommendations,
    refreshRecommendations,
    loadReadingList,
    addToReadingList,
    removeFromReadingList,
  } = useRecommendationStore()

  const activeTab = useTabStore((s) => s.tabs.find((t) => t.id === tabId))

  useEffect(() => {
    loadRecommendations()
    loadReadingList()
  }, [loadRecommendations, loadReadingList])

  const handleNavigate = (url: string): void => {
    const { updateTab } = useTabStore.getState()
    if (tabId) {
      updateTab(tabId, { url, status: 'loading' })
    }
  }

  const handleAddCurrentPage = async (): Promise<void> => {
    if (!activeTab) return
    await addToReadingList({
      url: activeTab.url,
      title: activeTab.title,
      faviconUrl: activeTab.favicon,
    })
  }

  const isLoading = recommendationStatus === 'loading' || recommendationStatus === 'refreshing'

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2 dark:border-gray-700">
        <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-300">For You</h3>
        <div className="flex items-center gap-1">
          <button
            onClick={handleAddCurrentPage}
            disabled={!activeTab || activeTab.url.startsWith('wisewander://')}
            className="rounded px-1.5 py-0.5 text-[10px] text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 dark:hover:bg-gray-800 dark:hover:text-gray-300"
            title="Add current page to reading list"
          >
            + Reading List
          </button>
          <button
            onClick={() => refreshRecommendations()}
            disabled={isLoading}
            className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
          >
            <svg className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* AI Recommendations */}
        {recommendations.length > 0 && (
          <div className="p-3">
            <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
              Recommendations
            </h4>
            <div className="flex flex-col gap-2">
              {recommendations.slice(0, 8).map((rec) => (
                <RecommendationCard key={rec.url} recommendation={rec} onClick={handleNavigate} />
              ))}
            </div>
          </div>
        )}

        {/* Interest Tags */}
        {interestProfiles.length > 0 && (
          <div className="border-t border-gray-100 p-3 dark:border-gray-800">
            <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
              Interests
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {interestProfiles.map((p) => (
                <span
                  key={p.id}
                  className="rounded-full bg-purple-50 px-2 py-0.5 text-[10px] text-purple-600 dark:bg-purple-900/20 dark:text-purple-400"
                >
                  {p.label}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Reading List */}
        <div className="border-t border-gray-100 p-3 dark:border-gray-800">
          <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
            Reading List
          </h4>
          {readingList.length === 0 ? (
            <p className="text-xs text-gray-400 dark:text-gray-500">
              No items yet. Add pages from the + button above.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {readingList.map((item) => (
                <ReadingListCard
                  key={item.id}
                  item={item}
                  onRemove={removeFromReadingList}
                  onClick={handleNavigate}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
