import { ipcMain, BrowserWindow, webContents } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import { ToolRegistry } from '../services/agent/tool-registry'
import { registerBuiltinTools } from '../services/agent/tools'
import { aiProcessTool } from '../services/agent/tools/ai-process'
import { AgentController, type ControllerEvent, type ControllerToolContext } from '../services/agent/controller'
import { AgentRunStore } from '../services/agent/run-store'
import { modelRouter } from '../services/ai/router-instance'
import { getDatabase } from '../store/database'
import { AGENT_SITE_HINT_COUNT } from '../../shared/constants'
import type { AgentTask } from '../../shared/types'

const toolRegistry = new ToolRegistry()
registerBuiltinTools(toolRegistry)
toolRegistry.register(aiProcessTool)

export { toolRegistry }

/** In-flight agent runs, keyed by task id — enables real cancellation. */
const activeTasks = new Map<string, AbortController>()

/** Pending confirmation resolvers, keyed by task id (user gates, AT-003). */
const pendingConfirms = new Map<string, (approved: boolean) => void>()

/** Lazily created — getDatabase() requires the app to be ready. */
let runStore: AgentRunStore | null = null
function getRunStore(): AgentRunStore {
  if (!runStore) runStore = new AgentRunStore(getDatabase())
  return runStore
}

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

/** Compact one-line trace of the executed steps, stored as a site note. */
function traceDigest(steps: AgentTask['steps']): string {
  const trace = steps
    .map((s) => {
      const detail =
        typeof s.input.url === 'string'
          ? s.input.url
          : typeof s.input.ref === 'string'
          ? `ref ${s.input.ref}`
          : typeof s.input.text === 'string'
          ? `"${String(s.input.text).slice(0, 20)}"`
          : ''
      return `${s.tool}${detail ? `(${detail})` : ''}`
    })
    .join(' → ')
  return `${steps.length} step(s): ${trace}`
}

export function registerAgentIpc(): void {
  ipcMain.handle(
    IPC_CHANNELS.AGENT_EXECUTE,
    async (event, description: string, webContentsId?: number, tabId?: string): Promise<AgentTask> => {
      const win = BrowserWindow.fromWebContents(event.sender)

      // Build context with the webview's webContents for tool execution
      const guestWC = webContentsId ? webContents.fromId(webContentsId) : null
      if (!guestWC) {
        return {
          id: crypto.randomUUID(),
          description,
          steps: [],
          status: 'failed',
          result: { success: false, error: 'No active page to act on.' },
        }
      }
      const toolContext: ControllerToolContext = {
        webContents: {
          loadURL: (url: string) => guestWC.loadURL(url),
          getURL: () => guestWC.getURL(),
          getTitle: () => guestWC.getTitle(),
          executeJavaScript: (code: string) => guestWC.executeJavaScript(code),
        },
      }

      const task: AgentTask = {
        id: crypto.randomUUID(),
        description,
        steps: [],
        status: 'executing',
      }

      const abort = new AbortController()
      activeTasks.set(task.id, abort)

      // Every progress event carries the owning tabId so the renderer
      // routes steps to the correct per-tab session even when the user
      // switches tabs mid-execution.
      const emit = (payload: ControllerEvent): void => {
        win?.webContents.send(IPC_CHANNELS.AGENT_STEP_UPDATE, { tabId, taskId: task.id, ...payload })
      }

      // Risky actions pause the loop until the user approves or denies.
      const requestConfirmation = async (message: string): Promise<boolean> => {
        emit({ type: 'confirm', iteration: 0, message })
        return new Promise<boolean>((resolve) => {
          pendingConfirms.set(task.id, resolve)
          setTimeout(() => {
            if (pendingConfirms.has(task.id)) {
              pendingConfirms.delete(task.id)
              resolve(false) // silence is treated as denial, never as consent
            }
          }, 120_000)
        })
      }

      // Phase 3 memory: persist the run and inject site experience hints.
      let runId: string | null = null
      let siteHints: string[] = []
      try {
        const store = getRunStore()
        const startUrl = toolContext.webContents.getURL()
        const domain = domainOf(startUrl)
        runId = store.startRun(description, startUrl)
        if (domain) siteHints = store.getSiteNotes(domain, AGENT_SITE_HINT_COUNT)

        const emitting = (payload: ControllerEvent): void => {
          emit(payload)
          if (payload.type === 'action' && runId) {
            store.recordStep(runId, payload.iteration, payload.step.tool, payload.step.input, payload.step.status)
          }
        }

        const loop = new AgentController({
          goal: description,
          registry: toolRegistry,
          // The agent reasons through ModelRouter: privacy mode and the
          // configured provider priority are respected (D4).
          router: { chatSync: (messages) => modelRouter.chatSync(messages) },
          executeJs: (code) => toolContext.webContents.executeJavaScript(code),
          toolContext,
          emit: emitting,
          signal: abort.signal,
          confirm: requestConfirmation,
          siteHints,
        })

        const result = await loop.run()

        task.steps = result.steps
        task.status = result.status === 'completed' ? 'completed' : 'failed'
        task.result =
          result.status === 'completed'
            ? { success: true, data: result.report }
            : { success: false, error: `${result.report} (${result.status}, ${result.iterations} step(s))` }

        if (runId) {
          store.finishRun(runId, result.status, result.report, result.iterations, result.promptChars)
          // Successful runs leave an experience note for the site.
          if (result.status === 'completed' && domain && task.steps.length > 0) {
            try {
              store.addSiteNote(domain, traceDigest(task.steps))
            } catch {
              // notes are advisory; never fail the run over them
            }
          }
        }
      } catch (err) {
        task.status = 'failed'
        task.result = {
          success: false,
          error: err instanceof Error ? err.message : String(err),
        }
      } finally {
        activeTasks.delete(task.id)
      }

      return task
    }
  )

  // ── Cancel a running agent task (also settles any pending confirmation) ──
  ipcMain.handle(IPC_CHANNELS.AGENT_CANCEL, (_event, taskId?: string) => {
    if (taskId) {
      activeTasks.get(taskId)?.abort()
      pendingConfirms.get(taskId)?.(false)
      pendingConfirms.delete(taskId)
    } else {
      for (const controller of activeTasks.values()) {
        controller.abort()
      }
      for (const resolve of pendingConfirms.values()) resolve(false)
      pendingConfirms.clear()
    }
  })

  // ── Run history (Phase 3 memory) ──
  ipcMain.handle(IPC_CHANNELS.AGENT_HISTORY_LIST, (_event, limit?: number) => {
    return getRunStore().listRuns(limit ?? 20)
  })

  ipcMain.handle(IPC_CHANNELS.AGENT_HISTORY_GET, (_event, id: string) => {
    return getRunStore().getRun(id)
  })

  // ── User decision on a confirmation gate ──
  ipcMain.handle(IPC_CHANNELS.AGENT_CONFIRM, (_event, taskId: string, approved: boolean) => {
    const resolve = pendingConfirms.get(taskId)
    if (resolve) {
      pendingConfirms.delete(taskId)
      resolve(Boolean(approved))
    }
    return { success: true }
  })
}
