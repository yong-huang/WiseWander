import { useState, useRef, useEffect, useCallback } from 'react'
import { MessageBubble } from './MessageBubble'
import { useAIStore } from '../../store/ai-store'
import { BROWSER_ASSISTANT_ID } from '../../../shared/constants'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  isStreaming?: boolean
}

export function AssistantPanel(): React.ReactElement {
  const { conversations, isStreaming, isExecutingTools, sendAssistantMessage, clearConversation, stopStreaming } = useAIStore()

  const conversation = conversations.get(BROWSER_ASSISTANT_ID)
  const messages = conversation?.messages ?? []
  const displayMessages: ChatMessage[] = messages
    .filter((m) => m.role !== 'system')
    .map((m, i, arr) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
      isStreaming: isStreaming && i === arr.length - 1 && m.role === 'assistant',
    }))

  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const isComposingRef = useRef(false)
  const [userScrolled, setUserScrolled] = useState(false)
  const isAutoScrollRef = useRef(false)

  // Auto-scroll
  useEffect(() => {
    if (!userScrolled) {
      const el = scrollContainerRef.current
      if (el) {
        isAutoScrollRef.current = true
        el.scrollTop = el.scrollHeight
        requestAnimationFrame(() => {
          isAutoScrollRef.current = false
        })
      }
    }
  }, [displayMessages, userScrolled, isExecutingTools])

  // Reset user scroll when new message added
  const prevLenRef = useRef(displayMessages.length)
  useEffect(() => {
    if (displayMessages.length > prevLenRef.current) {
      const last = displayMessages[displayMessages.length - 1]
      if (last.role === 'user') {
        setUserScrolled(false)
      }
    }
    prevLenRef.current = displayMessages.length
  }, [displayMessages])

  const handleScroll = useCallback(() => {
    if (isAutoScrollRef.current) return
    const el = scrollContainerRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40
    setUserScrolled(!atBottom)
  }, [])

  const scrollToBottom = useCallback(() => {
    setUserScrolled(false)
    const el = scrollContainerRef.current
    if (el) {
      isAutoScrollRef.current = true
      el.scrollTop = el.scrollHeight
      requestAnimationFrame(() => {
        isAutoScrollRef.current = false
      })
    }
  }, [])

  const adjustHeight = (): void => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }

  const handleSubmit = (): void => {
    const trimmed = input.trim()
    if (!trimmed || isStreaming) return
    sendAssistantMessage(trimmed)
    setInput('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.nativeEvent.isComposing || isComposingRef.current) return
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleStop = (): void => {
    stopStreaming(BROWSER_ASSISTANT_ID)
  }

  const handleClear = (): void => {
    clearConversation(BROWSER_ASSISTANT_ID)
  }

  return (
    <div className="flex h-full flex-col">
      {/* Messages area */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-3 space-y-3"
      >
        {displayMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center pt-16 text-center">
            <div className="mb-3 text-4xl opacity-20">🤖</div>
            <p className="text-sm font-medium text-gray-500">Browser Assistant</p>
            <p className="mt-1 text-xs text-gray-400">
              Control your browser with AI
            </p>
            <div className="mt-4 space-y-1.5 text-xs text-gray-400">
              <p
                className="cursor-pointer rounded-md px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800"
                onClick={() => sendAssistantMessage('Open github.com')}
              >
                "Open github.com"
              </p>
              <p
                className="cursor-pointer rounded-md px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800"
                onClick={() => sendAssistantMessage('What tabs do I have open?')}
              >
                "What tabs do I have open?"
              </p>
              <p
                className="cursor-pointer rounded-md px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800"
                onClick={() => sendAssistantMessage('Summarize the current page')}
              >
                "Summarize the current page"
              </p>
              <p
                className="cursor-pointer rounded-md px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800"
                onClick={() => sendAssistantMessage('Search for TypeScript best practices')}
              >
                "Search for TypeScript best practices"
              </p>
            </div>
          </div>
        )}

        {displayMessages.map((msg, i) => (
          <MessageBubble
            key={i}
            role={msg.role}
            content={msg.content}
            isStreaming={msg.isStreaming ?? false}
          />
        ))}

        {isExecutingTools && (
          <div className="flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
            <div className="h-3 w-3 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
            Executing tools...
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Scroll to bottom button */}
      {isStreaming && userScrolled && (
        <div className="flex justify-center py-1">
          <button
            onClick={scrollToBottom}
            className="flex items-center gap-1 rounded-full bg-gray-200 px-3 py-1 text-[11px] text-gray-600
              hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
            Scroll to bottom
          </button>
        </div>
      )}

      {/* Input area */}
      <div className="border-t border-gray-200 p-3 dark:border-gray-700">
        {displayMessages.length > 0 && (
          <div className="mb-2 flex justify-end">
            <button
              onClick={handleClear}
              className="rounded px-2 py-1 text-[11px] text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
            >
              Clear conversation
            </button>
          </div>
        )}
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => { setInput(e.target.value); adjustHeight() }}
            onCompositionStart={() => { isComposingRef.current = true }}
            onCompositionEnd={() => { isComposingRef.current = false }}
            onKeyDown={handleKeyDown}
            placeholder="Ask the assistant..."
            rows={1}
            className="flex-1 resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm
              focus:outline-none focus:ring-2 focus:ring-blue-500
              dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
          />
          {isStreaming ? (
            <button
              onClick={handleStop}
              className="shrink-0 rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600"
            >
              Stop
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!input.trim()}
              className="shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white
                hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Send
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
