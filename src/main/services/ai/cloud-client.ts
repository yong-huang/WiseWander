import type { ChatMessage } from '../../../shared/types'

export type CloudProvider = 'openai' | 'anthropic'

interface OpenAIStreamDelta {
  choices?: Array<{
    delta?: { content?: string }
    finish_reason?: string | null
  }>
}

interface AnthropicStreamEvent {
  type: string
  delta?: {
    type?: string
    text?: string
    stop_reason?: string
  }
  content?: Array<{
    type: string
    text: string
  }>
  message?: {
    content?: Array<{
      type: string
      text: string
    }>
  }
}

export class CloudClient {
  /**
   * Send a chat request to a cloud provider with streaming response.
   */
  async chat(
    provider: CloudProvider,
    apiKey: string,
    model: string,
    messages: ChatMessage[],
    onChunk: (text: string, done: boolean) => void,
    signal?: AbortSignal
  ): Promise<void> {
    if (provider === 'openai') {
      await this.chatOpenAI(apiKey, model, messages, onChunk, signal)
    } else if (provider === 'anthropic') {
      await this.chatAnthropic(apiKey, model, messages, onChunk, signal)
    } else {
      throw new Error(`Unsupported cloud provider: ${provider}`)
    }
  }

  /**
   * Test connectivity to the configured cloud provider.
   * Sends a minimal request and returns true on success.
   */
  async testConnection(
    provider: CloudProvider,
    apiKey: string,
    model: string
  ): Promise<{ ok: boolean; error?: string }> {
    try {
      const messages: ChatMessage[] = [
        { role: 'user', content: 'Hi' },
      ]
      let received = false
      await this.chat(provider, apiKey, model, messages, (_text, done) => {
        received = true
        if (done) return
      })
      return { ok: received }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { ok: false, error: message }
    }
  }

  // ── OpenAI ──

  private async chatOpenAI(
    apiKey: string,
    model: string,
    messages: ChatMessage[],
    onChunk: (text: string, done: boolean) => void,
    signal?: AbortSignal
  ): Promise<void> {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        max_tokens: 4096,
      }),
      signal,
    })

    if (!resp.ok) {
      const body = await resp.text()
      throw new Error(`OpenAI API error ${resp.status}: ${body}`)
    }
    if (!resp.body) {
      throw new Error('OpenAI API returned no body')
    }

    const reader = resp.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done: readDone, value } = await reader.read()
      if (readDone) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      // Keep the last potentially incomplete line in the buffer
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
          const parsed: OpenAIStreamDelta = JSON.parse(trimmed.slice(6))
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

  // ── Anthropic ──

  private async chatAnthropic(
    apiKey: string,
    model: string,
    messages: ChatMessage[],
    onChunk: (text: string, done: boolean) => void,
    signal?: AbortSignal
  ): Promise<void> {
    // Anthropic expects system as a top-level parameter, not in messages
    const systemMessage = messages.find((m) => m.role === 'system')?.content
    const chatMessages = messages.filter((m) => m.role !== 'system')

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system: systemMessage ?? '',
        messages: chatMessages,
        stream: true,
      }),
      signal,
    })

    if (!resp.ok) {
      const body = await resp.text()
      throw new Error(`Anthropic API error ${resp.status}: ${body}`)
    }
    if (!resp.body) {
      throw new Error('Anthropic API returned no body')
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
        if (!trimmed.startsWith('data: ')) continue

        try {
          const parsed: AnthropicStreamEvent = JSON.parse(trimmed.slice(6))

          if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
            onChunk(parsed.delta.text, false)
          } else if (parsed.type === 'message_stop') {
            onChunk('', true)
          }
        } catch {
          // Ignore malformed JSON lines
        }
      }
    }
  }
}
