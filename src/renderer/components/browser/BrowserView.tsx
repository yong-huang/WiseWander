import { useRef, useEffect } from 'react'
import { useDevToolsStore } from '../../store/devtools-store'

interface BrowserViewProps {
  tabId: string
  url: string
  isActive: boolean
  onTitleUpdate: (tabId: string, title: string) => void
  onUrlUpdate: (tabId: string, url: string) => void
  onFaviconUpdate: (tabId: string, favicon: string) => void
  onLoadStateChange: (tabId: string, loading: boolean) => void
  onPageLoaded: (tabId: string, url: string) => void
}

export function BrowserView({
  tabId,
  url,
  isActive,
  onTitleUpdate,
  onUrlUpdate,
  onFaviconUpdate,
  onLoadStateChange,
  onPageLoaded,
}: BrowserViewProps): React.ReactElement {
  const webviewRef = useRef<Electron.WebviewTag>(null)
  const currentUrlRef = useRef(url)
  const initialUrlRef = useRef(url || 'about:blank')

  // Navigate webview when url prop changes (webview ignores src attribute updates)
  useEffect(() => {
    const webview = webviewRef.current
    if (!webview) return
    if (url && url !== currentUrlRef.current) {
      webview.loadURL(url)
      currentUrlRef.current = url
    }
  }, [url])

  useEffect(() => {
    const webview = webviewRef.current
    if (!webview) return

    const handleDidStartLoading = (): void => {
      onLoadStateChange(tabId, true)
    }

    const handleDidStopLoading = (): void => {
      onLoadStateChange(tabId, false)
      onPageLoaded(tabId, currentUrlRef.current)
    }

    const handlePageTitleUpdated = (e: Electron.PageTitleUpdatedEvent): void => {
      onTitleUpdate(tabId, e.title)
    }

    const handleDidNavigate = (e: Electron.DidNavigateEvent): void => {
      currentUrlRef.current = e.url
      onUrlUpdate(tabId, e.url)
    }

    const handleDidNavigateInPage = (e: Electron.DidNavigateInPageEvent): void => {
      if (e.url) {
        currentUrlRef.current = e.url
        onUrlUpdate(tabId, e.url)
      }
    }

    const handlePageFaviconUpdated = (e: Electron.PageFaviconUpdatedEvent): void => {
      if (e.favicons && e.favicons.length > 0) {
        onFaviconUpdate(tabId, e.favicons[0])
      }
    }

    const handleConsoleMessage = (e: Electron.ConsoleMessageEvent): void => {
      const levels = ['log', 'warn', 'error', 'info'] as const
      useDevToolsStore.getState().addConsoleEntry(tabId, {
        id: `c-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        level: levels[e.level] ?? 'log',
        text: e.message,
        source: e.sourceId,
        line: e.line,
        timestamp: Date.now(),
      })
    }

    const handleContextMenu = (e: Electron.ContextMenuEvent): void => {
      const wcId = webview.getWebContentsId()
      const p = e.params
      window.api.contextMenuShow({
        tabId,
        webContentsId: wcId,
        linkURL: p.linkURL ?? '',
        mediaType: p.mediaType ?? 'none',
        srcURL: p.srcURL ?? '',
        selectionText: p.selectionText ?? '',
        isEditable: p.isEditable ?? false,
        pageURL: p.pageURL ?? '',
        pageTitle: p.titleText ?? '',
        suggestedFilename: p.suggestedFilename,
        x: p.x,
        y: p.y,
        editFlags: {
          canUndo: p.editFlags?.canUndo ?? false,
          canRedo: p.editFlags?.canRedo ?? false,
          canCut: p.editFlags?.canCut ?? false,
          canCopy: p.editFlags?.canCopy ?? false,
          canPaste: p.editFlags?.canPaste ?? false,
          canDelete: p.editFlags?.canDelete ?? false,
          canSelectAll: p.editFlags?.canSelectAll ?? false,
        },
      })
    }

    const handleDidFinishLoad = (): void => {
      // Fetch network data for DevTools
      const dtState = useDevToolsStore.getState()
      if (!dtState.isOpen) return
      webview.executeJavaScript(
        `(function(){try{return JSON.stringify(performance.getEntriesByType('resource').map(function(e,i){return{name:e.name,initiatorType:e.initiatorType||'other',duration:Math.round(e.duration),startTime:Math.round(e.startTime),transferSize:e.transferSize||0,responseStatus:e.responseStatus||0}}))}catch(e){return'[]'}})()`
      ).then((raw: string) => {
        try {
          const items = JSON.parse(raw) as Array<{
            name: string
            initiatorType: string
            duration: number
            startTime: number
            transferSize: number
            responseStatus: number
          }>
          const mapped = items.map((item, i) => {
            let shortName = item.name
            try { shortName = new URL(item.name).host + new URL(item.name).pathname } catch { /* keep original name */ }
            return {
              id: `n-${i}-${Date.now()}`,
              url: item.name,
              name: shortName,
              method: '',
              status: item.responseStatus,
              mimeType: '',
              initiatorType: item.initiatorType,
              startTime: item.startTime,
              duration: item.duration,
              size: item.transferSize,
            }
          })
          useDevToolsStore.getState().setNetworkEntries(tabId, mapped)
        } catch { /* ignore */ }
      }).catch(() => {})
    }

    webview.addEventListener('did-start-loading', handleDidStartLoading)
    webview.addEventListener('did-stop-loading', handleDidStopLoading)
    webview.addEventListener('page-title-updated', handlePageTitleUpdated)
    webview.addEventListener('did-navigate', handleDidNavigate)
    webview.addEventListener('did-navigate-in-page', handleDidNavigateInPage)
    webview.addEventListener('page-favicon-updated', handlePageFaviconUpdated)
    webview.addEventListener('console-message', handleConsoleMessage)
    webview.addEventListener('did-finish-load', handleDidFinishLoad)
    webview.addEventListener('context-menu', handleContextMenu)

    return () => {
      webview.removeEventListener('did-start-loading', handleDidStartLoading)
      webview.removeEventListener('did-stop-loading', handleDidStopLoading)
      webview.removeEventListener('page-title-updated', handlePageTitleUpdated)
      webview.removeEventListener('did-navigate', handleDidNavigate)
      webview.removeEventListener('did-navigate-in-page', handleDidNavigateInPage)
      webview.removeEventListener('page-favicon-updated', handlePageFaviconUpdated)
      webview.removeEventListener('console-message', handleConsoleMessage)
      webview.removeEventListener('did-finish-load', handleDidFinishLoad)
      webview.removeEventListener('context-menu', handleContextMenu)
    }
  }, [tabId, onTitleUpdate, onUrlUpdate, onFaviconUpdate, onLoadStateChange, onPageLoaded])

  return (
    <webview
      ref={webviewRef}
      data-tab-id={tabId}
      className="h-full w-full"
      style={{ display: isActive ? 'flex' : 'none' }}
      src={initialUrlRef.current}
      allowpopups={true}
      partition="persist:wisewander"
    />
  )
}

/**
 * Extract page context from the active webview.
 * Returns structured PageContext for AI processing.
 */
export async function extractPageContext(tabId: string): Promise<unknown | null> {
  const webview = document.querySelector(
    `webview[data-tab-id="${tabId}"]`
  ) as Electron.WebviewTag | null
  if (!webview) return null

  const script = `
  (function() {
    function getMainContent() {
      const selectors = ['article', 'main', '[role="main"]', '.post-content', '.article-body'];
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el && el.textContent.trim().length > 200) return el.textContent.trim();
      }
      return document.body ? document.body.innerText.trim() : '';
    }

    const headings = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6')).map(h => ({
      level: parseInt(h.tagName[1]),
      text: h.textContent.trim()
    }));

    const metadata = {};
    document.querySelectorAll('meta[name], meta[property]').forEach(meta => {
      const key = meta.getAttribute('name') || meta.getAttribute('property');
      if (key) metadata[key] = meta.getAttribute('content') || '';
    });

    return JSON.stringify({
      url: location.href,
      title: document.title,
      textContent: getMainContent().slice(0, 30000),
      headings: headings.slice(0, 50),
      language: document.documentElement.lang || 'en',
      metadata
    });
  })();
  `

  try {
    const raw = await webview.executeJavaScript(script)
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/**
 * Extract lightweight context for smart tab naming.
 * Returns {title, content, url} or null.
 */
export async function extractTabNamingContext(tabId: string): Promise<{ title: string; content: string; url: string } | null> {
  const webview = document.querySelector(
    `webview[data-tab-id="${tabId}"]`
  ) as Electron.WebviewTag | null
  if (!webview) return null

  const script = `
  (function() {
    var desc = document.querySelector('meta[property="og:description"]') ||
               document.querySelector('meta[name="description"]');
    var content = desc ? (desc.getAttribute('content') || '') : '';
    if (!content) {
      var main = document.querySelector('article') || document.querySelector('main');
      content = main ? main.innerText.trim().slice(0, 300) :
                (document.body ? document.body.innerText.trim().slice(0, 300) : '');
    }
    return JSON.stringify({ title: document.title, content: content, url: location.href });
  })();
  `

  try {
    const raw = await webview.executeJavaScript(script)
    const parsed = JSON.parse(raw)
    if (!parsed.title && !parsed.content) return null
    return parsed
  } catch {
    return null
  }
}
