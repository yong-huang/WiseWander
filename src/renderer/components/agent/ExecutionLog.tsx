import type { AgentTask } from '../../../shared/types'

interface ExecutionLogProps {
  task: AgentTask
}

export function ExecutionLog({ task }: ExecutionLogProps): React.ReactElement {
  return (
    <div className="flex-1 overflow-y-auto p-3">
      <h4 className="mb-2 text-xs font-semibold text-gray-700 dark:text-gray-300">
        Task: {task.description}
      </h4>

      <div className="space-y-2">
        {task.steps.map((step) => (
          <div
            key={step.id}
            className={`rounded-lg border p-2.5 text-xs ${
              step.status === 'done'
                ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950'
                : step.status === 'error'
                ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950'
                : step.status === 'running'
                ? 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950'
                : 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-medium text-gray-700 dark:text-gray-300">
                Step {step.id}: {step.tool}
              </span>
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                  step.status === 'done'
                    ? 'bg-green-200 text-green-800 dark:bg-green-800 dark:text-green-200'
                    : step.status === 'error'
                    ? 'bg-red-200 text-red-800 dark:bg-red-800 dark:text-red-200'
                    : step.status === 'running'
                    ? 'bg-blue-200 text-blue-800 dark:bg-blue-800 dark:text-blue-200'
                    : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                }`}
              >
                {step.status}
              </span>
            </div>

            {/* Input params */}
            <div className="mt-1 text-gray-500 dark:text-gray-400">
              Input: {JSON.stringify(step.input)}
            </div>

            {/* Output */}
            {step.output !== undefined && (
              <div className="mt-1 text-gray-500 dark:text-gray-400">
                Output: {typeof step.output === 'string' ? step.output : JSON.stringify(step.output)}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Task result */}
      {task.result && (
        <div className="mt-3 rounded-lg bg-gray-100 p-2.5 text-xs dark:bg-gray-800">
          <span className="font-medium">Result: </span>
          {task.result.success ? (
            <span className="text-green-600 dark:text-green-400">
              Success — {JSON.stringify(task.result.data)}
            </span>
          ) : (
            <span className="text-red-600 dark:text-red-400">
              Failed — {task.result.error}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
