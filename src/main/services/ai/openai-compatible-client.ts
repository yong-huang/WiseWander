import type { ChatMessage } from '../../../shared/types'

interface OpenAICompatibleConfig {
  baseUrl: string
  apiKey: string
  model: string
}

interface StreamDelta {
  choices?: Array<{
    delta?: { content?: string }
    finish_reason?: string | null
  }>
}

export class OpenAICompatibleClient {
  private config: OpenAICompatibleConfig

  constructor(config?: Partial<OpenAICompatibleConfig>) {
    this.config = {
      baseUrl: config?.baseUrl ?? 'http://localhost:1234',
      apiKey: config?.apiKey ?? '',
      model: config?.model ?? '',
    }
  }

  configure(config: Partial<OpenAICompatibleConfig>): void {
    this.config = { ...this.config, ...config }
  }

  async healthCheck(): Promise<{ status: 'ok' | 'error'; models: string[] }> {
    try {
      const resp = await fetch(`${this.config.baseUrl}/v1/models`, {
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(5000),
      })
      if (!resp.ok) return { status: 'error', models: [] }
      const data = (await resp.json()) as { data?: Array<{ id: string }> }
      const models = data.data?.map((m) => m.id) ?? []
      return { status: 'ok', models }
    } catch {
      return { status: 'error', models: [] }
    }
  }

  async chat(
    messages: ChatMessage[],
    onChunk: (text: string, done: boolean) => void,
    signal?: AbortSignal
  ): Promise<void> {
    const resp = await fetch(`${this.config.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        model: this.config.model,
        messages,
        stream: true,
        max_tokens: 4096,
      }),
      signal,
    })

    if (!resp.ok) {
      const body = await resp.text()
      throw new Error(`OpenAI-compatible API error ${resp.status}: ${body}`)
    }
    if (!resp.body) {
      throw new Error('OpenAI-compatible API returned no body')
    }

    const reader = resp.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done: readDone, value } = await reader.read()
      if (readDone) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || trimmed === 'data: [DONE]') {
          if (trimmed === 'data: [DONE]') {
            onChunk('', true)
          }
          continue
        }
        if (!trimmed.startsWith('data: ')) continue

        try {
          const parsed: StreamDelta = JSON.parse(trimmed.slice(6))
          const choice = parsed.choices?.[0]
          const content = choice?.delta?.content ?? ''
          const finishReason = choice?.finish_reason
          if (content) {
            onChunk(content, false)
          }
          if (finishReason === 'stop') {
            onChunk('', true)
          }
        } catch {
          // Ignore malformed JSON lines
        }
      }
    }
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`
    }
    return headers
  }
}
