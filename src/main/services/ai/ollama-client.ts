import { OLLAMA_DEFAULT_URL, DEFAULT_MODEL } from '../../../shared/constants'
import type { OllamaModel, ChatMessage } from '../../../shared/types'

export interface OllamaConfig {
  baseUrl: string
  defaultModel: string
  timeout: number
}

interface StreamChunk {
  done: boolean
  model: string
  message?: {
    role: string
    content: string
    thinking?: string
  }
  /** @deprecated Use message.content for /api/chat */
  response?: string
}

const DEFAULT_CONFIG: OllamaConfig = {
  baseUrl: OLLAMA_DEFAULT_URL,
  defaultModel: DEFAULT_MODEL,
  timeout: 60_000,
}

export class OllamaClient {
  private config: OllamaConfig = DEFAULT_CONFIG

  async healthCheck(): Promise<{ status: 'ok' | 'error'; models: OllamaModel[] }> {
    try {
      const resp = await fetch(`${this.config.baseUrl}/api/tags`)
      if (!resp.ok) return { status: 'error', models: [] }
      const data = (await resp.json()) as { models: Array<{ name: string; size: number; modified_at: string }> }
      return {
        status: 'ok',
        models: data.models.map((m) => ({
          name: m.name,
          size: m.size,
          modifiedAt: m.modified_at,
        })),
      }
    } catch {
      return { status: 'error', models: [] }
    }
  }

  async listModels(): Promise<OllamaModel[]> {
    const { models } = await this.healthCheck()
    return models
  }

  async chat(
    model: string,
    messages: ChatMessage[],
    onChunk: (chunk: StreamChunk) => void,
    signal?: AbortSignal
  ): Promise<void> {
    const resp = await fetch(`${this.config.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, stream: true, think: false }),
      signal,
    })

    if (!resp.ok || !resp.body) {
      throw new Error(`Ollama chat request failed: ${resp.status}`)
    }

    const reader = resp.body.getReader()
    const decoder = new TextDecoder()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const lines = decoder.decode(value).split('\n').filter(Boolean)
      for (const line of lines) {
        const chunk = JSON.parse(line) as StreamChunk
        // Normalize: /api/chat uses message.content, /api/generate uses response
        const normalized: StreamChunk & { response: string } = {
          ...chunk,
          response: chunk.message?.content ?? chunk.response ?? '',
        }
        onChunk(normalized)
        if (chunk.done) return
      }
    }
  }

  configure(config: Partial<OllamaConfig>): void {
    this.config = { ...this.config, ...config }
  }

  getBaseUrl(): string {
    return this.config.baseUrl
  }
}
