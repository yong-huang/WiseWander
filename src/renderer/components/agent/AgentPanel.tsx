import { useState, useEffect } from 'react'
import { TaskList } from './TaskList'
import { ExecutionLog } from './ExecutionLog'
import type { AgentTask, AgentRunSummary, AgentRunDetail } from '../../../shared/types'
import type { AgentLiveNote, AgentBudget } from '../../store/agent-store'

interface PendingConfirmation {
  taskId: string
  message: string
}

interface PendingAsk {
  taskId: string
  question: string
}

interface AgentPanelProps {
  tasks: AgentTask[]
  activeTask: AgentTask | null
  isExecuting: boolean
  liveNotes?: AgentLiveNote[]
  budget?: AgentBudget | null
  pendingConfirmation?: PendingConfirmation | null
  pendingAsk?: PendingAsk | null
  onExecute: (description: string) => void
  onCancel: () => void
  onAnswerConfirmation: (approved: boolean) => void
  onAnswerAsk: (answer: string) => void
  onSelectTask: (task: AgentTask) => void
}

function formatRemainingMs(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

export function AgentPanel({
  tasks,
  activeTask,
  isExecuting,
  liveNotes = [],
  budget = null,
  pendingConfirmation = null,
  pendingAsk = null,
  onExecute,
  onCancel,
  onAnswerConfirmation,
  onAnswerAsk,
  onSelectTask,
}: AgentPanelProps): React.ReactElement {
  const [input, setInput] = useState('')
  const [view, setView] = useState<'input' | 'tasks'>('input')
  const [askInput, setAskInput] = useState('')

  const submitAnswer = (): void => {
    const answer = askInput.trim()
    if (!answer) return
    onAnswerAsk(answer)
    setAskInput('')
  }
  const [history, setHistory] = useState<AgentRunSummary[]>([])
  const [expandedRun, setExpandedRun] = useState<AgentRunDetail | null>(null)

  // Recent runs from previous sessions (Phase 3 memory)
  useEffect(() => {
    if (isExecuting) return
    window.api
      .agentHistoryList(10)
      .then((runs: unknown) => setHistory((runs as AgentRunSummary[]) ?? []))
      .catch(() => {})
  }, [isExecuting])

  const historySection = (() => {
    if (isExecuting || history.length === 0) return null
    return (
      <div className="px-3 pb-2">
        <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
          Recent runs
        </h4>
        <div className="space-y-1">
          {history.map((run) => (
            <div key={run.id} className="rounded-lg border border-gray-200/80 text-xs dark:border-gray-700/70">
              <button
                onClick={() => toggleRunDetail(run.id)}
                className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                    run.status === 'completed'
                      ? 'bg-emerald-500'
                      : run.status === 'failed'
                      ? 'bg-red-400'
                      : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                />
                <span className="min-w-0 flex-1 truncate text-gray-700 dark:text-gray-300">{run.goal}</span>
                <span className="shrink-0 text-[10px] text-gray-400">
                  {run.iterations} step{run.iterations === 1 ? '' : 's'}
                </span>
              </button>
              {expandedRun?.id === run.id && (
                <div className="border-t border-gray-200/80 px-2.5 py-2 text-[11px] dark:border-gray-700/70">
                  {expandedRun.report && (
                    <p className="text-gray-600 dark:text-gray-400">{expandedRun.report}</p>
                  )}
                  <p className="mt-1 text-[10px] text-gray-400">
                    {expandedRun.steps.length} step(s) · {new Date(run.startedAt).toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    )
  })()

  const toggleRunDetail = async (id: string): Promise<void> => {
    if (expandedRun?.id === id) {
      setExpandedRun(null)
      return
    }
    try {
      const detail = (await window.api.agentHistoryGet(id)) as AgentRunDetail | null
      setExpandedRun(detail)
    } catch {
      // ignore
    }
  }

  const handleExecute = (): void => {
    const trimmed = input.trim()
    if (!trimmed || isExecuting) return
    onExecute(trimmed)
    setInput('')
    setView('tasks')
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto scrollbar-thin">
      {view === 'input' ? (
        <div className="flex flex-1 flex-col p-3">
          <h3 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
            AI Automation
          </h3>
          <p className="mb-4 text-xs text-gray-400">
            Describe what you want the browser to do in natural language.
          </p>

          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder='e.g., "Search for TypeScript tutorials and extract the top 5 results"'
            rows={4}
            className="mb-3 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm
              focus:outline-none focus:ring-2 focus:ring-blue-500
              dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100
              resize-none"
          />

          <button
            onClick={handleExecute}
            disabled={isExecuting || !input.trim()}
            className="w-full rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white
              hover:bg-purple-700 disabled:opacity-50"
          >
            {isExecuting ? 'Executing...' : 'Execute Task'}
          </button>

          {tasks.length > 0 && (
            <button
              onClick={() => setView('tasks')}
              className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-1.5 text-xs
                hover:bg-gray-50 dark:border-gray-600"
            >
              View Previous Tasks ({tasks.length})
            </button>
          )}

          {/* Quick actions */}
          <div className="mt-4 border-t border-gray-200 pt-3 dark:border-gray-700">
            <p className="mb-2 text-xs font-medium text-gray-500">Quick Actions</p>
            <div className="space-y-1.5">
              {[
                'Fill the login form on this page',
                'Extract all links from this page',
                'Extract the main text and summarize it',
              ].map((action) => (
                <button
                  key={action}
                  onClick={() => setInput(action)}
                  className="block w-full rounded-md px-2.5 py-1.5 text-left text-xs text-gray-600
                    hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                >
                  {action}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex h-full flex-col">
          <div className="flex items-center border-b border-gray-200 p-3 dark:border-gray-700">
            <button
              onClick={() => setView('input')}
              className="text-xs text-blue-500 hover:text-blue-600"
            >
              &larr; New Task
            </button>
            {isExecuting && (
              <button
                onClick={onCancel}
                className="ml-auto rounded-md bg-red-500 px-2 py-1 text-xs text-white hover:bg-red-600"
              >
                Cancel
              </button>
            )}
          </div>

          {/* Clarifying question from the agent — user reply feeds back into the loop */}
      {isExecuting && pendingAsk && (
        <div className="mx-3 mb-2 rounded-xl border border-indigo-300 bg-indigo-50/80 p-2.5 dark:border-indigo-500/40 dark:bg-indigo-500/10 animate-slide-up">
          <div className="flex items-start gap-2">
            <span aria-hidden>💬</span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                The agent needs your input
              </p>
              <p className="mt-0.5 break-words text-[11px] text-indigo-700/90 dark:text-indigo-200/90">
                {pendingAsk.question}
              </p>
              <div className="mt-2 flex gap-1.5">
                <input
                  type="text"
                  value={askInput}
                  onChange={(e) => setAskInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submitAnswer()}
                  placeholder="Type your answer…"
                  className="min-w-0 flex-1 rounded-lg border border-indigo-200 bg-white px-2.5 py-1 text-[11px] focus:outline-none focus:border-indigo-400 dark:border-indigo-500/40 dark:bg-gray-800 dark:text-gray-100"
                  autoFocus
                />
                <button
                  onClick={submitAnswer}
                  disabled={!askInput.trim()}
                  className="shrink-0 rounded-lg bg-indigo-600 px-3 py-1 text-[11px] font-medium text-white hover:bg-indigo-700 active:scale-95 disabled:opacity-40 transition-all"
                >
                  Reply
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation gate (AT-003): risky action awaiting user decision */}
      {isExecuting && pendingConfirmation && (
        <div className="mx-3 mb-2 rounded-xl border border-amber-300 bg-amber-50 p-2.5 dark:border-amber-500/40 dark:bg-amber-500/10 animate-slide-up">
          <div className="flex items-start gap-2">
            <span aria-hidden>⚠️</span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                Confirmation required
              </p>
              <p className="mt-0.5 break-words text-[11px] text-amber-700/90 dark:text-amber-200/90">
                {pendingConfirmation.message}
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => onAnswerConfirmation(true)}
                  className="rounded-lg bg-emerald-600 px-3 py-1 text-[11px] font-medium text-white hover:bg-emerald-700 active:scale-95 transition-all"
                >
                  Allow
                </button>
                <button
                  onClick={() => onAnswerConfirmation(false)}
                  className="rounded-lg bg-gray-200 px-3 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 active:scale-95 transition-all"
                >
                  Deny
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Budget strip */}
      {isExecuting && budget && (
        <div className="mx-3 mb-2 flex items-center gap-2 text-[10px] text-gray-400 dark:text-gray-500">
          <span>
            Step {Math.max(1, budget.maxIterations - budget.remainingSteps)}/{budget.maxIterations}
          </span>
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
            <div
              className="h-full rounded-full bg-indigo-500 transition-all"
              style={{ width: `${Math.max(4, (budget.remainingSteps / budget.maxIterations) * 100)}%` }}
            />
          </div>
          <span>{formatRemainingMs(budget.remainingMs)} left</span>
        </div>
      )}

      {activeTask && <ExecutionLog task={activeTask} liveNotes={liveNotes} />}

      {activeTask && <ExecutionLog task={activeTask} liveNotes={liveNotes} />}

      {/* Recent runs from previous sessions (Phase 3 memory) */}
      {!isExecuting && history.length > 0 && (
        <div className="mt-3 px-3">
          <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
            Recent runs
          </h4>
          <div className="space-y-1">
            {history.map((run) => (
              <div key={run.id} className="rounded-lg border border-gray-200/80 text-xs dark:border-gray-700/70">
                <button
                  onClick={() => toggleRunDetail(run.id)}
                  className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                      run.status === 'completed'
                        ? 'bg-emerald-500'
                        : run.status === 'failed'
                        ? 'bg-red-400'
                        : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                  />
                  <span className="min-w-0 flex-1 truncate text-gray-700 dark:text-gray-300">{run.goal}</span>
                  <span className="shrink-0 text-[10px] text-gray-400">
                    {run.iterations} step{run.iterations === 1 ? '' : 's'}
                  </span>
                </button>
                {expandedRun?.id === run.id && (
                  <div className="border-t border-gray-200/80 px-2.5 py-2 text-[11px] dark:border-gray-700/70">
                    {expandedRun.report && (
                      <p className="text-gray-600 dark:text-gray-400">{expandedRun.report}</p>
                    )}
                    <p className="mt-1 text-[10px] text-gray-400">
                      {expandedRun.steps.length} step(s) · {new Date(run.startedAt).toLocaleString()}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

          {tasks.length > 0 && (
            <div className="border-t border-gray-200 dark:border-gray-700">
              <TaskList tasks={tasks} onSelect={(task) => {
                onSelectTask(task)
                setView('tasks')
              }} />
            </div>
          )}
        </div>
      )}

      {historySection}
    </div>
  )
}
