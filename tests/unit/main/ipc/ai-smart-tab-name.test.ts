import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Unit tests for the Smart Tab Name IPC handler logic.
 *
 * The handler in ai.ipc.ts is registered via ipcMain.handle, so we test
 * the core logic directly: prompt construction, chunk accumulation, output cleaning,
 * and error handling — without needing Electron's IPC infrastructure.
 */

// Replicate the handler logic as a pure function for testing
async function smartTabNameHandler(
  mockChat: (model: string, messages: { role: string; content: string }[], onChunk: (chunk: { response?: string }) => void) => Promise<void>,
  title: string,
  content: string,
  url: string
): Promise<{ title: string | null }> {
  const messages = [
    {
      role: 'system',
      content: 'Generate a concise, descriptive tab name (max 6 words). Output ONLY the name, no quotes, no punctuation, no explanation.',
    },
    { role: 'user', content: `Page title: ${title}\nURL: ${url}\nExcerpt: ${content}` },
  ]

  try {
    let result = ''
    await mockChat('test-model', messages, (chunk) => {
      result += chunk.response ?? ''
    })
    const cleaned = result.trim().replace(/^["']|["']$/g, '').replace(/[.!]+$/g, '')
    return { title: cleaned || null }
  } catch {
    return { title: null }
  }
}

function makeMockChat(responses: string[]): (model: string, messages: { role: string; content: string }[], onChunk: (chunk: { response?: string }) => void) => Promise<void> {
  return vi.fn(async (_model, _messages, onChunk) => {
    for (const r of responses) {
      onChunk({ response: r })
    }
  })
}

describe('Smart Tab Name handler', () => {
  it('should return cleaned tab name from AI response', async () => {
    const mockChat = makeMockChat(['GitHub', ' Developer', ' Portal'])
    const result = await smartTabNameHandler(mockChat, 'GitHub: Where the world builds software · GitHub', 'GitHub is where over 100 million developers shape the future of software.', 'https://github.com')
    expect(result.title).toBe('GitHub Developer Portal')
  })

  it('should strip surrounding quotes from AI response', async () => {
    const mockChat = makeMockChat(['"React Documentation"'])
    const result = await smartTabNameHandler(mockChat, 'React – A JavaScript library for building user interfaces', 'React lets you build user interfaces out of individual pieces called components.', 'https://react.dev')
    expect(result.title).toBe('React Documentation')
  })

  it('should strip trailing punctuation', async () => {
    const mockChat = makeMockChat(['Python Tutorial!!'])
    const result = await smartTabNameHandler(mockChat, 'Python Tutorial - Free Online Course', 'Learn Python programming with this comprehensive tutorial.', 'https://python.org')
    expect(result.title).toBe('Python Tutorial')
  })

  it('should strip single quotes', async () => {
    const mockChat = makeMockChat(["'Node.js Guide'"])
    const result = await smartTabNameHandler(mockChat, 'Node.js — a JavaScript runtime', 'Node.js is a JavaScript runtime built on Chrome V8 engine.', 'https://nodejs.org')
    expect(result.title).toBe('Node.js Guide')
  })

  it('should return null when AI returns empty response', async () => {
    const mockChat = makeMockChat([''])
    const result = await smartTabNameHandler(mockChat, 'Some Page Title', 'Some content', 'https://example.com')
    expect(result.title).toBeNull()
  })

  it('should return null when AI throws an error', async () => {
    const mockChat = vi.fn(async () => { throw new Error('Ollama not running') })
    const result = await smartTabNameHandler(mockChat, 'Some Page Title', 'Some content', 'https://example.com')
    expect(result.title).toBeNull()
  })

  it('should construct correct prompt with page title, URL, and excerpt', async () => {
    let capturedMessages: { role: string; content: string }[] = []
    const mockChat = vi.fn(async (_model, messages, onChunk) => {
      capturedMessages = messages
      onChunk({ response: 'Test Page' })
    })

    await smartTabNameHandler(mockChat, 'My Page Title', 'Page excerpt content here', 'https://example.com/page')

    expect(capturedMessages).toHaveLength(2)
    expect(capturedMessages[0].role).toBe('system')
    expect(capturedMessages[0].content).toContain('max 6 words')
    expect(capturedMessages[1].role).toBe('user')
    expect(capturedMessages[1].content).toContain('My Page Title')
    expect(capturedMessages[1].content).toContain('https://example.com/page')
    expect(capturedMessages[1].content).toContain('Page excerpt content here')
  })

  it('should handle multi-chunk response', async () => {
    const mockChat = makeMockChat(['Stack', ' Overflow', ' Questions'])
    const result = await smartTabNameHandler(mockChat, 'Stack Overflow - Where Developers Learn', 'Stack Overflow is the largest online community for developers.', 'https://stackoverflow.com')
    expect(result.title).toBe('Stack Overflow Questions')
  })

  it('should return null for whitespace-only response', async () => {
    const mockChat = makeMockChat(['   '])
    const result = await smartTabNameHandler(mockChat, 'Title', 'Content', 'https://example.com')
    expect(result.title).toBeNull()
  })
})
