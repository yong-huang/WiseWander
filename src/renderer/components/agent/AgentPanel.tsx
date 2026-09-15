import { useState } from 'react'
import { TaskList } from './TaskList'
import { ExecutionLog } from './ExecutionLog'
import type { AgentTask } from '../../../shared/types'
import type { AgentLiveNote } from '../../store/agent-store'

interface AgentPanelProps {
  tasks: AgentTask[]
  activeTask: AgentTask | null
  isExecuting: boolean
  liveNotes?: AgentLiveNote[]
  onExecute: (description: string) => void
  onCancel: () => void
  onSelectTask: (task: AgentTask) => void
}

export function AgentPanel({
  tasks,
  activeTask,
  isExecuting,
  liveNotes = [],
  onExecute,
  onCancel,
  onSelectTask,
}: AgentPanelProps): React.ReactElement {
  const [input, setInput] = useState('')
  const [view, setView] = useState<'input' | 'tasks'>('input')

  const handleExecute = (): void => {
    const trimmed = input.trim()
    if (!trimmed || isExecuting) return
    onExecute(trimmed)
    setInput('')
    setView('tasks')
  }

  return (
    <div className="flex h-full flex-col">
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

          {activeTask && <ExecutionLog task={activeTask} liveNotes={liveNotes} />}

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
    </div>
  )
}
