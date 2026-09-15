import type { ChatMessage, AIProviderConfig, ProviderStatus, AIProviderType } from '../../../shared/types'
import { OllamaClient } from './ollama-client'
import { OpenAICompatibleClient } from './openai-compatible-client'
import { CloudClient } from './cloud-client'

export interface AIProviderAdapter {
  readonly id: string
  readonly label: string
  readonly type: AIProviderType
  readonly model: string
  healthCheck(): Promise<ProviderStatus>
  chat(
    messages: ChatMessage[],
    onChunk: (text: string, done: boolean) => void,
    signal?: AbortSignal
  ): Promise<void>
}

class OllamaProviderAdapter implements AIProviderAdapter {
  readonly id: string
  readonly label: string
  readonly type: AIProviderType = 'ollama'
  readonly model: string
  private client: OllamaClient

  constructor(id: string, label: string, model: string, client: OllamaClient) {
    this.id = id
    this.label = label
    this.model = model
    this.client = client
  }

  async healthCheck(): Promise<ProviderStatus> {
    try {
      const { status, models } = await this.client.healthCheck()
      if (status === 'ok') {
        const modelNames = models.map((m) => m.name)
        const hasModel = modelNames.includes(this.model)
        return { id: this.id, type: this.type, label: this.label, online: hasModel, model: this.model }
      }
      return { id: this.id, type: this.type, label: this.label, online: false, model: this.model, error: 'Ollama server unreachable' }
    } catch (err) {
      return { id: this.id, type: this.type, label: this.label, online: false, model: this.model, error: err instanceof Error ? err.message : String(err) }
    }
  }

  async chat(
    messages: ChatMessage[],
    onChunk: (text: string, done: boolean) => void,
    signal?: AbortSignal
  ): Promise<void> {
    await this.client.chat(
      this.model,
      messages,
      (chunk) => {
        onChunk(chunk.message?.content ?? chunk.response ?? '', chunk.done)
      },
      signal
    )
  }
}

class OpenAICompatibleProviderAdapter implements AIProviderAdapter {
  readonly id: string
  readonly label: string
  readonly type: AIProviderType = 'openai-compatible'
  readonly model: string
  private client: OpenAICompatibleClient

  constructor(id: string, label: string, baseUrl: string, apiKey: string, model: string) {
    this.id = id
    this.label = label
    this.model = model
    this.client = new OpenAICompatibleClient({ baseUrl, apiKey, model })
  }

  async healthCheck(): Promise<ProviderStatus> {
    try {
      const { status } = await this.client.healthCheck()
      return { id: this.id, type: this.type, label: this.label, online: status === 'ok', model: this.model }
    } catch (err) {
      return { id: this.id, type: this.type, label: this.label, online: false, model: this.model, error: err instanceof Error ? err.message : String(err) }
    }
  }

  async chat(
    messages: ChatMessage[],
    onChunk: (text: string, done: boolean) => void,
    signal?: AbortSignal
  ): Promise<void> {
    await this.client.chat(messages, onChunk, signal)
  }
}

class OpenAIProviderAdapter implements AIProviderAdapter {
  readonly id: string
  readonly label: string
  readonly type: AIProviderType = 'openai'
  readonly model: string
  private client: OpenAICompatibleClient

  constructor(id: string, label: string, apiKey: string, model: string) {
    this.id = id
    this.label = label
    this.model = model
    this.client = new OpenAICompatibleClient({ baseUrl: 'https://api.openai.com', apiKey, model })
  }

  async healthCheck(): Promise<ProviderStatus> {
    try {
      const { status } = await this.client.healthCheck()
      return { id: this.id, type: this.type, label: this.label, online: status === 'ok', model: this.model }
    } catch (err) {
      return { id: this.id, type: this.type, label: this.label, online: false, model: this.model, error: err instanceof Error ? err.message : String(err) }
    }
  }

  async chat(
    messages: ChatMessage[],
    onChunk: (text: string, done: boolean) => void,
    signal?: AbortSignal
  ): Promise<void> {
    await this.client.chat(messages, onChunk, signal)
  }
}

class AnthropicProviderAdapter implements AIProviderAdapter {
  readonly id: string
  readonly label: string
  readonly type: AIProviderType = 'anthropic'
  readonly model: string
  private cloudClient: CloudClient
  private apiKey: string

  constructor(id: string, label: string, apiKey: string, model: string, cloudClient: CloudClient) {
    this.id = id
    this.label = label
    this.model = model
    this.apiKey = apiKey
    this.cloudClient = cloudClient
  }

  /**
   * Anthropic has no free ping endpoint — any probe is a billed request,
   * and the router health-checks on every request. So we treat a configured
   * key as "online" and let real chat errors surface naturally (failover
   * happens on the next request via the status cache invalidation).
   */
  async healthCheck(): Promise<ProviderStatus> {
    const online = this.apiKey.length > 0
    return {
      id: this.id,
      type: this.type,
      label: this.label,
      online,
      model: this.model,
      error: online ? undefined : 'API key not configured',
    }
  }

  async chat(
    messages: ChatMessage[],
    onChunk: (text: string, done: boolean) => void,
    signal?: AbortSignal
  ): Promise<void> {
    await this.cloudClient.chat('anthropic', this.apiKey, this.model, messages, onChunk, signal)
  }
}

export function createProviderAdapter(
  config: AIProviderConfig,
  ollamaClient: OllamaClient,
  cloudClient: CloudClient
): AIProviderAdapter {
  switch (config.type) {
    case 'ollama':
      return new OllamaProviderAdapter(config.id, config.label, config.defaultModel, ollamaClient)
    case 'openai-compatible':
      return new OpenAICompatibleProviderAdapter(config.id, config.label, config.baseUrl, config.apiKey, config.model)
    case 'openai':
      return new OpenAIProviderAdapter(config.id, config.label, config.apiKey, config.model)
    case 'anthropic':
      return new AnthropicProviderAdapter(config.id, config.label, config.apiKey, config.model, cloudClient)
  }
}
