import type { CrawlConfig, CrawlDryRunResult, CrawlProgress, CrawlResult, CrawlPageResult, CrawlImage } from '../../../shared/types'

const LINK_RE = /<a[^>]+href=["']([^"']+)["']/gi
const IMG_RE = /<img[^>]+src=["']([^"']+)["'][^>]*(?:alt=["']([^"']*)["'])?/gi
const TITLE_RE = /<title[^>]*>([^<]*)<\/title>/i

export class WebCrawler {
  private cancelled = false
  private abortController: AbortController | null = null

  cancel(): void {
    this.cancelled = true
    this.abortController?.abort()
  }

  async dryRun(
    config: CrawlConfig,
    firstPage?: CrawlPageResult
  ): Promise<CrawlDryRunResult> {
    let baseOrigin: string
    try {
      baseOrigin = new URL(config.startUrl).origin
    } catch {
      throw new Error(`Invalid start URL: ${config.startUrl}`)
    }

    let title: string
    let images: CrawlImage[]
    let rawLinks: string[]

    if (firstPage) {
      title = firstPage.title
      images = firstPage.images
      rawLinks = firstPage.links
    } else {
      this.abortController = new AbortController()
      const res = await fetch(config.startUrl, {
        signal: this.abortController.signal,
        headers: { 'User-Agent': 'WiseWander-Crawler/1.0' },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${config.startUrl}`)
      const ct = res.headers.get('content-type') ?? ''
      if (!ct.includes('text/html')) throw new Error('Start URL is not an HTML page')
      const html = await res.text()

      const titleMatch = TITLE_RE.exec(html)
      title = titleMatch ? titleMatch[1].trim() : config.startUrl

      images = []
      let imgMatch: RegExpExecArray | null
      IMG_RE.lastIndex = 0
      while ((imgMatch = IMG_RE.exec(html)) !== null) {
        try {
          const src = new URL(imgMatch[1], config.startUrl).href
          images.push({ src, alt: imgMatch[2] ?? '' })
        } catch { /* skip */ }
      }

      rawLinks = []
      let linkMatch: RegExpExecArray | null
      LINK_RE.lastIndex = 0
      while ((linkMatch = LINK_RE.exec(html)) !== null) {
        try {
          const resolved = new URL(linkMatch[1], config.startUrl).href.split('#')[0]
          rawLinks.push(resolved)
        } catch { /* skip */ }
      }
    }

    // Deduplicate and filter links by same-domain / depth constraints
    const seen = new Set<string>()
    const links: Array<{ url: string; title: string }> = []
    for (const href of rawLinks) {
      try {
        const linkUrl = new URL(href)
        if (config.sameDomainOnly && linkUrl.origin !== baseOrigin) continue
        const norm = linkUrl.href.split('#')[0]
        if (norm === config.startUrl || seen.has(norm)) continue
        seen.add(norm)
        // Use the path tail as a rough title fallback
        const linkTitle = linkUrl.pathname.split('/').filter(Boolean).pop() || linkUrl.hostname
        links.push({ url: norm, title: linkTitle })
      } catch { /* skip */ }
    }

    // Estimate total pages: unique links found vs maxPages cap
    const estimatedPages = Math.min(links.length + 1, config.maxPages)

    return {
      startPage: {
        url: config.startUrl,
        title,
        imageCount: images.length,
        linkCount: rawLinks.length,
      },
      links,
      estimatedPages,
    }
  }

  async crawl(
    config: CrawlConfig,
    onProgress: (p: CrawlProgress) => void,
    firstPage?: CrawlPageResult
  ): Promise<CrawlResult> {
    const startTime = Date.now()
    this.cancelled = false

    const visited = new Set<string>()
    const queue: Array<{ url: string; depth: number }> = [{ url: config.startUrl, depth: 0 }]
    const pages: CrawlPageResult[] = []
    let totalImages = 0
    const errors: string[] = []
    let baseOrigin = ''

    try {
      baseOrigin = new URL(config.startUrl).origin
    } catch {
      errors.push(`Invalid start URL: ${config.startUrl}`)
      onProgress({ status: 'error', pagesVisited: 0, imagesFound: 0, currentUrl: '', queueSize: 0, errors })
      return { pages, totalImages: 0, totalPages: 0, duration: Date.now() - startTime, config }
    }

    while (queue.length > 0 && pages.length < config.maxPages) {
      if (this.cancelled) {
        onProgress({
          status: 'cancelling',
          pagesVisited: pages.length,
          imagesFound: totalImages,
          currentUrl: '',
          queueSize: queue.length,
          errors,
        })
        break
      }

      const { url, depth } = queue.shift()!

      // Normalise and deduplicate
      let normalised: string
      try {
        normalised = new URL(url, config.startUrl).href
      } catch {
        continue
      }
      // Strip fragment
      normalised = normalised.split('#')[0]
      if (visited.has(normalised)) continue
      visited.add(normalised)

      onProgress({
        status: 'running',
        pagesVisited: pages.length,
        imagesFound: totalImages,
        currentUrl: normalised,
        queueSize: queue.length,
        errors,
      })

      let pageResult: CrawlPageResult

      // Use pre-extracted rendered page for depth-0 start URL if available
      if (depth === 0 && firstPage) {
        pageResult = {
          ...firstPage,
          url: normalised,
          depth: 0,
          timestamp: Date.now(),
        }
        if (config.mode === 'full-pages') {
          // The rendered HTML from webview is the full DOM outerHTML
          pageResult.html = firstPage.html
        }
        totalImages += pageResult.images.length
      } else {
        // Fetch from network
        this.abortController = new AbortController()
        let html: string
        try {
          const res = await fetch(normalised, {
            signal: this.abortController.signal,
            headers: { 'User-Agent': 'WiseWander-Crawler/1.0' },
          })
          if (!res.ok) {
            errors.push(`${normalised} → HTTP ${res.status}`)
            continue
          }
          const ct = res.headers.get('content-type') ?? ''
          if (!ct.includes('text/html')) continue
          html = await res.text()
        } catch (err) {
          if (this.cancelled) break
          errors.push(`${normalised} → ${(err as Error).message}`)
          continue
        }

        // Parse title
        const titleMatch = TITLE_RE.exec(html)
        const title = titleMatch ? titleMatch[1].trim() : normalised

        // Parse images
        const images: CrawlImage[] = []
        let imgMatch: RegExpExecArray | null
        IMG_RE.lastIndex = 0
        while ((imgMatch = IMG_RE.exec(html)) !== null) {
          try {
            const src = new URL(imgMatch[1], normalised).href
            images.push({ src, alt: imgMatch[2] ?? '' })
          } catch {
            // skip invalid img src
          }
        }
        totalImages += images.length

        // Parse links
        const links: string[] = []
        let linkMatch: RegExpExecArray | null
        LINK_RE.lastIndex = 0
        while ((linkMatch = LINK_RE.exec(html)) !== null) {
          try {
            const resolved = new URL(linkMatch[1], normalised).href.split('#')[0]
            links.push(resolved)
          } catch {
            // skip invalid href
          }
        }

        pageResult = {
          url: normalised,
          title,
          depth,
          images,
          links,
          timestamp: Date.now(),
        }
        if (config.mode === 'full-pages') {
          pageResult.html = html
        }
      }

      pages.push(pageResult)

      // Enqueue child links
      if (depth < config.maxDepth) {
        for (const link of pageResult.links) {
          try {
            const linkUrl = new URL(link)
            if (config.sameDomainOnly && linkUrl.origin !== baseOrigin) continue
            const linkNorm = linkUrl.href.split('#')[0]
            if (!visited.has(linkNorm)) {
              queue.push({ url: linkNorm, depth: depth + 1 })
            }
          } catch {
            // skip
          }
        }
      }
    }

    const status = this.cancelled ? 'cancelling' : 'done'
    onProgress({
      status,
      pagesVisited: pages.length,
      imagesFound: totalImages,
      currentUrl: '',
      queueSize: queue.length,
      errors,
    })

    return {
      pages,
      totalImages,
      totalPages: pages.length,
      duration: Date.now() - startTime,
      config,
    }
  }
}
