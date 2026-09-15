import { OllamaClient } from './ollama-client'
import { configStore } from '../../store/config'
import type { OllamaModel } from '../../../shared/types'

export class ModelManager {
  private client: OllamaClient
  private currentModel: string

  constructor(client?: OllamaClient) {
    this.client = client ?? new OllamaClient()
    this.currentModel = configStore.get('ollama.defaultModel')
  }

  /**
   * Check whether the Ollama daemon is reachable and return its status
   * along with the list of available models.
   */
  async healthCheck(): Promise<{ status: 'ok' | 'error'; models: OllamaModel[] }> {
    return this.client.healthCheck()
  }

  /**
   * Return all models currently available on the Ollama server.
   */
  async listModels(): Promise<OllamaModel[]> {
    return this.client.listModels()
  }

  /**
   * Select a model as the active model for chat sessions.
   * Persists the choice to the config store so it survives restarts.
   * Throws if the model is not found on the server.
   */
  async selectModel(name: string): Promise<OllamaModel> {
    const models = await this.client.listModels()
    const match = models.find((m) => m.name === name)
    if (!match) {
      throw new Error(`Model "${name}" not found. Available: ${models.map((m) => m.name).join(', ')}`)
    }
    this.currentModel = name
    configStore.set('ollama.defaultModel', name)
    return match
  }

  /**
   * Return the name of the currently selected model.
   */
  getCurrentModel(): string {
    return this.currentModel
  }

  /**
   * Return the full OllamaModel object for the currently selected model,
   * or null if it is no longer available on the server.
   */
  async getCurrentModelInfo(): Promise<OllamaModel | null> {
    const models = await this.client.listModels()
    return models.find((m) => m.name === this.currentModel) ?? null
  }

  /**
   * Pull (download) a model from the Ollama registry.
   * Calls the Ollama /api/pull endpoint and streams progress updates
   * via the optional onProgress callback.
   */
  async pullModel(
    name: string,
    onProgress?: (progress: { status: string; total?: number; completed?: number; percent?: number }) => void
  ): Promise<{ success: boolean; error?: string }> {
    const baseUrl = configStore.get('ollama.baseUrl')

    try {
      const resp = await fetch(`${baseUrl}/api/pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, stream: true }),
      })

      if (!resp.ok || !resp.body) {
        return { success: false, error: `Pull failed with status ${resp.status}` }
      }

      const reader = resp.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const lines = decoder.decode(value).split('\n').filter(Boolean)
        for (const line of lines) {
          try {
            const parsed = JSON.parse(line) as { status?: string; total?: number; completed?: number; error?: string }
            if (parsed.error) {
              return { success: false, error: parsed.error }
            }
            if (!onProgress) continue
            const percent =
              typeof parsed.total === 'number' && typeof parsed.completed === 'number' && parsed.total > 0
                ? Math.round((parsed.completed / parsed.total) * 100)
                : undefined
            onProgress({ status: parsed.status ?? '', total: parsed.total, completed: parsed.completed, percent })
          } catch {
            // ignore malformed lines
          }
        }
      }

      return { success: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { success: false, error: message }
    }
  }
}
