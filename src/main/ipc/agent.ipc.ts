import { ipcMain, BrowserWindow, webContents } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import { ToolRegistry } from '../services/agent/tool-registry'
import { registerBuiltinTools } from '../services/agent/tools'
import { aiProcessTool } from '../services/agent/tools/ai-process'
import { AgentController, type ControllerEvent, type ControllerToolContext } from '../services/agent/controller'
import { modelRouter } from '../services/ai/router-instance'
import type { AgentTask } from '../../shared/types'

const toolRegistry = new ToolRegistry()
registerBuiltinTools(toolRegistry)
toolRegistry.register(aiProcessTool)

export { toolRegistry }

/** In-flight agent runs, keyed by task id — enables real cancellation. */
const activeTasks = new Map<string, AbortController>()

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

      try {
        const loop = new AgentController({
          goal: description,
          registry: toolRegistry,
          // The agent reasons through ModelRouter: privacy mode and the
          // configured provider priority are respected (D4).
          router: { chatSync: (messages) => modelRouter.chatSync(messages) },
          executeJs: (code) => toolContext.webContents.executeJavaScript(code),
          toolContext,
          emit,
          signal: abort.signal,
        })

        const result = await loop.run()

        task.steps = result.steps
        task.status = result.status === 'completed' ? 'completed' : 'failed'
        task.result =
          result.status === 'completed'
            ? { success: true, data: result.report }
            : { success: false, error: `${result.report} (${result.status}, ${result.iterations} step(s))` }
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

  // ── Cancel a running agent task ──
  ipcMain.handle(IPC_CHANNELS.AGENT_CANCEL, (_event, taskId?: string) => {
    if (taskId) {
      activeTasks.get(taskId)?.abort()
    } else {
      for (const controller of activeTasks.values()) {
        controller.abort()
      }
    }
  })
}
