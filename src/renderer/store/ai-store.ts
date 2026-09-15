import { create } from 'zustand'
import type { Conversation, ChatMessage, ProviderStatus } from '@shared/types'
import { BROWSER_ASSISTANT_ID } from '../../shared/constants'
import { parseToolCalls, executeToolCall, buildAssistantSystemPrompt, TAB_CHAT_TOOL_NAMES } from '../utils/browser-tools'
import { useDevToolsStore } from './devtools-store'

type OllamaStatus = 'online' | 'offline' | 'checking'

interface AIState {
  conversations: Map<string, Conversation>
  isStreaming: boolean
  isExecutingTools: boolean
  currentModel: string
  ollamaStatus: OllamaStatus
  providerStatuses: ProviderStatus[]
  activeProviderId: string | null
  /** Text staged for the Translate panel (e.g. from right-click "AI translate selection") */
  pendingTranslate: string | null
}

interface AIActions {
  sendMessage: (tabId: string, message: string) => Promise<void>
  sendAssistantMessage: (message: string) => Promise<void>
  stopStreaming: (tabId: string) => Promise<void>
  summarize: (tabId: string) => Promise<string>
  translate: (text: string, targetLang: string) => Promise<string>
  setOllamaStatus: (status: OllamaStatus) => void
  setModel: (model: string) => Promise<void>
  clearConversation: (tabId: string) => void
  setupStreamListener: () => () => void
  setProviderStatuses: (statuses: ProviderStatus[]) => void
  setActiveProviderId: (id: string | null) => void
  setPendingTranslate: (text: string | null) => void
}

export type AIStore = AIState & AIActions

let streamListenerCleanup: (() => void) | null = null

