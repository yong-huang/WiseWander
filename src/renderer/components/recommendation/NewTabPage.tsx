import { useEffect } from 'react'
import { useRecommendationStore } from '../../store/recommendation-store'
import { RecommendationCard } from './RecommendationCard'
import { ReadingListCard } from './ReadingListCard'

interface NewTabPageProps {
  tabId: string
  isActive: boolean
  onNavigate: (url: string) => void
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function getGreetingEmoji(): string {
  const hour = new Date().getHours()
  if (hour < 5) return '🌙'
  if (hour < 12) return '☀️'
  if (hour < 18) return '🌤️'
  return '🌆'
}

function SkeletonCard(): React.ReactElement {
  return (
    <div className="animate-pulse rounded-2xl border border-gray-200/80 bg-white p-3.5 dark:border-gray-700/70 dark:bg-gray-800/80">
      <div className="mb-2 h-4 w-3/4 rounded bg-gray-200 dark:bg-gray-700" />
      <div className="mb-1 h-3 w-full rounded bg-gray-100 dark:bg-gray-700/50" />
      <div className="h-3 w-2/3 rounded bg-gray-100 dark:bg-gray-700/50" />
    </div>
  )
}

export function NewTabPage({ isActive, onNavigate }: NewTabPageProps): React.ReactElement {
  const {
    recommendations,
    interestProfiles,
    recommendationStatus,
    readingList,
    readingListTotal,
    loadRecommendations,
    refreshRecommendations,
    loadReadingList,
    removeFromReadingList,
  } = useRecommendationStore()

  useEffect(() => {
    loadRecommendations()
    loadReadingList(1, 3)
  }, [loadRecommendations, loadReadingList])

  const handleNavigate = (url: string): void => {
    onNavigate(url)
  }

  const handleRefresh = (): void => {
    refreshRecommendations()
  }

  const aiRecommendations = recommendations.filter((r) => r.sourceType !== 'frequency')
  const freqRecommendations = recommendations.filter((r) => r.sourceType === 'frequency')

  const isLoading = recommendationStatus === 'loading' || recommendationStatus === 'refreshing'

  return (
    <div
      className="relative h-full w-full flex flex-col overflow-y-auto scrollbar-thin bg-gray-50 dark:bg-gray-950"
      style={{ display: isActive ? 'flex' : 'none' }}
    >
      {/* Ambient gradient blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -top-24 left-1/4 h-72 w-72 rounded-full bg-blue-400/10 blur-3xl dark:bg-indigo-500/10" />
        <div className="absolute top-16 -right-10 h-64 w-64 rounded-full bg-violet-400/10 blur-3xl dark:bg-violet-500/10" />
        <div className="absolute top-40 -left-16 h-64 w-64 rounded-full bg-sky-300/10 blur-3xl dark:bg-sky-500/[0.07]" />
      </div>
      <div className="relative mx-auto w-full max-w-4xl px-6 py-12">
        {/* Greeting */}
        <div className="flex items-baseline gap-3">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
            {getGreeting()}
          </h1>
          <span className="text-lg" aria-hidden>{getGreetingEmoji()}</span>
        </div>
        <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">
          WiseWander · AI-native browsing
        </p>

        {/* Search bar */}
        <div className="mt-4">
          <div className="flex items-center gap-2.5 rounded-2xl border border-gray-200/90 bg-white px-4 py-3 shadow-[0_2px_12px_rgb(16_24_40/0.06)] transition-all duration-200 focus-within:border-indigo-400 focus-within:shadow-[0_4px_24px_rgb(79_70_229/0.15)] dark:border-gray-700/80 dark:bg-gray-800/90 dark:focus-within:border-indigo-500 dark:focus-within:shadow-[0_4px_24px_rgb(129_140_248/0.15)]">
            <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                const formData = new FormData(e.currentTarget)
                const query = formData.get('search') as string
                if (query?.trim()) {
                  const url = query.includes('://') ? query : `https://www.google.com/search?q=${encodeURIComponent(query.trim())}`
                  handleNavigate(url)
                }
              }}
              className="flex-1"
            >
              <input
                name="search"
                type="text"
                placeholder="Search the web..."
                className="w-full bg-transparent text-sm text-gray-700 placeholder-gray-400 outline-none dark:text-gray-200 dark:placeholder-gray-500"
              />
            </form>
          </div>
        </div>

