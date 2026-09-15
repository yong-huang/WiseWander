import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useCapabilityStore } from '../../../../src/renderer/store/capability-store'
import type { CrawlProgress, CrawlResult, CrawlDryRunResult } from '../../../../src/shared/types'

// Mock window.api for node environment
const mockCrawlStart = vi.fn()
const mockCrawlCancel = vi.fn()
const mockOnCrawlProgress = vi.fn()
const mockCrawlExport = vi.fn()
const mockCrawlDryRun = vi.fn()

beforeEach(() => {
  // Zustand store accesses window.api — stub it
  vi.stubGlobal('window', {
    api: {
      capabilityCrawlStart: mockCrawlStart,
      capabilityCrawlCancel: mockCrawlCancel,
      onCrawlProgress: mockOnCrawlProgress,
      capabilityCrawlExport: mockCrawlExport,
      capabilityCrawlDryRun: mockCrawlDryRun,
      capabilityAnalyzeDesign: vi.fn(),
      capabilityExportTemplate: vi.fn(),
    },
  })

  // Reset store state
  useCapabilityStore.setState({
    crawlStatus: 'idle',
    crawlProgress: null,
    crawlResult: null,
    crawlError: null,
    crawlConfig: {
      startUrl: '',
      maxDepth: 1,
      mode: 'images',
      sameDomainOnly: true,
      maxPages: 50,
    },
    dryRunStatus: 'idle',
    crawlDryRunResult: null,
    dryRunError: null,
    designStatus: 'idle',
    designResult: null,
    designError: null,
    designStyleData: null,
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  mockCrawlDryRun.mockReset()
})

describe('CapabilityStore — Crawl', () => {
  it('has correct default state', () => {
    const state = useCapabilityStore.getState()
    expect(state.crawlStatus).toBe('idle')
    expect(state.crawlProgress).toBeNull()
    expect(state.crawlResult).toBeNull()
    expect(state.crawlError).toBeNull()
    expect(state.crawlConfig).toEqual({
      startUrl: '',
      maxDepth: 1,
      mode: 'images',
      sameDomainOnly: true,
      maxPages: 50,
    })
  })

  it('updateCrawlConfig patches config', () => {
    const { updateCrawlConfig } = useCapabilityStore.getState()
    updateCrawlConfig({ maxDepth: 3, mode: 'full-pages' })

    const state = useCapabilityStore.getState()
    expect(state.crawlConfig.maxDepth).toBe(3)
    expect(state.crawlConfig.mode).toBe('full-pages')
    expect(state.crawlConfig.sameDomainOnly).toBe(true)
  })

  it('startCrawl sets status to running and calls API', async () => {
    const fakeResult: CrawlResult = {
      pages: [],
      totalImages: 0,
      totalPages: 0,
      duration: 100,
      config: { startUrl: 'https://example.com', maxDepth: 1, mode: 'images', sameDomainOnly: true, maxPages: 50 },
    }
    mockCrawlStart.mockResolvedValue(fakeResult)

    const { startCrawl } = useCapabilityStore.getState()
    await startCrawl('https://example.com')

    const state = useCapabilityStore.getState()
    expect(state.crawlStatus).toBe('done')
    expect(state.crawlResult).toEqual(fakeResult)
    expect(mockCrawlStart).toHaveBeenCalledWith(
      expect.objectContaining({ startUrl: 'https://example.com' }),
      undefined
    )
  })

  it('startCrawl handles errors', async () => {
    mockCrawlStart.mockRejectedValue(new Error('Network failure'))

    const { startCrawl } = useCapabilityStore.getState()
    await startCrawl('https://example.com')

    const state = useCapabilityStore.getState()
    expect(state.crawlStatus).toBe('error')
    expect(state.crawlError).toBe('Network failure')
  })

  it('cancelCrawl calls API and sets cancelling', async () => {
    useCapabilityStore.setState({ crawlStatus: 'running' })
    mockCrawlCancel.mockResolvedValue({ success: true })

    const { cancelCrawl } = useCapabilityStore.getState()
    await cancelCrawl()

    expect(mockCrawlCancel).toHaveBeenCalled()
    expect(useCapabilityStore.getState().crawlStatus).toBe('cancelling')
  })

  it('resetCrawl clears all crawl state', () => {
    useCapabilityStore.setState({
      crawlStatus: 'done',
      crawlResult: { pages: [], totalImages: 0, totalPages: 0, duration: 0, config: {} as never },
      crawlProgress: { status: 'done', pagesVisited: 1, imagesFound: 0, currentUrl: '', queueSize: 0, errors: [] },
      crawlError: 'some error',
    })

    const { resetCrawl } = useCapabilityStore.getState()
    resetCrawl()

    const state = useCapabilityStore.getState()
    expect(state.crawlStatus).toBe('idle')
    expect(state.crawlProgress).toBeNull()
    expect(state.crawlResult).toBeNull()
    expect(state.crawlError).toBeNull()
  })

  it('setupCrawlProgressListener registers and returns cleanup', () => {
    const cleanup = vi.fn()
    mockOnCrawlProgress.mockReturnValue(cleanup)

    const { setupCrawlProgressListener } = useCapabilityStore.getState()
    const unsub = setupCrawlProgressListener()

    expect(mockOnCrawlProgress).toHaveBeenCalled()
    expect(typeof unsub).toBe('function')

    // Simulate progress callback
    const callback = mockOnCrawlProgress.mock.calls[0][0] as (data: unknown) => void
    const progress: CrawlProgress = {
      status: 'running',
      pagesVisited: 3,
      imagesFound: 10,
      currentUrl: 'https://example.com/page3',
      queueSize: 5,
      errors: [],
    }
    callback(progress)

    expect(useCapabilityStore.getState().crawlProgress).toEqual(progress)
  })

  it('progress listener updates status to done', () => {
    mockOnCrawlProgress.mockReturnValue(vi.fn())
    const { setupCrawlProgressListener } = useCapabilityStore.getState()
    setupCrawlProgressListener()

    const callback = mockOnCrawlProgress.mock.calls[0][0] as (data: unknown) => void
    callback({ status: 'done', pagesVisited: 5, imagesFound: 20, currentUrl: '', queueSize: 0, errors: [] })

    expect(useCapabilityStore.getState().crawlStatus).toBe('done')
  })

  it('startCrawl merges config from store with startUrl', async () => {
    useCapabilityStore.setState({
      crawlConfig: {
        startUrl: '',
        maxDepth: 2,
        mode: 'full-pages',
        sameDomainOnly: false,
        maxPages: 30,
      },
    })

    mockCrawlStart.mockResolvedValue({
      pages: [],
      totalImages: 0,
      totalPages: 0,
      duration: 0,
      config: {} as never,
    })

    const { startCrawl } = useCapabilityStore.getState()
    await startCrawl('https://test.com')

    expect(mockCrawlStart).toHaveBeenCalledWith({
      startUrl: 'https://test.com',
      maxDepth: 2,
      mode: 'full-pages',
      sameDomainOnly: false,
      maxPages: 30,
    }, undefined)
  })

  // ── Dry run tests ──

  it('dryRunCrawl sets status to running and calls API', async () => {
    const fakeDryRunResult: CrawlDryRunResult = {
      startPage: { url: 'https://example.com', title: 'Example', imageCount: 5, linkCount: 10 },
      links: [{ url: 'https://example.com/about', title: 'About' }],
      estimatedPages: 3,
    }
    mockCrawlDryRun.mockResolvedValue(fakeDryRunResult)

    const { dryRunCrawl } = useCapabilityStore.getState()
    await dryRunCrawl('https://example.com')

    const state = useCapabilityStore.getState()
    expect(state.dryRunStatus).toBe('done')
    expect(state.crawlDryRunResult).toEqual(fakeDryRunResult)
    expect(state.dryRunError).toBeNull()
    expect(mockCrawlDryRun).toHaveBeenCalledWith(
      expect.objectContaining({ startUrl: 'https://example.com' }),
      undefined
    )
  })

  it('dryRunCrawl handles errors', async () => {
    mockCrawlDryRun.mockRejectedValue(new Error('Failed to fetch page'))

    const { dryRunCrawl } = useCapabilityStore.getState()
    await dryRunCrawl('https://invalid.test')

    const state = useCapabilityStore.getState()
    expect(state.dryRunStatus).toBe('error')
    expect(state.dryRunError).toBe('Failed to fetch page')
    expect(state.crawlDryRunResult).toBeNull()
  })

  it('startCrawl clears dry run state', async () => {
    useCapabilityStore.setState({
      dryRunStatus: 'done',
      crawlDryRunResult: {
        startPage: { url: 'https://example.com', title: 'Example', imageCount: 5, linkCount: 10 },
        links: [{ url: 'https://example.com/about', title: 'About' }],
        estimatedPages: 3,
      },
      dryRunError: null,
    })

    mockCrawlStart.mockResolvedValue({
      pages: [],
      totalImages: 0,
      totalPages: 0,
      duration: 100,
      config: { startUrl: 'https://example.com', maxDepth: 1, mode: 'images', sameDomainOnly: true, maxPages: 50 },
    })

    const { startCrawl } = useCapabilityStore.getState()
    await startCrawl('https://example.com')

    const state = useCapabilityStore.getState()
    expect(state.dryRunStatus).toBe('idle')
    expect(state.crawlDryRunResult).toBeNull()
    expect(state.dryRunError).toBeNull()
  })

  it('resetCrawl clears dry run state', () => {
    useCapabilityStore.setState({
      crawlStatus: 'done',
      crawlResult: { pages: [], totalImages: 0, totalPages: 0, duration: 0, config: {} as never },
      crawlProgress: { status: 'done', pagesVisited: 1, imagesFound: 0, currentUrl: '', queueSize: 0, errors: [] },
      crawlError: 'some error',
      dryRunStatus: 'done',
      crawlDryRunResult: {
        startPage: { url: 'https://example.com', title: 'Example', imageCount: 5, linkCount: 10 },
        links: [{ url: 'https://example.com/about', title: 'About' }],
        estimatedPages: 3,
      },
      dryRunError: 'analysis failed',
    })

    const { resetCrawl } = useCapabilityStore.getState()
    resetCrawl()

    const state = useCapabilityStore.getState()
    expect(state.crawlStatus).toBe('idle')
    expect(state.crawlProgress).toBeNull()
    expect(state.crawlResult).toBeNull()
    expect(state.crawlError).toBeNull()
    expect(state.dryRunStatus).toBe('idle')
    expect(state.crawlDryRunResult).toBeNull()
    expect(state.dryRunError).toBeNull()
  })
})
