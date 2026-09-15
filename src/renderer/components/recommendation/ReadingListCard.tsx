import type { ReadingListItem } from '../../../shared/types'

interface ReadingListCardProps {
  item: ReadingListItem
  onRemove: (id: number) => void
  onClick: (url: string) => void
}

export function ReadingListCard({ item, onRemove, onClick }: ReadingListCardProps): React.ReactElement {
  return (
    <div className="group flex items-start gap-2 rounded-xl border border-gray-200/80 bg-white p-2.5 shadow-sm transition-all hover:border-gray-300 hover:shadow-md dark:border-gray-700/70 dark:bg-gray-800/80 dark:shadow-none dark:hover:border-gray-600">
      <button
        onClick={() => onClick(item.url)}
        className="min-w-0 flex-1 text-left"
      >
        <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{item.title}</p>
        {item.excerpt && (
          <p className="truncate text-xs text-gray-500 dark:text-gray-400">{item.excerpt}</p>
        )}
        <p className="mt-0.5 text-[10px] text-gray-400 dark:text-gray-500">
          {new Date(item.addedAt).toLocaleDateString()}
        </p>
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(item.id) }}
        className="shrink-0 rounded p-1 text-gray-400 opacity-0 transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100 dark:hover:bg-red-900/20 dark:hover:text-red-400"
        title="Remove from reading list"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}