export const useAIStore = create<AIStore>((set, get) => ({
  conversations: new Map(),
  isStreaming: false,
  isExecutingTools: false,
  currentModel: '',
  ollamaStatus: 'checking',
  providerStatuses: [],
  activeProviderId: null,
  pendingTranslate: null,

  /**
   * Stop the in-flight stream for a conversation. Aborts the actual HTTP
   * request in the main process — not just the local UI state.
   */
  stopStreaming: async (tabId: string) => {
    try {
      await window.api.aiChatStop(tabId)
    } catch (error) {
      console.error('Failed to stop AI stream:', error)
    }
    set({ isStreaming: false })
  },

  sendMessage: async (tabId: string, message: string) => {
    const { conversations, currentModel } = get()

    // Create or retrieve conversation
    let conversation = conversations.get(tabId)
    if (!conversation) {
      conversation = {
        id: tabId,
        tabUrl: '',
        model: currentModel,
        messages: [],
        createdAt: Date.now(),
      }
    }

    // Append user message
    const userMessage: ChatMessage = { role: 'user', content: message }
    const updatedConversation: Conversation = {
      ...conversation,
      messages: [...conversation.messages, userMessage],
    }

    const newConversations = new Map(conversations)
    newConversations.set(tabId, updatedConversation)
    set({ conversations: newConversations, isStreaming: true })

    // Add a placeholder assistant message that we will stream into
    const assistantMessage: ChatMessage = { role: 'assistant', content: '' }
    const streamingConversation: Conversation = {
      ...updatedConversation,
      messages: [...updatedConversation.messages, assistantMessage],
    }
    const streamConversations = new Map(conversations)
    streamConversations.set(tabId, streamingConversation)
    set({ conversations: streamConversations })

    // Send to the main process; streaming updates arrive via onChatStream
    try {
      await window.api.aiChatSend(tabId, message)
    } catch (error) {
      console.error('Failed to send AI message:', error)
      set({ isStreaming: false })
    }
  },

  sendAssistantMessage: async (message: string) => {
    const { conversations, currentModel, isStreaming } = get()
    if (isStreaming) return

    const tabId = BROWSER_ASSISTANT_ID

    // Create or retrieve conversation
    let conversation = conversations.get(tabId)
    if (!conversation) {
      conversation = {
        id: tabId,
        tabUrl: '',
        model: currentModel,
        messages: [],
        createdAt: Date.now(),
      }
    }

    // Append user message
    const userMessage: ChatMessage = { role: 'user', content: message }
    const updatedConversation: Conversation = {
      ...conversation,
      messages: [...conversation.messages, userMessage],
    }

    const newConversations = new Map(conversations)
    newConversations.set(tabId, updatedConversation)
    set({ conversations: newConversations, isStreaming: true })

    // Add a placeholder assistant message
    const assistantMessage: ChatMessage = { role: 'assistant', content: '' }
    const streamingConversation: Conversation = {
      ...updatedConversation,
      messages: [...updatedConversation.messages, assistantMessage],
    }
    const streamConversations = new Map(conversations)
    streamConversations.set(tabId, streamingConversation)
    set({ conversations: streamConversations })

    // Wrap message with system prompt and send
    const systemPrompt = buildAssistantSystemPrompt()
    const wrappedMessage = `<system>${systemPrompt}</system>\n\n${message}`

    try {
      await window.api.aiChatSend(tabId, wrappedMessage, undefined, 'assistant')
    } catch (error) {
      console.error('Failed to send assistant message:', error)
      set({ isStreaming: false })
    }
  },

  summarize: async (tabId: string) => {
    const result = await window.api.aiSummarize(tabId)
    return result as string
  },

  translate: async (text: string, targetLang: string) => {
    const result = await window.api.aiTranslate(text, targetLang)
    return result as string
  },

  setOllamaStatus: (status: OllamaStatus) => {
    set({ ollamaStatus: status })
  },

  setModel: async (model: string) => {
    await window.api.ollamaSetModel(model)
    set({ currentModel: model })
  },

  clearConversation: (tabId: string) => {
    const { conversations } = get()
    const newConversations = new Map(conversations)
    newConversations.delete(tabId)
    set({ conversations: newConversations })
  },

  setupStreamListener: () => {
    // Re-register every time (previous listener may have been cleaned up)
    if (streamListenerCleanup) {
      streamListenerCleanup()
      streamListenerCleanup = null
    }

    const cleanup = window.api.onChatStream(
      async (data: { tabId: string; text: string; delta: string; thinking?: string; done: boolean; error?: string; debug?: { type: string; model: string; message?: string; error?: string; timestamp: number; duration?: number } }) => {
        // Log to DevTools
        const dt = useDevToolsStore.getState()
        if (data.debug) {
          if (data.debug.type === 'request') {
            dt.addAIDebugEntry({
              id: `ai-req-${Date.now()}`,
              type: 'request',
              action: 'chat',
              model: data.debug.model,
              content: data.debug.message ?? '',
              timestamp: data.debug.timestamp,
            })
          } else if (data.debug.type === 'error') {
            dt.addAIDebugEntry({
              id: `ai-err-${Date.now()}`,
              type: 'error',
              action: 'chat',
              model: data.debug.model,
              content: data.debug.error ?? 'Unknown error',
              duration: data.debug.duration,
              timestamp: data.debug.timestamp,
            })
          }
        }

        if (data.error && data.done) {
          dt.addAIDebugEntry({
            id: `ai-err-${Date.now()}`,
            type: 'error',
            action: 'chat',
            model: '',
            content: data.error,
            timestamp: Date.now(),
          })
        }

        if (data.done && !data.error && !data.debug?.type) {
          dt.addAIDebugEntry({
            id: `ai-res-${Date.now()}`,
            type: 'response',
            action: 'chat',
            model: '',
            content: data.text.slice(0, 300) + (data.text.length > 300 ? '...' : ''),
            timestamp: Date.now(),
          })
        }

        const { conversations } = get()
        const conversation = conversations.get(data.tabId)
        if (!conversation) return

        const messages = [...conversation.messages]
        const lastMessage = messages[messages.length - 1]

        if (lastMessage && lastMessage.role === 'assistant') {
          // Show error message if there's an error
          let displayContent: string
          if (data.error) {
            displayContent = `Error: ${data.error}`
          } else if (data.text) {
            // text contains the accumulated non-thinking response
            displayContent = data.text
          } else if (data.thinking) {
            // Model is in thinking phase — show thinking indicator
            displayContent = `💭 Thinking...\n${data.thinking}`
          } else {
            displayContent = lastMessage.content + data.delta
          }
          messages[messages.length - 1] = {
            ...lastMessage,
            content: displayContent,
          }
        }

        const updatedConversation: Conversation = {
          ...conversation,
          messages,
        }

        const newConversations = new Map(conversations)
        newConversations.set(data.tabId, updatedConversation)

        if (data.done) {
          set({ conversations: newConversations, isStreaming: false })

          // Execute assistant tools if this is a tool-enabled conversation
          if (!data.error) {
            const isBrowserAssistant = data.tabId === BROWSER_ASSISTANT_ID
            const assistantContent = messages[messages.length - 1]?.content ?? ''
            const toolCalls = parseToolCalls(assistantContent)
            // Filter tools by context: browser assistant can use any tool, tab chat only page tools
            const filteredCalls = isBrowserAssistant
              ? toolCalls
              : toolCalls.filter(c => TAB_CHAT_TOOL_NAMES.has(c.name))
            if (filteredCalls.length > 0) {
              console.log(`[${isBrowserAssistant ? 'Assistant' : 'TabChat'}] Found ${filteredCalls.length} tool call(s):`, filteredCalls.map(c => c.name))
              set({ isExecutingTools: true, isStreaming: true })
              // Execute tools sequentially — wrapped in try-catch to surface errors
              ;(async () => {
                try {
                  let updatedContent = assistantContent
                  for (const call of filteredCalls) {
                    console.log(`[${isBrowserAssistant ? 'Assistant' : 'TabChat'}] Executing tool: ${call.name}`, call.args)
                    const result = await executeToolCall(call)
                    console.log(`[${isBrowserAssistant ? 'Assistant' : 'TabChat'}] Tool ${call.name} result:`, result)
                    updatedContent = updatedContent.replace(call.raw, `> **${call.name}:** ${result.success ? result.display : `Error: ${result.display}`}`)
                  }
                  // Update the assistant message with tool results
                  const { conversations: convos } = get()
                  const conv = convos.get(data.tabId)
                  if (conv) {
                    const msgs = [...conv.messages]
                    const last = msgs[msgs.length - 1]
                    if (last && last.role === 'assistant') {
                      msgs[msgs.length - 1] = { ...last, content: updatedContent }
                      const updated = new Map(convos)
                      updated.set(data.tabId, { ...conv, messages: msgs })
                      set({ conversations: updated })
                    }
                  }
                } catch (err) {
                  console.error('[Assistant] Tool execution error:', err)
                } finally {
                  console.log('[Assistant] Tool execution finished, resetting flags')
                  set({ isExecutingTools: false, isStreaming: false })
                }
              })()
            }
          }
        } else {
          set({ conversations: newConversations })
        }
      }
    )

    streamListenerCleanup = cleanup
    return cleanup
  },

  setProviderStatuses: (statuses: ProviderStatus[]) => {
    set({ providerStatuses: statuses })
  },

  setActiveProviderId: (id: string | null) => {
    set({ activeProviderId: id })
  },

  setPendingTranslate: (text: string | null) => {
    set({ pendingTranslate: text })
  },
}))
