import { describe, it, expect } from 'vitest'
import { buildPrompt, TEMPLATES } from '../../../../../src/main/services/ai/prompt-builder'
import type { PageContext } from '../../../../../src/shared/types'

const mockContext: PageContext = {
  url: 'https://example.com/article',
  title: 'Test Article',
  textContent: 'This is the main content of the article. It discusses important topics.',
  headings: [{ level: 1, text: 'Introduction' }],
  links: [{ text: 'Link', href: 'https://example.com' }],
  images: [],
  tables: [],
  metadata: { description: 'A test article' },
  language: 'en',
}

describe('prompt-builder', () => {
  describe('TEMPLATES', () => {
    it('should have chat, summary, and translate templates', () => {
      expect(TEMPLATES.chat).toBeDefined()
      expect(TEMPLATES.summary).toBeDefined()
      expect(TEMPLATES.translate).toBeDefined()
    })

    it('each template should have required fields', () => {
      for (const template of Object.values(TEMPLATES)) {
        expect(template.id).toBeDefined()
        expect(template.name).toBeDefined()
        expect(template.system).toBeDefined()
        expect(template.buildUser).toBeDefined()
      }
    })
  })

  describe('buildPrompt', () => {
    it('should build a chat prompt with page context', () => {
      const result = buildPrompt('chat', mockContext, 'What is this about?')
      expect(result.system).toContain('intelligent assistant')
      expect(result.user).toContain('Test Article')
      expect(result.user).toContain('What is this about?')
    })

    it('should build a summary prompt', () => {
      const result = buildPrompt('summary', mockContext, '')
      expect(result.system).toContain('summarization')
      expect(result.user).toContain(mockContext.textContent)
    })

    it('should build a translate prompt', () => {
      const result = buildPrompt('translate', mockContext, 'Hello world')
      expect(result.system).toContain('translator')
      expect(result.user).toBe('Hello world')
    })

    it('should throw for unknown template', () => {
      expect(() => buildPrompt('unknown', mockContext, '')).toThrow('Unknown prompt template')
    })

    it('should truncate long content in chat template', () => {
      const longContext = {
        ...mockContext,
        textContent: 'x'.repeat(20_000),
      }
      const result = buildPrompt('chat', longContext, 'test')
      // The user message should not contain the full 20k chars
      expect(result.user.length).toBeLessThan(20_000)
    })
  })
})
