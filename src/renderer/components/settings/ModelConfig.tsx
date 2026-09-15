import { useState, useEffect, useCallback } from 'react'
import type { ProvidersConfig, ProviderStatus, AIProviderConfig, AIProviderType } from '@shared/types'

interface ProviderFormState {
  type: AIProviderType
  label: string
  baseUrl: string
  apiKey: string
  model: string
}

const EMPTY_FORM: ProviderFormState = {
  type: 'openai-compatible',
  label: '',
  baseUrl: 'http://localhost:1234',
  apiKey: '',
  model: '',
}

const TYPE_LABELS: Record<AIProviderType, string> = {
  ollama: 'Ollama',
  'openai-compatible': 'OpenAI-Compatible',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
}

export function ModelConfig(): React.ReactElement {
  const [providersConfig, setProvidersConfig] = useState<ProvidersConfig | null>(null)
  const [statuses, setStatuses] = useState<ProviderStatus[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; error?: string } | undefined>>({})
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<ProviderFormState>(EMPTY_FORM)
  const [showAddForm, setShowAddForm] = useState(false)
  const [addForm, setAddForm] = useState<ProviderFormState>(EMPTY_FORM)

  // Ollama-specific state (used for model list/pull when Ollama is expanded)
  const [ollamaModels, setOllamaModels] = useState<Array<{ name: string; size: number; modifiedAt: string }>>([])
  const [ollamaStatus, setOllamaStatus] = useState<'checking' | 'online' | 'offline'>('checking')
  const [pullingModel, setPullingModel] = useState('')
  const [pullProgress, setPullProgress] = useState<string | null>(null)
  const [selectError, setSelectError] = useState('')

  // Model parameters
  const [temperature, setTemperature] = useState(0.7)
  const [contextLength, setContextLength] = useState(4096)

  const loadData = useCallback(async () => {
    try {
      const [config, statuses] = await Promise.all([
        window.api.providersConfigGet() as Promise<ProvidersConfig | null>,
        window.api.providersStatus() as Promise<ProviderStatus[]>,
      ])
      setProvidersConfig(config)
      setStatuses(statuses)
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    loadData()
    loadModelParams()
    checkOllamaStatus()
  }, [loadData])

  // Live pull progress from the main process
  useEffect(() => {
    const cleanup = window.api.onOllamaPullProgress((data: { name: string; progress: { status: string; total?: number; completed?: number; percent?: number } }) => {
      if (data.name !== pullingModel && !pullingModel) return
      const { status, percent, completed, total } = data.progress
      if (percent !== undefined) {
        setPullProgress(`${status} ${percent}% (${formatSize(completed ?? 0)} / ${formatSize(total ?? 0)})`)
      } else {
        setPullProgress(status)
      }
      if (status === 'success') {
        setPullProgress(null)
        checkOllamaStatus()
      }
    })
    return cleanup
  }, [pullingModel])

  const loadModelParams = async (): Promise<void> => {
    try {
      const raw = await window.api.settingsGet() as Record<string, unknown> | undefined
      if (raw?.temperature) setTemperature(raw.temperature as number)
      if (raw?.contextLength) setContextLength(raw.contextLength as number)
    } catch {
      // ignore
    }
  }

  const checkOllamaStatus = async (): Promise<void> => {
    try {
      const status = await window.api.ollamaStatus()
      const isOnline = status.status === 'ok'
      setOllamaStatus(isOnline ? 'online' : 'offline')
      if (isOnline) {
        const models = await window.api.ollamaListModels()
        setOllamaModels(models)
      }
    } catch {
      setOllamaStatus('offline')
    }
  }

  const handleMove = (id: string, direction: 'up' | 'down'): void => {
    if (!providersConfig) return
    const idx = providersConfig.priority.indexOf(id)
    if (idx < 0) return
    const newOrder = [...providersConfig.priority]
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= newOrder.length) return
    ;[newOrder[idx], newOrder[swapIdx]] = [newOrder[swapIdx], newOrder[idx]]
    window.api.providersPrioritySet(newOrder)
    setProvidersConfig({ ...providersConfig, priority: newOrder })
  }

  const handleToggle = (id: string): void => {
    if (!providersConfig) return
    const provider = providersConfig.providers[id]
    if (!provider) return
    const updated = { ...provider, enabled: !provider.enabled } as AIProviderConfig
    window.api.providersConfigSet(updated)
    setProvidersConfig({
      ...providersConfig,
      providers: { ...providersConfig.providers, [id]: updated },
    })
  }

  const handleTest = async (id: string): Promise<void> => {
    setTestingId(id)
    setTestResults((prev) => ({ ...prev, [id]: undefined }))
    try {
      const result = (await window.api.providersTest(id)) as { ok: boolean; error?: string }
      setTestResults((prev) => ({ ...prev, [id]: result }))
    } catch (err) {
      setTestResults((prev) => ({ ...prev, [id]: { ok: false, error: err instanceof Error ? err.message : String(err) } }))
    } finally {
      setTestingId(null)
      // Refresh statuses after test
      const freshStatuses = (await window.api.providersStatus()) as ProviderStatus[]
      setStatuses(freshStatuses)
    }
  }

  const handleEdit = (id: string): void => {
    const provider = providersConfig?.providers[id]
    if (!provider) return
    setEditingId(id)
    setEditForm({
      type: provider.type,
      label: provider.label,
      baseUrl: (provider as { baseUrl?: string }).baseUrl ?? '',
      apiKey: (provider as { apiKey?: string }).apiKey ?? '',
      model: (provider as { defaultModel?: string; model?: string }).defaultModel ??
        (provider as { model?: string }).model ?? '',
    })
    setExpandedId(id)
  }

  const handleSaveEdit = (): void => {
    if (!editingId) return
    const provider = providersConfig?.providers[editingId] as AIProviderConfig | undefined
    if (!provider) return

    let updated: AIProviderConfig
    // openai/anthropic providers have no baseUrl field — strip it from the form state
    const { baseUrl: _formBaseUrl, ...formWithoutBaseUrl } = editForm
    switch (editForm.type) {
      case 'ollama':
        updated = { ...provider, ...editForm, type: 'ollama', defaultModel: editForm.model, enabled: provider.enabled } as AIProviderConfig
        break
      case 'openai-compatible':
        updated = { ...provider, ...editForm, type: 'openai-compatible', enabled: provider.enabled } as AIProviderConfig
        break
      case 'openai':
        updated = { ...provider, ...formWithoutBaseUrl, type: 'openai', enabled: provider.enabled }
        break
      case 'anthropic':
        updated = { ...provider, ...formWithoutBaseUrl, type: 'anthropic', enabled: provider.enabled }
        break
    }

    window.api.providersConfigSet(updated)
    setProvidersConfig((prev) => prev ? {
      ...prev,
      providers: { ...prev.providers, [editingId]: updated },
    } : prev)
    setEditingId(null)
  }

  const handleRemove = (id: string): void => {
    if (!providersConfig) return
    const newProviders = { ...providersConfig.providers }
    delete newProviders[id]
    const newPriority = providersConfig.priority.filter((p) => p !== id)

    // We need to send the updated config - set each remaining provider via IPC
    // Simpler: just update locally and rely on the remove provider mechanism
    setProvidersConfig({ priority: newPriority, providers: newProviders })
    window.api.providersPrioritySet(newPriority)
    // Remove is done by setting providers config without this one
  }

  const handleAdd = (): void => {
    if (!addForm.label.trim()) return
    const id = `${addForm.type}-${Date.now()}`
    let newProvider: AIProviderConfig

    switch (addForm.type) {
      case 'ollama':
        newProvider = {
          id, type: 'ollama', label: addForm.label, enabled: true,
          baseUrl: addForm.baseUrl, defaultModel: addForm.model || 'llama3.2',
        }
        break
      case 'openai-compatible':
        newProvider = {
          id, type: 'openai-compatible', label: addForm.label, enabled: true,
          baseUrl: addForm.baseUrl, apiKey: addForm.apiKey, model: addForm.model,
        }
        break
      case 'openai':
        newProvider = {
          id, type: 'openai', label: addForm.label, enabled: true,
          apiKey: addForm.apiKey, model: addForm.model,
        }
        break
      case 'anthropic':
        newProvider = {
          id, type: 'anthropic', label: addForm.label, enabled: true,
          apiKey: addForm.apiKey, model: addForm.model,
        }
        break
    }

    window.api.providersConfigSet(newProvider)
    setShowAddForm(false)
    setAddForm(EMPTY_FORM)
    loadData()
  }

  const handleSetModel = async (name: string): Promise<void> => {
    setSelectError('')
    try {
      await window.api.ollamaSetModel(name)
      loadData()
    } catch (err) {
      setSelectError(err instanceof Error ? err.message : String(err))
    }
  }

  const handleSaveTemperature = async (value: number): Promise<void> => {
    setTemperature(value)
    try {
      await window.api.settingsSet('temperature', value)
    } catch {
      // ignore
    }
  }

  const handleSaveContextLength = async (value: number): Promise<void> => {
    setContextLength(value)
    try {
      await window.api.settingsSet('contextLength', value)
    } catch {
      // ignore
    }
  }

  const getStatus = (id: string): ProviderStatus | undefined => {
    return statuses.find((s) => s.id === id)
  }

  const getModelDisplay = (config: AIProviderConfig): string => {
    if (config.type === 'ollama') return config.defaultModel
    return config.model
  }

  const formatSize = (bytes: number): string => {
    if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`
    if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(0)} MB`
    return `${bytes} B`
  }

  const priority = providersConfig?.priority ?? []
  const providers = providersConfig?.providers ?? {}

  return (
    <div className="space-y-5">
      {/* ── Provider Priority List ── */}
      <section>
        <h4 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
          AI Providers
        </h4>
        <p className="mb-3 text-xs text-gray-400">
          Requests route to the first available provider in priority order.
        </p>

        {priority.length === 0 && !showAddForm && (
          <p className="text-sm text-gray-400">No providers configured. Add one below.</p>
        )}

        <div className="space-y-1.5">
          {priority.map((id, idx) => {
            const config = providers[id]
            if (!config) return null
            const status = getStatus(id)
            const testResult = testResults[id]
            const isExpanded = expandedId === id
            const isEditing = editingId === id

            return (
              <div key={id} className="rounded-lg border border-gray-200 dark:border-gray-700">
                {/* Header row */}
                <div
                  className="flex items-center gap-2 p-2.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                  onClick={() => setExpandedId(isExpanded ? null : id)}
                >
                  {/* Reorder buttons */}
                  <div className="flex flex-col gap-0.5">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleMove(id, 'up') }}
                      disabled={idx === 0}
                      className="text-gray-400 hover:text-gray-600 disabled:opacity-30 text-xs"
                      title="Move up"
                    >
                      &#x25B2;
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleMove(id, 'down') }}
                      disabled={idx === priority.length - 1}
                      className="text-gray-400 hover:text-gray-600 disabled:opacity-30 text-xs"
                      title="Move down"
                    >
                      &#x25BC;
                    </button>
                  </div>

                  {/* Status indicator */}
                  <div
                    className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                      status?.online ? 'bg-green-500' : status ? 'bg-red-500' : 'bg-gray-300'
                    }`}
                  />

                  {/* Provider info */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                      {config.label}
                    </div>
                    <div className="text-xs text-gray-400 truncate">
                      {TYPE_LABELS[config.type]} &middot; {getModelDisplay(config)}
                    </div>
                  </div>

                  {/* Enable toggle */}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleToggle(id) }}
                    className={`relative w-8 h-4 rounded-full transition-colors ${config.enabled ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                  >
                    <div
                      className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${config.enabled ? 'translate-x-4.5' : 'translate-x-0.5'}`}
                    />
                  </button>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="border-t border-gray-100 dark:border-gray-800 p-3 space-y-3">
                    {isEditing ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs text-gray-600 dark:text-gray-400">Label</label>
                          <input
                            type="text"
                            value={editForm.label}
                            onChange={(e) => setEditForm((f) => ({ ...f, label: e.target.value }))}
                            className="w-48 rounded-md border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                          />
                        </div>
                        {(editForm.type === 'ollama' || editForm.type === 'openai-compatible') && (
                          <div className="flex items-center justify-between">
                            <label className="text-xs text-gray-600 dark:text-gray-400">Base URL</label>
                            <input
                              type="text"
                              value={editForm.baseUrl}
                              onChange={(e) => setEditForm((f) => ({ ...f, baseUrl: e.target.value }))}
                              className="w-48 rounded-md border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                            />
                          </div>
                        )}
                        {editForm.type !== 'ollama' && (
                          <div className="flex items-center justify-between">
                            <label className="text-xs text-gray-600 dark:text-gray-400">API Key</label>
                            <input
                              type="password"
                              value={editForm.apiKey}
                              onChange={(e) => setEditForm((f) => ({ ...f, apiKey: e.target.value }))}
                              className="w-48 rounded-md border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                            />
                          </div>
                        )}
                        <div className="flex items-center justify-between">
                          <label className="text-xs text-gray-600 dark:text-gray-400">Model</label>
                          <input
                            type="text"
                            value={editForm.model}
                            onChange={(e) => setEditForm((f) => ({ ...f, model: e.target.value }))}
                            className="w-48 rounded-md border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={handleSaveEdit}
                            className="rounded-md bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="rounded-md bg-gray-200 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* Status */}
                        <div className="flex items-center gap-2 text-xs">
                          <span className={status?.online ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}>
                            {status?.online ? 'Online' : 'Offline'}
                          </span>
                          {status?.error && <span className="text-red-500">{status.error}</span>}
                          <button
                            onClick={() => handleTest(id)}
                            disabled={testingId === id}
                            className="ml-auto text-blue-500 hover:text-blue-600 disabled:opacity-50"
                          >
                            {testingId === id ? 'Testing...' : 'Test'}
                          </button>
                        </div>
                        {testResult && (
                          <span className={`text-xs ${testResult.ok ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            {testResult.ok ? 'Connection successful' : `Failed: ${testResult.error}`}
                          </span>
                        )}

                        {/* Ollama model list when Ollama provider is expanded */}
                        {config.type === 'ollama' && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-gray-600 dark:text-gray-400">
                                Status: {ollamaStatus === 'online' ? 'Connected' : ollamaStatus === 'offline' ? 'Offline' : 'Checking...'}
                              </span>
                              <button
                                onClick={checkOllamaStatus}
                                className="text-xs text-blue-500 hover:text-blue-600"
                              >
                                Refresh
                              </button>
                            </div>
                            {selectError && (
                              <p className="text-xs text-red-600">{selectError}</p>
                            )}
                            {ollamaStatus === 'online' && ollamaModels.length > 0 && (
                              <div className="max-h-36 space-y-1 overflow-y-auto">
                                {ollamaModels.map((m) => (
                                  <div
                                    key={m.name}
                                    onClick={() => handleSetModel(m.name)}
                                    className={`flex cursor-pointer items-center justify-between rounded border p-2 text-xs transition-colors ${
                                      config.defaultModel === m.name
                                        ? 'border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-950'
                                        : 'border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800'
                                    }`}
                                  >
                                    <span className="text-gray-800 dark:text-gray-200">{m.name}</span>
                                    <span className="text-gray-400">
                                      {formatSize(m.size)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={pullingModel}
                                onChange={(e) => setPullingModel(e.target.value)}
                                placeholder="Pull model (e.g. llama3.2)"
                                className="flex-1 rounded-md border border-gray-300 px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                              />
                              <button
                                onClick={() => {
                                  setPullProgress('starting…')
                                  window.api.ollamaPullModel(pullingModel).then((res: unknown) => {
                                    const result = res as { success: boolean; error?: string }
                                    setPullProgress(null)
                                    if (!result?.success) {
                                      setSelectError(result?.error ?? 'Pull failed')
                                    } else {
                                      checkOllamaStatus()
                                    }
                                  }).catch(() => setPullProgress(null))
                                  setPullingModel('')
                                }}
                                disabled={!pullingModel.trim()}
                                className="rounded-md bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
                              >
                                Pull
                              </button>
                            </div>
                            {pullProgress && (
                              <p className="text-[10px] text-gray-500 dark:text-gray-400">{pullProgress}</p>
                            )}
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEdit(id)}
                            className="rounded-md bg-gray-100 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleRemove(id)}
                            className="rounded-md bg-gray-100 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 dark:bg-gray-800 dark:text-red-400 dark:hover:bg-red-950/30"
                          >
                            Remove
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Add provider button */}
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="mt-2 rounded-md border border-dashed border-gray-300 px-3 py-2 text-xs text-gray-500 hover:border-gray-400 hover:text-gray-600 dark:border-gray-600 dark:text-gray-400 dark:hover:border-gray-500"
          >
            + Add Provider
          </button>
        )}

        {/* Add provider form */}
        {showAddForm && (
          <div className="mt-2 rounded-lg border border-gray-200 p-3 space-y-2 dark:border-gray-700">
            <h5 className="text-xs font-semibold text-gray-700 dark:text-gray-300">Add New Provider</h5>

            <div className="flex items-center justify-between">
              <label className="text-xs text-gray-600 dark:text-gray-400">Type</label>
              <select
                value={addForm.type}
                onChange={(e) => setAddForm((f) => ({ ...f, type: e.target.value as AIProviderType, baseUrl: e.target.value === 'ollama' ? 'http://localhost:11434' : 'http://localhost:1234' }))}
                className="w-48 rounded-md border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              >
                <option value="ollama">Ollama</option>
                <option value="openai-compatible">OpenAI-Compatible</option>
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
              </select>
            </div>

            <div className="flex items-center justify-between">
              <label className="text-xs text-gray-600 dark:text-gray-400">Label</label>
              <input
                type="text"
                value={addForm.label}
                onChange={(e) => setAddForm((f) => ({ ...f, label: e.target.value }))}
                placeholder="e.g. My LM Studio"
                className="w-48 rounded-md border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              />
            </div>

            {(addForm.type === 'ollama' || addForm.type === 'openai-compatible') && (
              <div className="flex items-center justify-between">
                <label className="text-xs text-gray-600 dark:text-gray-400">Base URL</label>
                <input
                  type="text"
                  value={addForm.baseUrl}
                  onChange={(e) => setAddForm((f) => ({ ...f, baseUrl: e.target.value }))}
                  className="w-48 rounded-md border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                />
              </div>
            )}

            {addForm.type !== 'ollama' && (
              <div className="flex items-center justify-between">
                <label className="text-xs text-gray-600 dark:text-gray-400">API Key</label>
                <input
                  type="password"
                  value={addForm.apiKey}
                  onChange={(e) => setAddForm((f) => ({ ...f, apiKey: e.target.value }))}
                  className="w-48 rounded-md border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                />
              </div>
            )}

            <div className="flex items-center justify-between">
              <label className="text-xs text-gray-600 dark:text-gray-400">Model</label>
              <input
                type="text"
                value={addForm.model}
                onChange={(e) => setAddForm((f) => ({ ...f, model: e.target.value }))}
                placeholder={addForm.type === 'ollama' ? 'llama3.2' : addForm.type === 'openai' ? 'gpt-4o-mini' : addForm.type === 'anthropic' ? 'claude-sonnet-4-20250514' : 'qwen2.5-7b'}
                className="w-48 rounded-md border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleAdd}
                disabled={!addForm.label.trim()}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Add
              </button>
              <button
                onClick={() => { setShowAddForm(false); setAddForm(EMPTY_FORM) }}
                className="rounded-md bg-gray-200 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ── Model Parameters ── */}
      <section className="border-t border-gray-200 pt-4 dark:border-gray-700">
        <h4 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
          Model Parameters
        </h4>
        <div className="space-y-3">
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs text-gray-600 dark:text-gray-400">Temperature</label>
              <span className="text-xs font-mono text-gray-500">{temperature.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={2}
              step={0.1}
              value={temperature}
              onChange={(e) => handleSaveTemperature(parseFloat(e.target.value))}
              className="w-full accent-blue-600"
            />
            <div className="mt-0.5 flex justify-between text-[10px] text-gray-400">
              <span>Precise</span>
              <span>Creative</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <label className="text-xs text-gray-600 dark:text-gray-400">Context Length</label>
            <select
              value={contextLength}
              onChange={(e) => handleSaveContextLength(parseInt(e.target.value))}
              className="w-36 rounded-md border border-gray-300 px-2 py-1 text-sm
                dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            >
              <option value={2048}>2,048</option>
              <option value={4096}>4,096</option>
              <option value={8192}>8,192</option>
              <option value={16384}>16,384</option>
              <option value={32768}>32,768</option>
            </select>
          </div>
        </div>
      </section>
    </div>
  )
}
