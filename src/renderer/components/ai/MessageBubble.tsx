import { StreamingText } from './StreamingText'

interface MessageBubbleProps {
  role: 'user' | 'assistant' | 'system'
  content: string
  isStreaming?: boolean
}

export function MessageBubble({
  role,
  content,
  isStreaming = false,
}: MessageBubbleProps): React.ReactElement {
  if (role === 'system') {
    return (
      <div className="mx-auto max-w-[90%] rounded-lg bg-gray-50 px-3 py-1.5 text-center text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400">
        {content}
      </div>
    )
  }

  return (
    <div
      className={`flex ${role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}
    >
      <div
        className={`max-w-[85%] px-3.5 py-2.5 text-sm leading-relaxed ${
          role === 'user'
            ? 'rounded-2xl rounded-br-md bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-sm'
            : 'rounded-2xl rounded-bl-md bg-gray-50 text-gray-800 ring-1 ring-gray-200/70 dark:bg-gray-800 dark:text-gray-200 dark:ring-gray-700/70'
        }`}
      >
        {role === 'assistant' ? (
          <StreamingText content={content} isStreaming={isStreaming} />
        ) : (
          <span className="whitespace-pre-wrap">{content}</span>
        )}
      </div>
    </div>
  )
}
