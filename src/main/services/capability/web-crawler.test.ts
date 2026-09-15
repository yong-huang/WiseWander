import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { WebCrawler } from './web-crawler'
import type { CrawlConfig, CrawlProgress } from '../../../shared/types'

// ── Helpers ──

function makeHtml(title: string, links: string[] = [], images: string[] = []): string {
  const linkTags = links.map((l) => `<a href="${l}">link</a>`).join('\n')
  const imgTags = images.map((s) => `<img src="${s}" alt="img">`).join('\n')
  return `<!DOCTYPE html><html><head><title>${title}</title></head><body>${linkTags}${imgTags}</body></html>`
}

function mockFetch(responses: Map<string, { html: string; status?: number; contentType?: string }>): void {
  // Normalize keys so lookups match what the crawler produces via new URL(...).href
  const normalised = new Map<string, { html: string; status?: number; contentType?: string }>()
  for (const [k, v] of responses) {
    try {
      normalised.set(new URL(k).href, v)
    } catch {
      normalised.set(k, v)
    }
  }

  globalThis.fetch = vi.fn(async (url: string | Request | URL) => {
    const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.href : url.url
    const entry = normalised.get(urlStr)
    if (!entry) {
      return new Response('Not Found', { status: 404 })
    }
    if (entry.status && entry.status !== 200) {
      return new Response('Error', { status: entry.status })
    }
    return new Response(entry.html, {
      status: 200,
      headers: { 'content-type': entry.contentType ?? 'text/html' },
    })
  }) as unknown as typeof globalThis.fetch
}

// ── Tests ──

