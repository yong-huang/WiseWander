import { useState, useRef, useEffect, useCallback } from 'react'
import { MessageBubble } from './MessageBubble'
import { useAIStore } from '../../store/ai-store'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  isStreaming?: boolean
}

interface ChatPanelProps {
  messages: ChatMessage[]
  isStreaming: boolean
  onSend: (message: string) => void
  onStop: () => void
}

export function ChatPanel({ messages, isStreaming, onSend, onStop }: ChatPanelProps): React.ReactElement {
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const isComposingRef = useRef(false)
  const [userScrolled, setUserScrolled] = useState(false)
  const isAutoScrollRef = useRef(false)
  const isExecutingTools = useAIStore((s) => s.isExecutingTools)

  // Reset stuck streaming state on mount
  useEffect(() => {
    useAIStore.setState({ isStreaming: false })
  }, [])

  // Auto-scroll: use scrollTop (instant) to avoid smooth-scroll animation conflicts
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
  }, [messages, userScrolled])

  // When a new user message is sent, reset to auto-scroll
  const prevLenRef = useRef(messages.length)
  useEffect(() => {
    if (messages.length > prevLenRef.current) {
      const last = messages[messages.length - 1]
      if (last.role === 'user') {
        setUserScrolled(false)
      }
    }
    prevLenRef.current = messages.length
  }, [messages])

  // Detect manual scroll (skip if triggered by auto-scroll)
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

  // Auto-resize textarea
  const adjustHeight = (): void => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }

  const handleSubmit = (): void => {
    const trimmed = input.trim()
    if (!trimmed || isStreaming) return
    onSend(trimmed)
    setInput('')
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  const handleStop = (): void => {
    onStop()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.nativeEvent.isComposing || isComposingRef.current) return
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Messages area */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-3 space-y-3"
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center pt-16 text-center">
            <div className="mb-3 text-4xl opacity-20">💬</div>
            <p className="text-sm text-gray-400">
              Ask about this page, summarize, translate, or interact with it...
            </p>
            <div className="mt-4 space-y-1.5 text-xs text-gray-400">
              <p className="cursor-pointer rounded-md px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800"
                onClick={() => onSend('Summarize this page')}
              >
                "Summarize this page"
              </p>
              <p className="cursor-pointer rounded-md px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800"
                onClick={() => onSend('Translate this page to Japanese')}
              >
                "Translate this page to Japanese"
              </p>
              <p className="cursor-pointer rounded-md px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800"
                onClick={() => onSend('Extract all links')}
              >
                "Extract all links"
              </p>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <MessageBubble
            key={i}
            role={msg.role}
            content={msg.content}
            isStreaming={msg.isStreaming ?? false}
          />
        ))}

        {isExecutingTools && (
          <div className="flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
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
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => { setInput(e.target.value); adjustHeight() }}
            onCompositionStart={() => { isComposingRef.current = true }}
            onCompositionEnd={() => { isComposingRef.current = false }}
            onKeyDown={handleKeyDown}
            placeholder="Ask about this page, summarize, translate..."
            rows={1}
            className="flex-1 resize-none rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm shadow-inner
              transition-all focus:bg-white focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10
              dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 dark:focus:border-indigo-500"
          />
          {isStreaming ? (
            <button
              onClick={handleStop}
              className="shrink-0 rounded-xl bg-red-500/95 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-red-600 active:scale-95 shadow-sm"
            >
              Stop
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!input.trim()}
              className="shrink-0 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 px-4 py-2 text-sm font-medium text-white
                shadow-sm transition-all hover:shadow-md hover:brightness-110 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Send
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
