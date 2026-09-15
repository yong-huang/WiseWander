import type { CrawlPageResult, CrawlImage } from '../../shared/types'

/**
 * Extract rendered page data (HTML, links, images, title) from the webview
 * for a given tab. Uses the already-rendered DOM, not a fresh fetch.
 */
export async function extractRenderedPage(tabId: string): Promise<CrawlPageResult | null> {
  const webview = document.querySelector(
    `webview[data-tab-id="${tabId}"]`
  ) as Electron.WebviewTag | null
  if (!webview) return null

  const script = `
  (function() {
    const title = document.title || location.href;
    const html = document.documentElement.outerHTML;

    const links = Array.from(document.querySelectorAll('a[href]')).map(a => {
      try { return new URL(a.href, location.href).href; } catch { return null; }
    }).filter(Boolean);

    const images = Array.from(document.querySelectorAll('img[src]')).map(img => ({
      src: (() => { try { return new URL(img.src, location.href).href; } catch { return img.src; } })(),
      alt: img.alt || '',
      width: img.naturalWidth || img.width || undefined,
      height: img.naturalHeight || img.height || undefined,
    }));

    return JSON.stringify({ title, html, links, images, url: location.href });
  })();
  `

  try {
    const raw = await webview.executeJavaScript(script)
    const data = JSON.parse(raw) as {
      title: string
      html: string
      links: string[]
      images: CrawlImage[]
      url: string
    }
    return {
      url: data.url,
      title: data.title,
      depth: 0,
      images: data.images,
      html: data.html,
      links: data.links,
      timestamp: Date.now(),
    }
  } catch {
    return null
  }
}
