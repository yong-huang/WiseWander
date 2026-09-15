import type { AgentTask } from '../../../shared/types'

interface TaskListProps {
  tasks: AgentTask[]
  onSelect: (task: AgentTask) => void
}

export function TaskList({ tasks, onSelect }: TaskListProps): React.ReactElement {
  if (tasks.length === 0) {
    return (
      <div className="p-3 text-center text-xs text-gray-400">
        No tasks yet
      </div>
    )
  }

  return (
    <div className="max-h-48 overflow-y-auto p-2">
      {tasks.map((task) => (
        <button
          key={task.id}
          onClick={() => onSelect(task)}
          className="mb-1 w-full rounded-md px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          <div className="flex items-center justify-between">
            <span className="truncate text-xs font-medium text-gray-700 dark:text-gray-300">
              {task.description}
            </span>
            <span
              className={`ml-2 shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                task.status === 'completed'
                  ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                  : task.status === 'failed'
                  ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                  : task.status === 'executing'
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
              }`}
            >
              {task.status}
            </span>
          </div>
        </button>
      ))}
    </div>
  )
}
