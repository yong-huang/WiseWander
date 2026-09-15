import { create } from 'zustand'
import type { AgentTask, AgentStep } from '@shared/types'
import { useTabStore } from './tab-store'

/** Non-hook helper: read the active tab id outside React render. */
function getActiveTabId(): string | null {
  return useTabStore.getState().activeTabId
}

/** Live thought/observation lines streamed while a task runs. */
export interface AgentLiveNote {
  kind: 'thought' | 'observation'
  iteration: number
  text: string
}

export interface AgentBudget {
  remainingSteps: number
  remainingMs: number
  maxIterations: number
}

interface TabAgentState {
  tasks: AgentTask[]
  activeTask: AgentTask | null
  isExecuting: boolean
  liveNotes: AgentLiveNote[]
  budget: AgentBudget | null
  /** Non-null while the agent waits for the user to approve a risky action. */
  pendingConfirmation: { taskId: string; message: string } | null
}

interface AgentActions {
  // Per-tab selectors
  getTabState: (tabId: string) => TabAgentState
  executeTask: (tabId: string, description: string) => Promise<void>
  cancelTask: (tabId: string) => Promise<void>
  answerConfirmation: (tabId: string, approved: boolean) => Promise<void>
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
  liveNotes: [],
  budget: null,
  pendingConfirmation: null,
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
            liveNotes: [],
            budget: null,
            pendingConfirmation: null,
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
        liveNotes: s.liveNotes,
        budget: null,
        pendingConfirmation: null,
      })
      return { sessions }
    })
  },

  answerConfirmation: async (tabId: string, approved: boolean) => {
    const session = get().sessions.get(tabId)
    const pending = session?.pendingConfirmation
    if (!pending) return
    try {
      await window.api.agentConfirm(pending.taskId, approved)
    } catch (error) {
      console.error('Failed to answer agent confirmation:', error)
    }
    set((state) => {
      const sessions = new Map(state.sessions)
      const s = sessions.get(tabId) ?? defaultTabState()
      sessions.set(tabId, { ...s, pendingConfirmation: null })
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
        liveNotes: s.liveNotes,
        budget: s.budget,
        pendingConfirmation: s.pendingConfirmation,
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
        taskId?: string
        type?: string
        iteration?: number
        text?: string
        step?: AgentStep
        taskStatus?: AgentTask['status']
        result?: unknown
      }

      // Confirmation gate: surface the pending decision to the user
      if (stepData.type === 'confirm') {
        const tabId = stepData.tabId ?? getActiveTabId() ?? ''
        set((state) => {
          const sessions = new Map(state.sessions)
          const s = sessions.get(tabId) ?? defaultTabState()
          sessions.set(tabId, {
            ...s,
            pendingConfirmation: { taskId: stepData.taskId ?? '', message: stepData.text ?? '' },
          })
          return { sessions }
        })
        return
      }

      // Budget telemetry
      if (stepData.type === 'budget') {
        const tabId = stepData.tabId ?? getActiveTabId() ?? ''
        set((state) => {
          const sessions = new Map(state.sessions)
          const s = sessions.get(tabId) ?? defaultTabState()
          sessions.set(tabId, {
            ...s,
            budget: {
              remainingSteps: (stepData as { remainingSteps?: number }).remainingSteps ?? 0,
              remainingMs: (stepData as { remainingMs?: number }).remainingMs ?? 0,
              maxIterations: (stepData as { maxIterations?: number }).maxIterations ?? 15,
            },
          })
          return { sessions }
        })
        return
      }

      // Live thought/observation lines (agent loop v2)
      if (stepData.type === 'thought' || stepData.type === 'observation') {
        const kind = stepData.type as 'thought' | 'observation'
        const tabId = stepData.tabId ?? getActiveTabId() ?? ''
        set((state) => {
          const sessions = new Map(state.sessions)
          const s = sessions.get(tabId) ?? defaultTabState()
          sessions.set(tabId, {
            ...s,
            liveNotes: [
              ...s.liveNotes.slice(-40),
              { kind, iteration: stepData.iteration ?? 0, text: stepData.text ?? '' },
            ],
          })
          return { sessions }
        })
        return
      }

      const taskId = stepData.taskId ?? ''
      const step = stepData.step as AgentStep
      const taskStatus = stepData.taskStatus
      const result = stepData.result
      // Route to the session that owns the task; fall back to the active tab
      // for payloads sent before tabId was part of the protocol.
      const sessionTabId = stepData.tabId ?? getActiveTabId() ?? ''

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
            liveNotes: s.liveNotes,
            budget: s.budget,
            pendingConfirmation: s.pendingConfirmation,
          })
          return { sessions }
        })
      }
    })

    stepListenerCleanup = cleanup
    return cleanup
  },
}))
