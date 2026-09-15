import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useCapabilityStore } from '../../src/renderer/store/capability-store'
import type { ExtractedArticle } from '../../src/shared/types'

// ── Mocks ──

const mockArticle: ExtractedArticle = {
  title: 'Test Article',
  html: '<h1>Hello</h1><p>World <strong>bold</strong> text.</p>',
  byline: 'John Doe',
  excerpt: 'A test article',
  siteName: 'TestSite',
  wordCount: 5,
  imageCount: 1,
  linkCount: 2,
}

vi.mock('../../src/renderer/services/readability-extractor', () => ({
  extractArticle: vi.fn().mockResolvedValue(mockArticle),
}))

vi.mock('../../src/renderer/services/html-to-markdown', () => ({
  htmlToMarkdown: vi.fn().mockReturnValue('# Hello\n\nWorld **bold** text.'),
}))

beforeEach(() => {
  vi.stubGlobal('window', {
    api: {
      capabilityCrawlStart: vi.fn(),
      capabilityCrawlCancel: vi.fn(),
      onCrawlProgress: vi.fn(),
      capabilityCrawlExport: vi.fn(),
      capabilityAnalyzeDesign: vi.fn(),
      capabilityExportTemplate: vi.fn(),
      capabilityMdExport: vi.fn().mockResolvedValue({ success: true, path: '/test/article.md' }),
    },
  })

  useCapabilityStore.setState({
    mdStatus: 'idle',
    mdMarkdown: null,
    mdHtml: null,
    mdMeta: null,
    mdError: null,
    mdViewMode: 'source',
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('CapabilityStore — Markdown Export', () => {
  it('has correct default state', () => {
    const state = useCapabilityStore.getState()
    expect(state.mdStatus).toBe('idle')
    expect(state.mdMarkdown).toBeNull()
    expect(state.mdHtml).toBeNull()
    expect(state.mdMeta).toBeNull()
    expect(state.mdError).toBeNull()
    expect(state.mdViewMode).toBe('source')
  })

  it('runMarkdownExport extracts and converts successfully', async () => {
    const { runMarkdownExport } = useCapabilityStore.getState()
    await runMarkdownExport('tab-1')

    const state = useCapabilityStore.getState()
    expect(state.mdStatus).toBe('done')
    expect(state.mdMarkdown).toBe('# Hello\n\nWorld **bold** text.')
    expect(state.mdHtml).toBe(mockArticle.html)
    expect(state.mdMeta).toBeDefined()
    expect(state.mdMeta?.title).toBe('Test Article')
    expect(state.mdMeta?.byline).toBe('John Doe')
    expect(state.mdMeta?.siteName).toBe('TestSite')
    expect(state.mdMeta?.wordCount).toBe(5)
    expect(state.mdMeta?.imageCount).toBe(1)
    expect(state.mdMeta?.linkCount).toBe(2)
    expect(state.mdMeta?.readingTime).toBeGreaterThanOrEqual(1)
  })

  it('runMarkdownExport calculates reading time correctly', async () => {
    const { runMarkdownExport } = useCapabilityStore.getState()
    await runMarkdownExport('tab-1')

    const state = useCapabilityStore.getState()
    // 5 words / 238 wpm = ~0.02 → rounds to 1 (minimum)
    expect(state.mdMeta?.readingTime).toBe(1)
  })

  it('runMarkdownExport handles extraction returning null', async () => {
    const { extractArticle } = await import('../../src/renderer/services/readability-extractor')
    vi.mocked(extractArticle).mockResolvedValueOnce(null)

    const { runMarkdownExport } = useCapabilityStore.getState()
    await runMarkdownExport('tab-1')

    const state = useCapabilityStore.getState()
    expect(state.mdStatus).toBe('error')
    expect(state.mdError).toBe('Could not extract article from this page.')
  })

  it('runMarkdownExport handles extraction error', async () => {
    const { extractArticle } = await import('../../src/renderer/services/readability-extractor')
    vi.mocked(extractArticle).mockRejectedValueOnce(new Error('Webview not found'))

    const { runMarkdownExport } = useCapabilityStore.getState()
    await runMarkdownExport('tab-1')

    const state = useCapabilityStore.getState()
    expect(state.mdStatus).toBe('error')
    expect(state.mdError).toBe('Webview not found')
  })

  it('resetMdExport clears all md state', async () => {
    const { runMarkdownExport } = useCapabilityStore.getState()
    await runMarkdownExport('tab-1')
    expect(useCapabilityStore.getState().mdStatus).toBe('done')

    const { resetMdExport } = useCapabilityStore.getState()
    resetMdExport()

    const state = useCapabilityStore.getState()
    expect(state.mdStatus).toBe('idle')
    expect(state.mdMarkdown).toBeNull()
    expect(state.mdHtml).toBeNull()
    expect(state.mdMeta).toBeNull()
    expect(state.mdError).toBeNull()
    expect(state.mdViewMode).toBe('source')
  })

  it('setMdViewMode toggles between source and preview', () => {
    const { setMdViewMode } = useCapabilityStore.getState()

    setMdViewMode('preview')
    expect(useCapabilityStore.getState().mdViewMode).toBe('preview')

    setMdViewMode('source')
    expect(useCapabilityStore.getState().mdViewMode).toBe('source')
  })

  it('runMarkdownExport clears previous error on new run', async () => {
    useCapabilityStore.setState({ mdError: 'old error' })

    const { runMarkdownExport } = useCapabilityStore.getState()
    await runMarkdownExport('tab-1')

    const state = useCapabilityStore.getState()
    expect(state.mdStatus).toBe('done')
    expect(state.mdError).toBeNull()
  })

  it('runMarkdownExport clears previous results on new run', async () => {
    const { runMarkdownExport } = useCapabilityStore.getState()
    await runMarkdownExport('tab-1')
    expect(useCapabilityStore.getState().mdMarkdown).toBeTruthy()

    await runMarkdownExport('tab-1')
    const state = useCapabilityStore.getState()
    expect(state.mdStatus).toBe('done')
    expect(state.mdMarkdown).toBeTruthy()
  })
})
