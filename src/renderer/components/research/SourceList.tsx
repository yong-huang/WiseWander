interface Source {
  url: string
  title: string
  snippet: string
}

interface SourceListProps {
  sources: Source[]
}

export function SourceList({ sources }: SourceListProps): React.ReactElement {
  if (sources.length === 0) {
    return (
      <div className="p-3 text-center text-xs text-gray-400">
        No sources collected yet
      </div>
    )
  }

  return (
    <div className="p-3 space-y-2">
      <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300">
        Sources ({sources.length})
      </h4>
      {sources.map((source, i) => (
        <div
          key={i}
          className="rounded-lg border border-gray-200 p-2.5 dark:border-gray-700"
        >
          <div className="mb-0.5 text-xs font-medium text-blue-600 dark:text-blue-400">
            {source.title}
          </div>
          <div className="truncate text-[10px] text-gray-400">{source.url}</div>
          {source.snippet && (
            <p className="mt-1 text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
              {source.snippet}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}
