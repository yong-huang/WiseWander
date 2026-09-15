import Store from 'electron-store'
import { OllamaClient } from './ollama-client'
import { CloudClient, type CloudProvider } from './cloud-client'
import { createProviderAdapter, type AIProviderAdapter } from './provider'
import type { ChatMessage, ProvidersConfig, ProviderStatus, AIProviderConfig } from '../../../shared/types'
import { PROVIDERS_CONFIG_KEY } from '../../../shared/constants'
import type { AppConfig } from '../../store/config'

interface CloudConfig {
  provider: CloudProvider | 'disabled'
  apiKey: string
  model: string
}

const CLOUD_CONFIG_KEY = 'cloud'

const DEFAULT_CLOUD_CONFIG: CloudConfig = {
  provider: 'disabled',
  apiKey: '',
  model: '',
}

const STATUS_CACHE_TTL = 30_000

export class ModelRouter {
  private ollamaClient: OllamaClient
  private cloudClient: CloudClient
  private configStore: Store<AppConfig>
  private adapters = new Map<string, AIProviderAdapter>()
  private statusCache = new Map<string, { status: ProviderStatus; timestamp: number }>()
  /** When true (privacy mode), cloud providers are skipped entirely. */
  private localOnly = false

  constructor(
    ollamaClient: OllamaClient,
    cloudClient: CloudClient,
    configStore: Store<AppConfig>
  ) {
    this.ollamaClient = ollamaClient
    this.cloudClient = cloudClient
    this.configStore = configStore
  }

  /**
   * Initialize the router: migrate legacy config if needed, then build adapters.
   */
  async initialize(): Promise<void> {
    const existing = this.getProvidersConfig()
    if (!existing) {
      this.migrateFromLegacyConfig()
    }
    this.buildAdapters()
  }

  /**
   * Privacy mode: when enabled, only local (ollama) providers are used.
   */
  setLocalOnly(enabled: boolean): void {
    this.localOnly = enabled
  }

  isLocalOnly(): boolean {
    return this.localOnly
  }

  /**
   * Route a chat request through the priority list.
   * Uses the first online provider. Throws if all unavailable.
   */
  async chat(
    messages: ChatMessage[],
    onChunk: (text: string, done: boolean) => void,
    signal?: AbortSignal
  ): Promise<{ providerId: string; model: string }> {
    const config = this.getProvidersConfig()
    if (!config || config.priority.length === 0) {
      throw new Error('No AI providers configured. Add a provider in Settings.')
    }

    for (const id of config.priority) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
      const providerConfig = config.providers[id]
      if (!providerConfig || !providerConfig.enabled) continue
      if (this.localOnly && providerConfig.type !== 'ollama') continue

      const adapter = this.adapters.get(id)
      if (!adapter) continue

      const status = await this.getProviderStatus(id)
      if (!status.online) continue

      try {
        await adapter.chat(messages, onChunk, signal)
        return { providerId: id, model: adapter.model }
      } catch (err) {
        if (signal?.aborted || (err instanceof Error && err.name === 'AbortError')) throw err
        // Real request failure — invalidate the health cache so the next
        // provider in the list gets tried instead of the same stale "online" one.
        this.statusCache.delete(id)
        if (id === config.priority[config.priority.length - 1]) throw err
        console.warn(`[ModelRouter] provider "${id}" failed, failing over:`, err instanceof Error ? err.message : err)
      }
    }

