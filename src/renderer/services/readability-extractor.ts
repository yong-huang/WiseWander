import type { ExtractedArticle } from '../../shared/types'

/**
 * Extract the main article content from a webview's current page.
 * Uses a scoring algorithm similar to Mozilla's Readability to find the
 * best content container, then strips clutter (ads, nav, sidebars, etc.)
 * and returns clean HTML plus metadata.
 */
export async function extractArticle(tabId: string): Promise<ExtractedArticle | null> {
  const webview = document.querySelector(
    `webview[data-tab-id="${tabId}"]`
  ) as Electron.WebviewTag | null
  if (!webview) return null

  const script = `
  (function() {
    // ── Scoring helpers ──
    function scoreCandidate(el) {
      let score = 0;
      const tag = el.tagName.toLowerCase();
      const cls = (el.className || '').toString().toLowerCase();
      const role = (el.getAttribute('role') || '').toLowerCase();
      const id = (el.id || '').toLowerCase();

      // Paragraph density
      const pCount = el.querySelectorAll('p').length;
      score += pCount * 10;

      // Text length
      const textLen = (el.textContent || '').trim().length;
      score += Math.min(textLen / 10, 500);

      // Link density (high = navigation = bad)
      const links = el.querySelectorAll('a');
      const linkTextLen = Array.from(links).reduce((s, a) => s + (a.textContent || '').length, 0);
      const linkDensity = textLen > 0 ? linkTextLen / textLen : 1;
      score -= linkDensity * 200;

      // Semantic bonuses
      if (tag === 'article') score += 60;
      if (tag === 'main' || role === 'main') score += 50;
      if (/[.\\-]post[- ]?content|[.\\-]article[- ]?body|[.\\-]entry[- ]?content|[.\\-]story[- ]?body/.test(cls)) score += 40;
      if (/[.\\-]post|blog|article|content|story/.test(cls) || /[.\\-]post|blog|article|content|story/.test(id)) score += 20;

      // Semantic penalties
      if (tag === 'nav' || tag === 'footer' || tag === 'aside' || tag === 'header') score -= 100;
      if (/[.\\-]sidebar|[.\\-]comment|[.\\-]ad[- ]?|advertisement|[.\\-]social|[.\\-]share|[.\\-]related|[.\\-]footer|[.\\-]nav|[.\\-]menu|[.\\-]cookie|[.\\-]banner|[.\\-]popup|[.\\-]modal/.test(cls)) score -= 80;
      if (/[.\\-]sidebar|[.\\-]comment|[.\\-]ad[- ]?|social|share|related|footer|cookie|banner|popup/.test(id)) score -= 80;

      // Penalize very short or very large candidates
      if (textLen < 100) score -= 50;

      return score;
    }

    // ── Find best candidate ──
    const candidates = document.querySelectorAll('div, article, main, section, td');
    let bestEl = null;
    let bestScore = -Infinity;

    candidates.forEach(function(el) {
      const s = scoreCandidate(el);
      if (s > bestScore) {
        bestScore = s;
        bestEl = el;
      }
    });

    // Fallback to body
    if (!bestEl || bestScore < 50) bestEl = document.body;

    // ── Clone and clean ──
    const clone = bestEl.cloneNode(true);

    // Remove unwanted elements
    const removeSelectors = [
      'script', 'style', 'noscript', 'iframe', 'svg', 'canvas',
      'nav', 'footer', 'header',
      '[role="navigation"]', '[role="banner"]', '[role="contentinfo"]',
      '.sidebar', '.ad', '.ads', '.advertisement', '.social', '.share',
      '.comment', '.comments', '.related', '.cookie', '.cookie-banner',
      '.cookie-consent', '.popup', '.modal', '.newsletter', '.subscribe',
      '.promo', '.promotion', '.sponsor', '.outbrain', '.taboola',
      '.popup-overlay', '.overlay', '.notification'
    ];
    removeSelectors.forEach(function(sel) {
      try {
        clone.querySelectorAll(sel).forEach(function(el) { el.remove(); });
      } catch(e) {}
    });

    // Remove hidden elements
    clone.querySelectorAll('*').forEach(function(el) {
      const style = el.style;
      if (style && (style.display === 'none' || style.visibility === 'hidden')) {
        el.remove();
      }
    });

    // ── Metadata ──
    const title = document.title || '';
    const metaAuthor = document.querySelector('meta[name="author"]');
    const byline = (metaAuthor && metaAuthor.getAttribute('content')) || '';
    const metaDesc = document.querySelector('meta[name="description"]');
    const excerpt = (metaDesc && metaDesc.getAttribute('content')) || '';
    const siteName = (function() {
      const meta = document.querySelector('meta[property="og:site_name"]');
      if (meta) return meta.getAttribute('content') || '';
      return location.hostname;
    })();

    // Stats from cleaned content
    const textContent = (clone.textContent || '').trim();
    const words = textContent.split(/\\s+/).filter(Boolean);
    const wordCount = words.length;
    const imageCount = clone.querySelectorAll('img').length;
    const linkCount = clone.querySelectorAll('a').length;

    // Get clean HTML
    const html = clone.innerHTML;

    return JSON.stringify({
      title: title,
      html: html,
      byline: byline,
      excerpt: excerpt,
      siteName: siteName,
      wordCount: wordCount,
      imageCount: imageCount,
      linkCount: linkCount
    });
  })();
  `

  try {
    const raw = await webview.executeJavaScript(script)
    const data = JSON.parse(raw) as ExtractedArticle
    return data
  } catch {
    return null
  }
}
