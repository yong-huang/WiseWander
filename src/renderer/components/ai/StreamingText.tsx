import { useState, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface StreamingTextProps {
  content: string
  isStreaming: boolean
}

export function StreamingText({ content, isStreaming }: StreamingTextProps): React.ReactElement {
  return (
    <div className="markdown-body break-words text-sm leading-relaxed">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {content}
      </ReactMarkdown>
      {isStreaming && (
        <span className="ml-0.5 inline-block h-4 w-1 animate-pulse bg-gray-400 align-text-bottom" />
      )}
    </div>
  )
}

/** Copy button for code blocks */
function CodeBlock({ children, className }: { children: React.ReactNode; className?: string }): React.ReactElement {
  const [copied, setCopied] = useState(false)
  const code = String(children).replace(/\n$/, '')
  const lang = className?.replace('language-', '') ?? ''

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }, [code])

  return (
    <div className="group relative my-2 overflow-hidden rounded-md bg-gray-900 dark:bg-gray-950">
      <div className="flex items-center justify-between border-b border-gray-700 px-3 py-1">
        <span className="text-[10px] text-gray-400">{lang || 'code'}</span>
        <button
          onClick={handleCopy}
          className="text-[10px] text-gray-400 hover:text-gray-200"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 text-xs leading-5">
        <code className="text-gray-100">{code}</code>
      </pre>
    </div>
  )
}

/** Inline code */
function InlineCode({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <code className="rounded bg-gray-200 px-1 py-0.5 text-xs text-pink-600 dark:bg-gray-700 dark:text-pink-400">
      {children}
    </code>
  )
}

/** Markdown component overrides */
export const markdownComponents = {
  pre({ children }: { children?: React.ReactNode }) {
    return <>{children}</>
  },
  code({ children, className }: { children?: React.ReactNode; className?: string }) {
    const text = String(children).replace(/\n$/, '')
    if (text.includes('\n') || className) {
      return <CodeBlock className={className}>{children}</CodeBlock>
    }
    return <InlineCode>{children}</InlineCode>
  },
  p({ children }: { children?: React.ReactNode }) {
    return <p className="my-1.5 last:mb-0">{children}</p>
  },
  h1({ children }: { children?: React.ReactNode }) {
    return <h1 className="mb-2 mt-3 text-lg font-bold first:mt-0">{children}</h1>
  },
  h2({ children }: { children?: React.ReactNode }) {
    return <h2 className="mb-1.5 mt-3 text-base font-bold first:mt-0">{children}</h2>
  },
  h3({ children }: { children?: React.ReactNode }) {
    return <h3 className="mb-1 mt-2 text-sm font-semibold first:mt-0">{children}</h3>
  },
  ul({ children }: { children?: React.ReactNode }) {
    return <ul className="my-1.5 ml-4 list-disc space-y-0.5">{children}</ul>
  },
  ol({ children }: { children?: React.ReactNode }) {
    return <ol className="my-1.5 ml-4 list-decimal space-y-0.5">{children}</ol>
  },
  li({ children }: { children?: React.ReactNode }) {
    return <li className="pl-1">{children}</li>
  },
  blockquote({ children }: { children?: React.ReactNode }) {
    return (
      <blockquote className="my-2 border-l-3 border-gray-300 pl-3 text-gray-600 italic dark:border-gray-600 dark:text-gray-400">
        {children}
      </blockquote>
    )
  },
  a({ href, children }: { href?: string; children?: React.ReactNode }) {
    return (
      <a href={href} className="text-blue-500 underline hover:text-blue-600" target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    )
  },
  table({ children }: { children?: React.ReactNode }) {
    return (
      <div className="my-2 overflow-x-auto">
        <table className="min-w-full border-collapse border border-gray-300 text-xs dark:border-gray-600">
          {children}
        </table>
      </div>
    )
  },
  th({ children }: { children?: React.ReactNode }) {
    return <th className="border border-gray-300 bg-gray-100 px-2 py-1 text-left font-semibold dark:border-gray-600 dark:bg-gray-800">{children}</th>
  },
  td({ children }: { children?: React.ReactNode }) {
    return <td className="border border-gray-300 px-2 py-1 dark:border-gray-600">{children}</td>
  },
  hr() {
    return <hr className="my-3 border-gray-300 dark:border-gray-600" />
  },
  strong({ children }: { children?: React.ReactNode }) {
    return <strong className="font-semibold">{children}</strong>
  },
}