    throw new Error(
      'All AI providers are offline or disabled. Start a local server or configure a cloud provider in Settings.'
    )
  }

  /**
   * Non-streaming convenience: collects the full response text.
   */
  async chatSync(messages: ChatMessage[]): Promise<string> {
    let result = ''
    await this.chat(messages, (delta, _done) => {
      result += delta
    })
    return result
  }

  /**
   * Test a specific provider's connectivity.
   */
  async testProvider(id: string): Promise<{ ok: boolean; error?: string }> {
    const adapter = this.adapters.get(id)
    if (!adapter) return { ok: false, error: `Provider "${id}" not found` }

    const status = await adapter.healthCheck()
    this.statusCache.set(id, { status, timestamp: Date.now() })
    return { ok: status.online, error: status.error }
  }

  /**
   * Get status of all providers, using cache if recent.
   */
  async getAllProviderStatus(): Promise<ProviderStatus[]> {
    const config = this.getProvidersConfig()
    if (!config) return []

    const statuses: ProviderStatus[] = []
    for (const id of config.priority) {
      statuses.push(await this.getProviderStatus(id))
    }
    return statuses
  }

  /**
   * Set or update a provider config and rebuild adapters.
   */
  setProvider(config: AIProviderConfig): void {
    const pc = this.getProvidersConfig() ?? { priority: [], providers: {} }
    const isNew = !pc.providers[config.id]

    pc.providers[config.id] = config
    if (isNew) {
      pc.priority.push(config.id)
    }

    this.saveProvidersConfig(pc)
    this.buildAdapters()
  }

  /**
   * Remove a provider and rebuild adapters.
   */
  removeProvider(id: string): void {
    const pc = this.getProvidersConfig()
    if (!pc) return

    delete pc.providers[id]
    pc.priority = pc.priority.filter((p) => p !== id)

    this.saveProvidersConfig(pc)
    this.adapters.delete(id)
    this.statusCache.delete(id)
  }

  /**
   * Set provider priority order.
   */
  setPriority(order: string[]): void {
    const pc = this.getProvidersConfig()
    if (!pc) return

    // Only include IDs that still exist in providers
    pc.priority = order.filter((id) => pc.providers[id])
    this.saveProvidersConfig(pc)
  }

  /**
   * Get the current providers config.
   */
  getProvidersConfig(): ProvidersConfig | null {
    const raw = this.configStore.get(PROVIDERS_CONFIG_KEY as never) as ProvidersConfig | undefined
    return raw ?? null
  }

  /**
   * Get the name of the active model (from first priority provider).
   */
  getActiveModelName(): string {
    const config = this.getProvidersConfig()
    if (!config || config.priority.length === 0) return ''
    const first = config.priority[0]
    const provider = config.providers[first]
    if (!provider) return ''
    if (provider.type === 'ollama') return provider.defaultModel
    return provider.model
  }

  // ── Legacy backward compat ──

  getCloudConfig(): CloudConfig {
    const raw = this.configStore.get(CLOUD_CONFIG_KEY as never) as
      | Partial<CloudConfig>
      | undefined
    if (!raw) return { ...DEFAULT_CLOUD_CONFIG }
    return {
      provider: raw.provider ?? DEFAULT_CLOUD_CONFIG.provider,
      apiKey: raw.apiKey ?? DEFAULT_CLOUD_CONFIG.apiKey,
      model: raw.model ?? DEFAULT_CLOUD_CONFIG.model,
    }
  }

  // ── Private helpers ──

  /**
   * Apply the configured ollama.baseUrl to the shared OllamaClient so that
   * custom endpoints actually take effect for chat/health requests.
   */
  private applyOllamaBaseUrl(): void {
    const baseUrl = this.configStore.get('ollama.baseUrl') as string | undefined
    if (baseUrl) {
      this.ollamaClient.configure({ baseUrl })
    }
  }

  private buildAdapters(): void {
    this.applyOllamaBaseUrl()
    this.adapters.clear()
    this.statusCache.clear()

    const config = this.getProvidersConfig()
    if (!config) return

    for (const [id, providerConfig] of Object.entries(config.providers)) {
      this.adapters.set(id, createProviderAdapter(providerConfig, this.ollamaClient, this.cloudClient))
    }
  }

  private async getProviderStatus(id: string): Promise<ProviderStatus> {
    const cached = this.statusCache.get(id)
    if (cached && Date.now() - cached.timestamp < STATUS_CACHE_TTL) {
      return cached.status
    }

    const adapter = this.adapters.get(id)
    if (!adapter) {
      return { id, type: 'ollama', label: id, online: false, model: '', error: 'Adapter not found' }
    }

    const status = await adapter.healthCheck()
    this.statusCache.set(id, { status, timestamp: Date.now() })
    return status
  }

  private saveProvidersConfig(config: ProvidersConfig): void {
    this.configStore.set(PROVIDERS_CONFIG_KEY as never, config as never)
  }

  /**
   * Migrate from legacy ollama.* and cloud config keys to the new ProvidersConfig.
   * Only runs if no providers config exists yet.
   */
  private migrateFromLegacyConfig(): void {
    const baseUrl = this.configStore.get('ollama.baseUrl') as string | undefined
    const defaultModel = this.configStore.get('ollama.defaultModel') as string | undefined
    const cloudConfig = this.getCloudConfig()

    const ollamaProvider: AIProviderConfig = {
      id: 'ollama-default',
      type: 'ollama',
      label: 'Ollama (Local)',
      enabled: true,
      baseUrl: baseUrl ?? 'http://localhost:11434',
      defaultModel: defaultModel ?? 'llama3.2',
    }

    const providers: Record<string, AIProviderConfig> = {
      'ollama-default': ollamaProvider,
    }

    const priority: string[] = ['ollama-default']

    if (cloudConfig.provider !== 'disabled' && cloudConfig.apiKey && cloudConfig.model) {
      const id = `cloud-${cloudConfig.provider}`
      let provider: AIProviderConfig

      if (cloudConfig.provider === 'openai') {
        provider = {
          id,
          type: 'openai',
          label: 'OpenAI (Cloud)',
          enabled: true,
          apiKey: cloudConfig.apiKey,
          model: cloudConfig.model,
        }
      } else {
        provider = {
          id,
          type: 'anthropic',
          label: 'Anthropic (Cloud)',
          enabled: true,
          apiKey: cloudConfig.apiKey,
          model: cloudConfig.model,
        }
      }

      providers[id] = provider
      priority.push(id)
    }

    const config: ProvidersConfig = { priority, providers }
    this.saveProvidersConfig(config)
  }
}