        {/* Refresh button */}
        <div className="mt-6 flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-600 dark:text-gray-300">
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-indigo-500" fill="currentColor"><path d="M8 1.5l1.4 3.9 3.9 1.4-3.9 1.4L8 12.1 6.6 8.2 2.7 6.8l3.9-1.4L8 1.5zM12.8 10.6l.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7.7-1.9z" /></svg>
            For You
          </h2>
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
          >
            <svg className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>

        {/* AI Recommendations */}
        {isLoading ? (
          <div className="mt-3 grid grid-cols-3 gap-3.5">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : aiRecommendations.length > 0 ? (
          <div className="mt-3 grid grid-cols-3 gap-3.5">
            {aiRecommendations.slice(0, 6).map((rec) => (
              <RecommendationCard key={rec.url} recommendation={rec} onClick={handleNavigate} />
            ))}
          </div>
        ) : (
          <div className="mt-3 rounded-2xl border border-dashed border-gray-300/80 bg-white/60 p-8 text-center dark:border-gray-700 dark:bg-gray-800/50">
            <p className="text-sm text-gray-400 dark:text-gray-500">
              Start browsing to get personalized recommendations.
            </p>
            <p className="mt-1 text-xs text-gray-300 dark:text-gray-600">
              AI-powered suggestions will appear as you build browsing history.
            </p>
          </div>
        )}

        {/* Frequently Visited */}
        {freqRecommendations.length > 0 && (
          <div className="mt-8">
            <h2 className="mb-3 text-sm font-medium text-gray-500 dark:text-gray-400">
              Frequently Visited
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {freqRecommendations.slice(0, 8).map((rec) => (
                <button
                  key={rec.url}
                  onClick={() => handleNavigate(rec.url)}
                  className="group flex flex-col items-center gap-2 rounded-2xl p-3 transition-all duration-150 hover:bg-white hover:shadow-[0_4px_16px_rgb(16_24_40/0.08)] dark:hover:bg-gray-800/80"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/15 to-violet-500/15 text-lg font-bold text-indigo-600 ring-1 ring-indigo-500/10 transition-transform duration-150 group-hover:scale-105 dark:from-indigo-500/20 dark:to-violet-500/15 dark:text-indigo-300">
                    {rec.title.charAt(0).toUpperCase()}
                  </div>
                  <span className="max-w-full truncate text-xs text-gray-600 group-hover:text-blue-600 dark:text-gray-400 dark:group-hover:text-blue-400">
                    {rec.title}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Interest Tags */}
        {interestProfiles.length > 0 && (
          <div className="mt-8">
            <h2 className="mb-3 text-sm font-medium text-gray-500 dark:text-gray-400">
              Your Interests
            </h2>
            <div className="flex flex-wrap gap-2">
              {interestProfiles.map((profile) => (
                <div
                  key={profile.id}
                  className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 dark:border-gray-700 dark:bg-gray-800"
                >
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    {profile.label}
                  </span>
                  <div className="h-1.5 w-12 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-500 to-violet-500"
                      style={{ width: `${Math.min(profile.weight / 2 * 100, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reading List */}
        {readingList.length > 0 && (
          <div className="mt-8">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Reading List
              </h2>
              {readingListTotal > 3 && (
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {readingListTotal} items
                </span>
              )}
            </div>
            <div className="flex flex-col gap-2">
              {readingList.slice(0, 3).map((item) => (
                <ReadingListCard
                  key={item.id}
                  item={item}
                  onRemove={removeFromReadingList}
                  onClick={handleNavigate}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
