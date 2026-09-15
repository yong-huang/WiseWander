import { useState, useRef, useEffect, useCallback } from 'react'

interface TemplatePreviewProps {
  html: string
}

export function TemplatePreview({ html }: TemplatePreviewProps): React.ReactElement {
  const [copied, setCopied] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [contentHeight, setContentHeight] = useState(400)

  const SCALE = 0.35

  const measureContent = useCallback((): void => {
    const doc = iframeRef.current?.contentDocument
    if (doc?.body?.scrollHeight) {
      setContentHeight(doc.body.scrollHeight)
    }
  }, [])

  useEffect(() => {
    if (iframeRef.current) {
      iframeRef.current.srcdoc = html
      // Measure after content loads
      iframeRef.current.onload = () => {
        setTimeout(measureContent, 100)
      }
    }
  }, [html, measureContent])

  const handleCopy = async (): Promise<void> => {
    await navigator.clipboard.writeText(html)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleExport = async (): Promise<void> => {
    await window.api.capabilityExportTemplate(html, 'template.html')
  }

  const handleViewFull = (): void => {
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }

  // Visible height = actual content height × scale
  const visibleHeight = Math.round(contentHeight * SCALE)

  return (
    <div className="flex flex-col gap-2">
      <div
        className="overflow-hidden rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800"
        style={{ height: visibleHeight }}
      >
        <iframe
          ref={iframeRef}
          sandbox="allow-scripts"
          className="pointer-events-none w-full origin-top-left border-0"
          style={{
            width: `${Math.round(100 / SCALE)}%`,
            height: `${contentHeight}px`,
            transform: `scale(${SCALE})`,
          }}
          title="Template Preview"
        />
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => void handleCopy()}
          className="flex-1 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700
            hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          {copied ? 'Copied!' : 'Copy HTML'}
        </button>
        <button
          onClick={() => void handleExport()}
          className="flex-1 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-medium text-white
            hover:bg-teal-700"
        >
          Export .html
        </button>
        <button
          onClick={handleViewFull}
          className="flex-1 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700
            hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          View Full Size
        </button>
      </div>
    </div>
  )
}