describe('WebCrawler', () => {
  let crawler: WebCrawler

  beforeEach(() => {
    crawler = new WebCrawler()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('crawls a single page with depth=0', async () => {
    const html = makeHtml('Test Page', ['https://example.com/page2'], ['https://example.com/img.png'])
    mockFetch(new Map([['https://example.com', { html }]]))

    const config: CrawlConfig = {
      startUrl: 'https://example.com',
      maxDepth: 0,
      mode: 'images',
      sameDomainOnly: true,
      maxPages: 50,
    }
    const progress: CrawlProgress[] = []
    const result = await crawler.crawl(config, (p) => progress.push(p))

    expect(result.pages).toHaveLength(1)
    expect(result.pages[0].title).toBe('Test Page')
    expect(result.pages[0].images).toHaveLength(1)
    expect(result.pages[0].images[0].src).toBe('https://example.com/img.png')
    expect(result.pages[0].depth).toBe(0)
    expect(result.totalPages).toBe(1)
    expect(result.totalImages).toBe(1)
    // depth=0 should NOT enqueue child links
    expect(result.pages[0].links).toEqual(['https://example.com/page2'])
  })

  it('follows links when maxDepth > 0', async () => {
    const html1 = makeHtml('Page1', ['https://example.com/page2'], ['https://example.com/a.png'])
    const html2 = makeHtml('Page2', [], ['https://example.com/b.png'])
    mockFetch(
      new Map([
        ['https://example.com', { html: html1 }],
        ['https://example.com/page2', { html: html2 }],
      ])
    )

    const config: CrawlConfig = {
      startUrl: 'https://example.com',
      maxDepth: 1,
      mode: 'images',
      sameDomainOnly: true,
      maxPages: 50,
    }
    const result = await crawler.crawl(config, vi.fn())

    expect(result.pages).toHaveLength(2)
    expect(result.totalImages).toBe(2)
    expect(result.pages[1].depth).toBe(1)
  })

  it('respects sameDomainOnly=false', async () => {
    const html = makeHtml('Page', ['https://other-domain.com/page'], [])
    mockFetch(
      new Map([
        ['https://example.com', { html }],
        ['https://other-domain.com/page', { html: makeHtml('Other') }],
      ])
    )

    const config: CrawlConfig = {
      startUrl: 'https://example.com',
      maxDepth: 1,
      mode: 'images',
      sameDomainOnly: false,
      maxPages: 50,
    }
    const result = await crawler.crawl(config, vi.fn())

    expect(result.pages).toHaveLength(2)
    expect(result.pages[1].url).toBe('https://other-domain.com/page')
  })

  it('blocks cross-domain links when sameDomainOnly=true', async () => {
    const html = makeHtml('Page', ['https://other.com/page'], [])
    mockFetch(new Map([['https://example.com', { html }]]))

    const config: CrawlConfig = {
      startUrl: 'https://example.com',
      maxDepth: 1,
      mode: 'images',
      sameDomainOnly: true,
      maxPages: 50,
    }
    const result = await crawler.crawl(config, vi.fn())

    expect(result.pages).toHaveLength(1)
    // child link is cross-domain, so not followed
  })

  it('respects maxPages limit', async () => {
    const pages = new Map<string, { html: string }>()
    for (let i = 0; i < 20; i++) {
      const url = i === 0 ? 'https://example.com' : `https://example.com/p${i}`
      const nextLink = `https://example.com/p${i + 1}`
      pages.set(url, { html: makeHtml(`Page${i}`, [nextLink]) })
    }
    mockFetch(pages)

    const config: CrawlConfig = {
      startUrl: 'https://example.com',
      maxDepth: 20,
      mode: 'images',
      sameDomainOnly: true,
      maxPages: 5,
    }
    const result = await crawler.crawl(config, vi.fn())

    expect(result.pages.length).toBeLessThanOrEqual(5)
  })

  it('deduplicates URLs (does not revisit)', async () => {
    const html = makeHtml('Page', [
      'https://example.com/page2',
      'https://example.com/page2', // duplicate
      'https://example.com/page2#section', // same URL with fragment
    ])
    const page2html = makeHtml('Page2')
    mockFetch(
      new Map([
        ['https://example.com', { html }],
        ['https://example.com/page2', { html: page2html }],
      ])
    )

    const config: CrawlConfig = {
      startUrl: 'https://example.com',
      maxDepth: 1,
      mode: 'images',
      sameDomainOnly: true,
      maxPages: 50,
    }
    const result = await crawler.crawl(config, vi.fn())

    // page2 should be visited only once despite 3 links
    expect(result.pages).toHaveLength(2)
  })

  it('cancels mid-crawl', async () => {
    let fetchCount = 0
    globalThis.fetch = vi.fn(async (url: string | Request | URL) => {
      fetchCount++
      // Cancel after first page is fetched
      if (fetchCount === 1) {
        crawler.cancel()
      }
      const _urlStr = typeof url === 'string' ? url : url instanceof URL ? url.href : url.url
      return new Response(makeHtml('Page', [`https://example.com/p${fetchCount}`]), {
        headers: { 'content-type': 'text/html' },
      })
    }) as unknown as typeof globalThis.fetch

    const config: CrawlConfig = {
      startUrl: 'https://example.com',
      maxDepth: 5,
      mode: 'images',
      sameDomainOnly: true,
      maxPages: 50,
    }
    const progress: CrawlProgress[] = []
    const result = await crawler.crawl(config, (p) => progress.push(p))

    // Should have stopped — not visited all possible pages
    expect(result.pages.length).toBeLessThanOrEqual(3)
    const finalProgress = progress[progress.length - 1]
    expect(finalProgress?.status).toBe('cancelling')
  })

  it('stores HTML in full-pages mode', async () => {
    const html = makeHtml('TestPage')
    mockFetch(new Map([['https://example.com', { html }]]))

    const config: CrawlConfig = {
      startUrl: 'https://example.com',
      maxDepth: 0,
      mode: 'full-pages',
      sameDomainOnly: true,
      maxPages: 50,
    }
    const result = await crawler.crawl(config, vi.fn())

    expect(result.pages[0].html).toBe(html)
  })

  it('does NOT store HTML in images mode', async () => {
    const html = makeHtml('TestPage')
    mockFetch(new Map([['https://example.com', { html }]]))

    const config: CrawlConfig = {
      startUrl: 'https://example.com',
      maxDepth: 0,
      mode: 'images',
      sameDomainOnly: true,
      maxPages: 50,
    }
    const result = await crawler.crawl(config, vi.fn())

    expect(result.pages[0].html).toBeUndefined()
  })

  it('handles non-HTML content-type by skipping', async () => {
    mockFetch(
      new Map([['https://example.com', { html: 'binary-data', contentType: 'application/pdf' }]])
    )

    const config: CrawlConfig = {
      startUrl: 'https://example.com',
      maxDepth: 0,
      mode: 'images',
      sameDomainOnly: true,
      maxPages: 50,
    }
    const result = await crawler.crawl(config, vi.fn())

    expect(result.pages).toHaveLength(0)
  })

  it('handles HTTP errors gracefully', async () => {
    mockFetch(new Map([['https://example.com', { html: '', status: 500 }]]))

    const config: CrawlConfig = {
      startUrl: 'https://example.com',
      maxDepth: 0,
      mode: 'images',
      sameDomainOnly: true,
      maxPages: 50,
    }
    const progress: CrawlProgress[] = []
    const result = await crawler.crawl(config, (p) => progress.push(p))

    expect(result.pages).toHaveLength(0)
    expect(progress.some((p) => p.errors.length > 0)).toBe(true)
  })

  it('handles invalid start URL', async () => {
    const config: CrawlConfig = {
      startUrl: 'not-a-url',
      maxDepth: 0,
      mode: 'images',
      sameDomainOnly: true,
      maxPages: 50,
    }
    const progress: CrawlProgress[] = []
    const result = await crawler.crawl(config, (p) => progress.push(p))

    expect(result.pages).toHaveLength(0)
    expect(progress[0]?.status).toBe('error')
  })

  it('handles relative links and image sources', async () => {
    const html = `<!DOCTYPE html><html><head><title>Rel</title></head><body>
      <a href="/about">About</a>
      <img src="/images/logo.png" alt="logo">
    </body></html>`
    mockFetch(new Map([['https://example.com', { html }]]))

    const config: CrawlConfig = {
      startUrl: 'https://example.com',
      maxDepth: 0,
      mode: 'images',
      sameDomainOnly: true,
      maxPages: 50,
    }
    const result = await crawler.crawl(config, vi.fn())

    expect(result.pages[0].images[0].src).toBe('https://example.com/images/logo.png')
    expect(result.pages[0].links[0]).toBe('https://example.com/about')
  })

  it('handles fetch network error', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error('Network error')
    }) as unknown as typeof globalThis.fetch

    const config: CrawlConfig = {
      startUrl: 'https://example.com',
      maxDepth: 0,
      mode: 'images',
      sameDomainOnly: true,
      maxPages: 50,
    }
    const progress: CrawlProgress[] = []
    const result = await crawler.crawl(config, (p) => progress.push(p))

    expect(result.pages).toHaveLength(0)
    expect(progress.some((p) => p.errors.some((e) => e.includes('Network error')))).toBe(true)
  })

  it('reports progress callbacks', async () => {
    mockFetch(new Map([['https://example.com', { html: makeHtml('P1') }]]))

    const config: CrawlConfig = {
      startUrl: 'https://example.com',
      maxDepth: 0,
      mode: 'images',
      sameDomainOnly: true,
      maxPages: 50,
    }
    const progress: CrawlProgress[] = []
    await crawler.crawl(config, (p) => progress.push(p))

    // Should have at least a "running" and a "done" callback
    expect(progress.some((p) => p.status === 'running')).toBe(true)
    expect(progress.some((p) => p.status === 'done')).toBe(true)
  })

  it('strips URL fragments for dedup', async () => {
    const html = makeHtml('Page', ['https://example.com/page#section1'])
    const html2 = makeHtml('Page2')
    mockFetch(
      new Map([
        ['https://example.com', { html }],
        ['https://example.com/page', { html: html2 }],
      ])
    )

    const config: CrawlConfig = {
      startUrl: 'https://example.com',
      maxDepth: 1,
      mode: 'images',
      sameDomainOnly: true,
      maxPages: 50,
    }
    const result = await crawler.crawl(config, vi.fn())

    expect(result.pages).toHaveLength(2)
  })
})
