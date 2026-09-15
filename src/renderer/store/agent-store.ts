import { create } from 'zustand'
import type { AgentTask, AgentStep } from '@shared/types'
import { useTabStore } from './tab-store'

/** Non-hook helper: read the active tab id outside React render. */
function getActiveTabId(): string | null {
  return useTabStore.getState().activeTabId
}

interface TabAgentState {
  tasks: AgentTask[]
  activeTask: AgentTask | null
  isExecuting: boolean
}

interface AgentActions {
  // Per-tab selectors
  getTabState: (tabId: string) => TabAgentState
  executeTask: (tabId: string, description: string) => Promise<void>
  cancelTask: (tabId: string) => Promise<void>
  setActiveTask: (tabId: string, task: AgentTask | null) => void
  updateStep: (tabId: string, taskId: string, step: AgentStep) => void
  setupStepListener: () => () => void
}

export type AgentStore = {
  sessions: Map<string, TabAgentState>
} & AgentActions

const defaultTabState = (): TabAgentState => ({
  tasks: [],
  activeTask: null,
  isExecuting: false,
})

let stepListenerCleanup: (() => void) | null = null

export const useAgentStore = create<AgentStore>((set, get) => ({
  sessions: new Map(),

  getTabState: (tabId: string): TabAgentState => {
    return get().sessions.get(tabId) ?? defaultTabState()
  },

  executeTask: async (tabId: string, description: string) => {
    set((state) => {
      const sessions = new Map(state.sessions)
      const s = sessions.get(tabId) ?? defaultTabState()
      sessions.set(tabId, { ...s, isExecuting: true })
      return { sessions }
    })

    try {
      const activeWebview = document.querySelector(
        `webview[data-tab-id="${tabId}"]`
      ) as Electron.WebviewTag | null
      const wcId = activeWebview?.getWebContentsId?.()

      // Pass tabId so main-process step events route back to this session
      const result = await window.api.agentExecute(description, wcId, tabId)

      const task = result as AgentTask
      if (task?.id) {
        set((state) => {
          const sessions = new Map(state.sessions)
          const s = sessions.get(tabId) ?? defaultTabState()
          sessions.set(tabId, {
            tasks: [...s.tasks, task],
            activeTask: task,
            isExecuting: false,
          })
          return { sessions }
        })
      } else {
        set((state) => {
          const sessions = new Map(state.sessions)
          const s = sessions.get(tabId) ?? defaultTabState()
          sessions.set(tabId, { ...s, isExecuting: false })
          return { sessions }
        })
      }
    } catch (error) {
      console.error('Failed to execute agent task:', error)
      set((state) => {
        const sessions = new Map(state.sessions)
        const s = sessions.get(tabId) ?? defaultTabState()
        sessions.set(tabId, { ...s, isExecuting: false })
        return { sessions }
      })
    }
  },

  cancelTask: async (tabId: string) => {
    const session = get().sessions.get(tabId)
    const taskId = session?.activeTask?.id
    if (!taskId) return

    // Ask the main process to abort the running task
    try {
      await window.api.agentCancel(taskId)
    } catch (error) {
      console.error('Failed to cancel agent task:', error)
    }

    set((state) => {
      const sessions = new Map(state.sessions)
      const s = sessions.get(tabId) ?? defaultTabState()
      sessions.set(tabId, {
        activeTask: s.activeTask ? { ...s.activeTask, status: 'failed' } : null,
        tasks: s.tasks.map((t) =>
          t.id === taskId ? { ...t, status: 'failed' as const } : t
        ),
        isExecuting: false,
      })
      return { sessions }
    })
  },

  setActiveTask: (tabId: string, task: AgentTask | null) => {
    set((state) => {
      const sessions = new Map(state.sessions)
      const s = sessions.get(tabId) ?? defaultTabState()
      sessions.set(tabId, { ...s, activeTask: task })
      return { sessions }
    })
  },

  updateStep: (tabId: string, taskId: string, step: AgentStep) => {
    set((state) => {
      const sessions = new Map(state.sessions)
      const s = sessions.get(tabId) ?? defaultTabState()

      const updateStepsInTask = (t: AgentTask): AgentTask => {
        if (t.id !== taskId) return t
        const steps = [...t.steps]
        const stepIndex = steps.findIndex((si) => si.id === step.id)
        if (stepIndex !== -1) {
          steps[stepIndex] = step
        } else {
          steps.push(step)
        }
        return { ...t, steps }
      }

      const updatedTasks = s.tasks.map(updateStepsInTask)
      const updatedActiveTask = s.activeTask ? updateStepsInTask(s.activeTask) : null

      const targetTask = updatedTasks.find((t) => t.id === taskId)
      const isDone = targetTask?.status === 'completed' || targetTask?.status === 'failed'

      sessions.set(tabId, {
        tasks: updatedTasks,
        activeTask: updatedActiveTask,
        isExecuting: isDone ? false : s.isExecuting,
      })
      return { sessions }
    })
  },

  setupStepListener: () => {
    if (stepListenerCleanup) {
      stepListenerCleanup()
      stepListenerCleanup = null
    }

    const cleanup = window.api.onAgentStep((data: unknown) => {
      const stepData = data as {
        tabId?: string
        taskId: string
        step: AgentStep
        taskStatus?: AgentTask['status']
        result?: unknown
      }

      const { tabId, taskId, step, taskStatus, result } = stepData
      // Route to the session that owns the task; fall back to the active tab
      // for payloads sent before tabId was part of the protocol.
      const sessionTabId = tabId ?? getActiveTabId() ?? ''

      get().updateStep(sessionTabId, taskId, step)

      if (taskStatus) {
        set((state) => {
          const sessions = new Map(state.sessions)
          const s = sessions.get(sessionTabId) ?? defaultTabState()

          const updatedTasks = s.tasks.map((t) =>
            t.id === taskId
              ? { ...t, status: taskStatus, result: result ? { success: taskStatus === 'completed', data: result } : t.result }
              : t
          )
          const updatedActiveTask = s.activeTask?.id === taskId
            ? {
                ...s.activeTask,
                status: taskStatus,
                result: result ? { success: taskStatus === 'completed', data: result } : s.activeTask.result,
              }
            : s.activeTask

          const isDone = taskStatus === 'completed' || taskStatus === 'failed'

          sessions.set(sessionTabId, {
            tasks: updatedTasks,
            activeTask: updatedActiveTask,
            isExecuting: isDone ? false : s.isExecuting,
          })
          return { sessions }
        })
      }
    })

    stepListenerCleanup = cleanup
    return cleanup
  },
}))
