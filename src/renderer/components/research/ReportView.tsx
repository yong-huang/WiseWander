interface ReportSection {
  heading: string
  content: string
  sources: string[]
}

interface ResearchReport {
  title: string
  sections: ReportSection[]
  createdAt: number
}

interface ReportViewProps {
  report: ResearchReport | null
  isResearching: boolean
}

export function ReportView({ report, isResearching }: ReportViewProps): React.ReactElement {
  if (isResearching) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <div className="mb-3 h-8 w-8 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
        <p className="text-sm text-gray-500">Researching across multiple sources...</p>
      </div>
    )
  }

  if (!report) {
    return (
      <div className="flex flex-col items-center justify-center pt-16 text-center">
        <div className="mb-3 text-4xl opacity-20">🔬</div>
        <p className="text-sm text-gray-400">
          Enter a topic above to start researching
        </p>
      </div>
    )
  }

  return (
    <div className="p-3">
      <h3 className="mb-3 text-base font-semibold text-gray-800 dark:text-gray-200">
        {report.title}
      </h3>

      <div className="space-y-4">
        {report.sections.map((section, i) => (
          <div key={i} className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
            <h4 className="mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
              {section.heading}
            </h4>
            <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">
              {section.content}
            </p>
            {section.sources.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {section.sources.map((src, j) => (
                  <span
                    key={j}
                    className="inline-block rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500 dark:bg-gray-800"
                  >
                    {src}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-3 text-right text-[10px] text-gray-400">
        Generated {new Date(report.createdAt).toLocaleString()}
      </div>
    </div>
  )
}
