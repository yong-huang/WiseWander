import { ipcMain, BrowserWindow } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import { buildPrompt } from '../services/ai/prompt-builder'
import { ollamaClient } from '../services/ai/router-instance'
import { ModelManager } from '../services/ai/model-manager'
import type { ChatMessage, PageContext } from '../../shared/types'

const modelManager = new ModelManager(ollamaClient)

export { ollamaClient, modelManager }

/**
 * Active streaming chat requests keyed by tabId (or the special
 * browser-assistant conversation id). The Stop button aborts the
 * underlying HTTP request via these controllers.
 */
const activeStreams = new Map<string, AbortController>()

export function registerAiIpc(modelRouter: { chat: (messages: ChatMessage[], onChunk: (text: string, done: boolean) => void, signal?: AbortSignal) => Promise<{ providerId: string; model: string }>; chatSync: (messages: ChatMessage[]) => Promise<string>; getActiveModelName: () => string }): void {
  // ── Chat ──
  ipcMain.handle(
    IPC_CHANNELS.AI_CHAT_SEND,
    async (event, tabId: string, message: string, pageContext?: PageContext, templateId?: string) => {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (!win) return

      // A new send on the same tab replaces any in-flight stream
      activeStreams.get(tabId)?.abort()
      const controller = new AbortController()
      activeStreams.set(tabId, controller)

      const model = modelRouter.getActiveModelName()
      const startTime = Date.now()

      // Send debug: request started
      win.webContents.send(IPC_CHANNELS.AI_CHAT_STREAM, {
        tabId,
        text: '',
        delta: '',
        done: false,
        debug: { type: 'request', model, message: message.slice(0, 200), timestamp: startTime },
      })

      try {
        let messages: ChatMessage[]

        // Assistant template: extract <system>...</system> tags from message
        if (templateId === 'assistant') {
          const systemMatch = message.match(/<system>([\s\S]*?)<\/system>/)
          const systemContent = systemMatch ? systemMatch[1].trim() : 'You are a helpful browser assistant.'
          const userContent = message.replace(/<system>[\s\S]*?<\/system>\s*/, '').trim()
          messages = [
            { role: 'system', content: systemContent },
            { role: 'user', content: userContent },
          ]
        } else if (pageContext) {
          const { system, user } = buildPrompt('chat', pageContext, message)
          messages = [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ]
        } else {
          messages = [{ role: 'user', content: message }]
        }

        let fullText = ''
        await modelRouter.chat(messages, (delta, done) => {
          fullText += delta
          win.webContents.send(IPC_CHANNELS.AI_CHAT_STREAM, {
            tabId,
            text: fullText,
            delta,
            done,
          })
        }, controller.signal)
      } catch (error) {
        const isAbort = error instanceof Error && (error.name === 'AbortError' || controller.signal.aborted)
        const errMsg = error instanceof Error ? error.message : String(error)
        win.webContents.send(IPC_CHANNELS.AI_CHAT_STREAM, {
          tabId,
          text: '',
          delta: '',
          done: true,
          ...(isAbort ? {} : { error: errMsg }),
          debug: {
            type: 'error',
            error: isAbort ? 'Stopped by user' : errMsg,
            model,
            timestamp: Date.now(),
            duration: Date.now() - startTime,
          },
        })
      } finally {
        if (activeStreams.get(tabId) === controller) {
          activeStreams.delete(tabId)
        }
      }
    }
  )

  // ── Stop streaming (real abort of the in-flight HTTP request) ──
  ipcMain.handle(IPC_CHANNELS.AI_CHAT_STOP, (_event, tabId: string) => {
    activeStreams.get(tabId)?.abort()
  })

  // ── Summarize ──
  ipcMain.handle(
    IPC_CHANNELS.AI_SUMMARIZE,
    async (event, tabId: string, pageContext?: PageContext, length?: string) => {
      if (!pageContext) {
        return { text: 'No page content available for summarization.', done: true }
      }

      const win = BrowserWindow.fromWebContents(event.sender)
      const model = modelRouter.getActiveModelName()
      const startTime = Date.now()

      const { system, user } = buildPrompt('summary', pageContext, '')
      const lengthInstruction =
        length === 'brief'
          ? 'Keep it under 3 sentences.'
          : length === 'detailed'
          ? 'Provide a detailed, section-by-section summary.'
          : 'Provide a standard summary.'

      const messages: ChatMessage[] = [
        { role: 'system', content: system + '\n' + lengthInstruction },
        { role: 'user', content: user },
      ]

      const controller = new AbortController()
      if (win) activeStreams.set(`summarize:${tabId}`, controller)

      try {
        if (win) {
          let fullText = ''
          await modelRouter.chat(messages, (delta, done) => {
            fullText += delta
            win.webContents.send(IPC_CHANNELS.AI_CHAT_STREAM, {
              tabId,
              text: fullText,
              delta,
              done,
            })
          }, controller.signal)
          return { text: fullText, done: true }
        }

        const text = await modelRouter.chatSync(messages)
        return { text, done: true }
      } catch (error) {
        const isAbort = error instanceof Error && (error.name === 'AbortError' || controller.signal.aborted)
        const errMsg = error instanceof Error ? error.message : String(error)
        if (win && !isAbort) {
          win.webContents.send(IPC_CHANNELS.AI_CHAT_STREAM, {
            tabId,
            text: '',
            delta: '',
            done: true,
            error: errMsg,
            debug: { type: 'error', error: errMsg, model, timestamp: Date.now(), duration: Date.now() - startTime },
          })
        }
        return { text: isAbort ? '' : `Error: ${errMsg}`, done: true, error: !isAbort }
      } finally {
        activeStreams.delete(`summarize:${tabId}`)
      }
    }
  )

  // ── Translate ──
  ipcMain.handle(
    IPC_CHANNELS.AI_TRANSLATE,
    async (_event, text: string, targetLang: string) => {
      const messages: ChatMessage[] = [
        {
          role: 'system',
          content: `You are a professional translator. Translate the following text to ${targetLang}. Output only the translation, nothing else.`,
        },
        { role: 'user', content: text },
      ]

      try {
        const result = await modelRouter.chatSync(messages)
        return { text: result, done: true }
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error)
        return { text: `Error: ${errMsg}`, done: true, error: true }
      }
    }
  )

  // ── Smart Tab Name ──
  ipcMain.handle(
    IPC_CHANNELS.AI_SMART_TAB_NAME,
    async (_event, title: string, content: string, url: string) => {
      const messages: ChatMessage[] = [
        {
          role: 'system',
          content: 'Generate a concise, descriptive tab name (max 6 words). Output ONLY the name, no quotes, no punctuation, no explanation.',
        },
        { role: 'user', content: `Page title: ${title}\nURL: ${url}\nExcerpt: ${content}` },
      ]

      try {
        const result = await modelRouter.chatSync(messages)
        const cleaned = result.trim().replace(/^["']|["']$/g, '').replace(/[.!]+$/g, '')
        return { title: cleaned || null }
      } catch {
        return { title: null }
      }
    }
  )

  // ── Ollama status & model management ──
  ipcMain.handle(IPC_CHANNELS.OLLAMA_STATUS, async () => {
    return modelManager.healthCheck()
  })

  ipcMain.handle(IPC_CHANNELS.OLLAMA_LIST_MODELS, async () => {
    return modelManager.listModels()
  })

  ipcMain.handle(IPC_CHANNELS.OLLAMA_SET_MODEL, async (_event, model: string) => {
    return modelManager.selectModel(model)
  })

  ipcMain.handle(
    IPC_CHANNELS.OLLAMA_PULL_MODEL,
    async (event, name: string) => {
      const win = BrowserWindow.fromWebContents(event.sender)
      return modelManager.pullModel(name, (progress) => {
        win?.webContents.send(IPC_CHANNELS.OLLAMA_PULL_PROGRESS, { name, progress })
      })
    }
  )
}
