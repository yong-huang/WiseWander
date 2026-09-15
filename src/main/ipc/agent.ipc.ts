import { ipcMain, BrowserWindow, webContents } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import { Planner } from '../services/agent/planner'
import { ToolRegistry } from '../services/agent/tool-registry'
import { registerBuiltinTools } from '../services/agent/tools'
import { aiProcessTool } from '../services/agent/tools/ai-process'
import { ollamaClient, modelManager } from './ai.ipc'
import type { AgentTask } from '../../shared/types'

const toolRegistry = new ToolRegistry()
registerBuiltinTools(toolRegistry)
toolRegistry.register(aiProcessTool)

// Lazy model lookup so planner always uses the currently selected model
const planner = new Planner(ollamaClient, toolRegistry, () => modelManager.getCurrentModel())

export { toolRegistry, planner }

/** In-flight agent tasks, keyed by task id — enables real cancellation. */
const activeTasks = new Map<string, AbortController>()

export function registerAgentIpc(): void {
  ipcMain.handle(
    IPC_CHANNELS.AGENT_EXECUTE,
    async (event, description: string, webContentsId?: number, tabId?: string): Promise<AgentTask> => {
      const win = BrowserWindow.fromWebContents(event.sender)

      // Build context with the webview's webContents for tool execution
      const guestWC = webContentsId ? webContents.fromId(webContentsId) : null
      const toolContext = guestWC ? {
        webContents: {
          loadURL: (url: string) => guestWC.loadURL(url),
          getURL: () => guestWC.getURL(),
          getTitle: () => guestWC.getTitle(),
          executeJavaScript: (code: string) => guestWC.executeJavaScript(code),
        },
      } : {}

      const task: AgentTask = {
        id: crypto.randomUUID(),
        description,
        steps: [],
        status: 'planning',
      }

      const controller = new AbortController()
      activeTasks.set(task.id, controller)

      // Every progress event carries the owning tabId so the renderer
      // routes steps to the correct per-tab session even when the user
      // switches tabs mid-execution.
      const send = (payload: Record<string, unknown>): void => {
        win?.webContents.send(IPC_CHANNELS.AGENT_STEP_UPDATE, { tabId, ...payload })
      }

      try {
        // Step 1: Plan
        task.steps = await planner.plan(description)

        if (task.steps.length === 0) {
          task.status = 'failed'
          task.result = {
            success: false,
            error: 'This task cannot be completed with the available tools. Available tools: navigate, click, type, extract, scroll, wait, ai_process. Try a more specific browser-action description.',
          }
          return task
        }

        task.status = 'executing'

        // Notify renderer of plan
        send({ taskId: task.id, type: 'plan', steps: task.steps })

        // Step 2: Execute
        let previousOutput: unknown = null
        for (const step of task.steps) {
          if (controller.signal.aborted) {
            step.status = 'error'
            step.output = 'Cancelled by user'
            continue
          }

          step.status = 'running'
          send({ taskId: task.id, type: 'step_update', step })

          try {
            const tool = toolRegistry.get(step.tool)
            if (!tool) throw new Error(`Unknown tool: ${step.tool}`)

            // Resolve <previous_result> placeholders in step input
            const resolvedInput = resolvePlaceholders(step.input, previousOutput)

            step.output = await tool.execute(resolvedInput, toolContext)
            step.status = 'done'
            previousOutput = step.output
          } catch (err) {
            step.status = 'error'
            step.output = err instanceof Error ? err.message : String(err)
            previousOutput = step.output
          }

          send({ taskId: task.id, type: 'step_update', step })
        }

        if (controller.signal.aborted) {
          task.status = 'failed'
          task.result = { success: false, error: 'Cancelled by user' }
        } else {
          task.status = 'completed'
          task.result = {
            success: task.steps.every((s) => s.status === 'done'),
            data: task.steps.map((s) => s.output),
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

/**
 * Recursively replace "<previous_result>" placeholders in step input
 * with the actual output from the previous step.
 */
function resolvePlaceholders(
  input: Record<string, unknown>,
  previousOutput: unknown,
): Record<string, unknown> {
  const resolved: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === 'string' && value === '<previous_result>') {
      // Convert previous output to string
      resolved[key] = typeof previousOutput === 'string'
        ? previousOutput
        : JSON.stringify(previousOutput)
    } else if (typeof value === 'string' && value.includes('<previous_result>')) {
      const replacement = typeof previousOutput === 'string'
        ? previousOutput
        : JSON.stringify(previousOutput)
      resolved[key] = value.replace(/<previous_result>/g, replacement)
    } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      resolved[key] = resolvePlaceholders(value as Record<string, unknown>, previousOutput)
    } else {
      resolved[key] = value
    }
  }
  return resolved
}
