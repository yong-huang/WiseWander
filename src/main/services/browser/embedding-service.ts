import { OLLAMA_DEFAULT_URL } from '../../../shared/constants'

export class EmbeddingService {
  private baseUrl: string

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || OLLAMA_DEFAULT_URL
  }

  async embed(texts: string[]): Promise<number[][]> {
    const response = await fetch(`${this.baseUrl}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: texts,
        model: 'nomic-embed-text',
      }),
    })

    if (!response.ok) {
      throw new Error(`Ollama embed failed: ${response.status} ${response.statusText}`)
    }

    const data = await response.json() as { embeddings: number[][] }
    return data.embeddings
  }

  async embedSingle(text: string): Promise<number[]> {
    const embeddings = await this.embed([text])
    return embeddings[0]
  }

  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0
    let dot = 0
    let normA = 0
    let normB = 0
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i]
      normA += a[i] * a[i]
      normB += b[i] * b[i]
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB)
    return denom === 0 ? 0 : dot / denom
  }
}
