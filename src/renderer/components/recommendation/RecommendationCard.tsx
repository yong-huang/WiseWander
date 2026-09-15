import type { Recommendation } from '../../../shared/types'

interface RecommendationCardProps {
  recommendation: Recommendation
  onClick: (url: string) => void
}

function getSourceLabel(sourceType: string): string {
  switch (sourceType) {
    case 'frequency': return 'Frequent'
    case 'ai_interest': return 'AI Suggested'
    case 'reading_list_similar': return 'Similar'
    default: return ''
  }
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export function RecommendationCard({ recommendation, onClick }: RecommendationCardProps): React.ReactElement {
  const { title, url, excerpt, sourceType, faviconUrl, interestLabel } = recommendation
  const domain = getDomain(url)

  return (
    <button
      onClick={() => onClick(url)}
      className="group flex flex-col rounded-lg border border-gray-200 bg-white p-3 text-left transition-all hover:border-blue-300 hover:shadow-md dark:border-gray-700 dark:bg-gray-800 dark:hover:border-blue-600"
    >
      <div className="mb-1 flex items-start gap-2">
        {faviconUrl && (
          <img src={faviconUrl} alt="" className="mt-0.5 h-4 w-4 shrink-0 rounded" />
        )}
        <span className="text-sm font-medium text-gray-900 line-clamp-2 group-hover:text-blue-600 dark:text-gray-100 dark:group-hover:text-blue-400">
          {title}
        </span>
      </div>
      {excerpt && (
        <p className="mb-1 text-xs text-gray-500 line-clamp-2 dark:text-gray-400">
          {excerpt}
        </p>
      )}
      <div className="mt-auto flex items-center gap-2 pt-1">
        <span className="text-[10px] text-gray-400 dark:text-gray-500">{domain}</span>
        {interestLabel && (
          <span className="rounded-full bg-purple-100 px-1.5 py-0.5 text-[10px] text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
            {interestLabel}
          </span>
        )}
        <span className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
          {getSourceLabel(sourceType)}
        </span>
      </div>
    </button>
  )
}
