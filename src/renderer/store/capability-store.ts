import { create } from 'zustand'
import type {
  DesignStyleData,
  DesignAnalysisResult,
  CrawlConfig,
  CrawlDryRunResult,
  CrawlPageResult,
  CrawlStatus,
  CrawlProgress,
  CrawlResult,
  MarkdownExportMeta,
  ScreenshotMode,
  ScreenshotProgress,
  ScreenshotResult,
  ExtractionResult,
  MultiTabResult,
  MultiTabAnalysisMode,
  CssEditResult,
  A11yAuditResult,
  MonitoredPage,
  ChangeRecord,
} from '../../shared/types'

export type AnalysisStatus = 'idle' | 'extracting' | 'analyzing' | 'done' | 'error'
export type MdExportStatus = 'idle' | 'extracting' | 'converting' | 'done' | 'error'
export type DryRunStatus = 'idle' | 'running' | 'done' | 'error'

interface CapabilityState {
  designStatus: AnalysisStatus
  designResult: DesignAnalysisResult | null
  designError: string | null
  designStyleData: DesignStyleData | null

  runAnalysis: (tabId: string) => Promise<void>
  resetDesign: () => void

  // ── Crawler ──
  crawlStatus: CrawlStatus
  crawlProgress: CrawlProgress | null
  crawlResult: CrawlResult | null
  crawlError: string | null
  crawlConfig: CrawlConfig
  dryRunStatus: DryRunStatus
  crawlDryRunResult: CrawlDryRunResult | null
  dryRunError: string | null

  startCrawl: (startUrl: string, tabId?: string) => Promise<void>
  dryRunCrawl: (startUrl: string, tabId?: string) => Promise<void>
  cancelCrawl: () => Promise<void>
  resetCrawl: () => void
  updateCrawlConfig: (patch: Partial<CrawlConfig>) => void
  setupCrawlProgressListener: () => () => void

  // ── Markdown Export ──
  mdStatus: MdExportStatus
  mdMarkdown: string | null
  mdHtml: string | null
  mdMeta: MarkdownExportMeta | null
  mdError: string | null
  mdViewMode: 'source' | 'preview'

  runMarkdownExport: (tabId: string) => Promise<void>
  resetMdExport: () => void
  setMdViewMode: (mode: 'source' | 'preview') => void

  // ── Screenshot ──
  screenshotStatus: 'idle' | 'capturing' | 'done' | 'error'
  screenshotProgress: ScreenshotProgress | null
  screenshotResult: ScreenshotResult | null
  screenshotError: string | null

  captureScreenshot: (tabId: string, mode: ScreenshotMode) => Promise<void>
  resetScreenshot: () => void
  setupScreenshotProgressListener: () => () => void

  // ── Data Extraction ──
  extractionStatus: 'idle' | 'extracting' | 'done' | 'error'
  extractionResult: ExtractionResult | null
  extractionError: string | null

  runExtraction: (tabId: string, description: string, format: 'json' | 'csv', cssSelector?: string) => Promise<void>
  exportExtraction: () => Promise<void>
  resetExtraction: () => void

  // ── Multi-Tab Analysis ──
  multiTabStatus: 'idle' | 'analyzing' | 'done' | 'error'
  multiTabResult: MultiTabResult | null
  multiTabError: string | null

  runMultiTabAnalysis: (tabIds: string[], mode: MultiTabAnalysisMode, query?: string) => Promise<void>
  resetMultiTab: () => void

  // ── CSS Smart Editor ──
  cssEditorStatus: 'idle' | 'generating' | 'done' | 'error'
  cssEditorResult: CssEditResult | null
  cssEditorError: string | null

  generateCss: (selector: string, description: string, pageUrl: string) => Promise<void>
  resetCssEditor: () => void

  // ── Accessibility Audit ──
  a11yStatus: 'idle' | 'auditing' | 'done' | 'error'
  a11yResult: A11yAuditResult | null
  a11yError: string | null

  runA11yAudit: (tabId: string) => Promise<void>
  exportA11yReport: () => Promise<void>
  resetA11y: () => void

  // ── Page Monitor ──
  monitoredPages: MonitoredPage[]
  monitorChanges: ChangeRecord[]
  monitorLoading: boolean

  loadMonitoredPages: () => Promise<void>
  addMonitoredPage: (url: string, title: string, checkIntervalMs?: number, selector?: string) => Promise<void>
  removeMonitoredPage: (id: string) => Promise<void>
  toggleMonitoredPage: (id: string) => Promise<void>
  loadMonitorHistory: (monitoredPageId: string) => Promise<void>
  checkNow: (id: string) => Promise<void>
  setupMonitorListener: () => () => void
}

const DEFAULT_CRAWL_CONFIG: CrawlConfig = {
  startUrl: '',
  maxDepth: 1,
  mode: 'images',
  sameDomainOnly: true,
  maxPages: 50,
}

export const useCapabilityStore = create<CapabilityState>((set, get) => ({
  designStatus: 'idle',
  designResult: null,
  designError: null,
  designStyleData: null,

  runAnalysis: async (tabId: string) => {
    set({ designStatus: 'extracting', designError: null, designResult: null })

    try {
      const { extractDesignStyle } = await import('../services/design-style-extractor')
      const data = await extractDesignStyle(tabId)
      if (!data) {
        set({ designStatus: 'error', designError: 'Could not extract styles from this page.' })
        return
      }

      set({ designStyleData: data, designStatus: 'analyzing' })

      const result = (await window.api.capabilityAnalyzeDesign(data)) as DesignAnalysisResult
      set({ designResult: result, designStatus: 'done' })
    } catch (err) {
      set({ designStatus: 'error', designError: err instanceof Error ? err.message : String(err) })
    }
  },

  resetDesign: () =>
    set({ designStatus: 'idle', designResult: null, designError: null, designStyleData: null }),

  // ── Crawler ──
  crawlStatus: 'idle',
  crawlProgress: null,
  crawlResult: null,
  crawlError: null,
  crawlConfig: { ...DEFAULT_CRAWL_CONFIG },
  dryRunStatus: 'idle',
  crawlDryRunResult: null,
  dryRunError: null,

  startCrawl: async (startUrl: string, tabId?: string) => {
    set({
      crawlStatus: 'running',
      crawlProgress: null,
      crawlResult: null,
      crawlError: null,
      crawlConfig: { ...get().crawlConfig, startUrl },
      crawlDryRunResult: null,
      dryRunStatus: 'idle',
      dryRunError: null,
    })

    try {
      // Extract rendered page from webview for the starting page
      let firstPage: CrawlPageResult | undefined
      if (tabId) {
        try {
          const { extractRenderedPage } = await import('../services/page-extractor')
          const extracted = await extractRenderedPage(tabId)
          if (extracted) {
            firstPage = extracted
          }
        } catch {
          // Fallback to fetch-based extraction
        }
      }

      const result = (await window.api.capabilityCrawlStart({
        ...get().crawlConfig,
        startUrl,
      }, firstPage)) as CrawlResult
      set({ crawlResult: result, crawlStatus: 'done' })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      set({ crawlError: msg, crawlStatus: 'error' })
    }
  },

  cancelCrawl: async () => {
    set({ crawlStatus: 'cancelling' })
    await window.api.capabilityCrawlCancel()
  },

  dryRunCrawl: async (startUrl: string, tabId?: string) => {
    set({
      dryRunStatus: 'running',
      crawlDryRunResult: null,
      dryRunError: null,
      crawlConfig: { ...get().crawlConfig, startUrl },
    })

    try {
      let firstPage: CrawlPageResult | undefined
      if (tabId) {
        try {
          const { extractRenderedPage } = await import('../services/page-extractor')
          const extracted = await extractRenderedPage(tabId)
          if (extracted) {
            firstPage = extracted
          }
        } catch {
          // Fallback to fetch-based extraction
        }
      }

      const result = (await window.api.capabilityCrawlDryRun({
        ...get().crawlConfig,
        startUrl,
      }, firstPage)) as CrawlDryRunResult
      set({ crawlDryRunResult: result, dryRunStatus: 'done' })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      set({ dryRunError: msg, dryRunStatus: 'error' })
    }
  },

  resetCrawl: () =>
    set({
      crawlStatus: 'idle',
      crawlProgress: null,
      crawlResult: null,
      crawlError: null,
      dryRunStatus: 'idle',
      crawlDryRunResult: null,
      dryRunError: null,
    }),

  updateCrawlConfig: (patch: Partial<CrawlConfig>) =>
    set((state) => ({ crawlConfig: { ...state.crawlConfig, ...patch } })),

  setupCrawlProgressListener: () => {
    return window.api.onCrawlProgress((data: unknown) => {
      const progress = data as CrawlProgress
      set({ crawlProgress: progress })
      if (progress.status === 'done') {
        set({ crawlStatus: 'done' })
      } else if (progress.status === 'error') {
        set({ crawlStatus: 'error' })
      }
    })
  },

  // ── Markdown Export ──
  mdStatus: 'idle',
  mdMarkdown: null,
  mdHtml: null,
  mdMeta: null,
  mdError: null,
  mdViewMode: 'source',

  runMarkdownExport: async (tabId: string) => {
    set({ mdStatus: 'extracting', mdError: null, mdMarkdown: null, mdHtml: null, mdMeta: null })

    try {
      const { extractArticle } = await import('../services/readability-extractor')
      const article = await extractArticle(tabId)
      if (!article) {
        set({ mdStatus: 'error', mdError: 'Could not extract article from this page.' })
        return
      }

      set({ mdStatus: 'converting' })

      const { htmlToMarkdown } = await import('../services/html-to-markdown')
      const markdown = htmlToMarkdown(article.html)

      const readingTime = Math.max(1, Math.round(article.wordCount / 238))

      set({
        mdStatus: 'done',
        mdMarkdown: markdown,
        mdHtml: article.html,
        mdMeta: {
          title: article.title,
          byline: article.byline,
          siteName: article.siteName,
          wordCount: article.wordCount,
          imageCount: article.imageCount,
          linkCount: article.linkCount,
          readingTime,
        },
      })
    } catch (err) {
      set({ mdStatus: 'error', mdError: err instanceof Error ? err.message : String(err) })
    }
  },

  resetMdExport: () =>
    set({ mdStatus: 'idle', mdMarkdown: null, mdHtml: null, mdMeta: null, mdError: null, mdViewMode: 'source' }),

  setMdViewMode: (mode: 'source' | 'preview') => set({ mdViewMode: mode }),

  // ── Screenshot ──
  screenshotStatus: 'idle',
  screenshotProgress: null,
  screenshotResult: null,
  screenshotError: null,

  captureScreenshot: async (tabId: string, mode: ScreenshotMode) => {
    set({ screenshotStatus: 'capturing', screenshotError: null, screenshotResult: null, screenshotProgress: null })

    try {
      const webview = document.querySelector(`webview[data-tab-id="${tabId}"]`) as Electron.WebviewTag | null
      if (!webview) throw new Error('No webview found for this tab')

      const wcId = webview.getWebContentsId()
      const result = (await window.api.capabilityScreenshotCapture(wcId, mode)) as ScreenshotResult
      set({ screenshotResult: result, screenshotStatus: 'done' })
    } catch (err) {
      set({ screenshotError: err instanceof Error ? err.message : String(err), screenshotStatus: 'error' })
    }
  },

  resetScreenshot: () =>
    set({ screenshotStatus: 'idle', screenshotProgress: null, screenshotResult: null, screenshotError: null }),

  setupScreenshotProgressListener: () => {
    return window.api.onScreenshotProgress((data: unknown) => {
      const progress = data as ScreenshotProgress
      set({ screenshotProgress: progress })
      if (progress.status === 'error') {
        set({ screenshotStatus: 'error' })
      }
    })
  },

  // ── Data Extraction ──
  extractionStatus: 'idle',
  extractionResult: null,
  extractionError: null,

  runExtraction: async (tabId: string, description: string, format: 'json' | 'csv', cssSelector?: string) => {
    set({ extractionStatus: 'extracting', extractionError: null, extractionResult: null })

    try {
      const { extractRenderedPage } = await import('../services/page-extractor')
      const page = await extractRenderedPage(tabId)
      if (!page) throw new Error('Could not extract page content')

      const webview = document.querySelector(`webview[data-tab-id="${tabId}"]`) as Electron.WebviewTag | null
      const url = webview?.getURL() || page.url

      const result = (await window.api.capabilityExtractData({
        description,
        pageContent: page.html || '',
        url,
        cssSelector,
        format,
      })) as ExtractionResult

      set({ extractionResult: result, extractionStatus: 'done' })
    } catch (err) {
      set({ extractionError: err instanceof Error ? err.message : String(err), extractionStatus: 'error' })
    }
  },

  exportExtraction: async () => {
    const { extractionResult } = get()
    if (!extractionResult) return

    const defaultName = `extraction.${extractionResult.format}`
    await window.api.capabilityExtractExport(extractionResult.data, extractionResult.format, defaultName)
  },

  resetExtraction: () =>
    set({ extractionStatus: 'idle', extractionResult: null, extractionError: null }),

  // ── Multi-Tab Analysis ──
  multiTabStatus: 'idle',
  multiTabResult: null,
  multiTabError: null,

  runMultiTabAnalysis: async (tabIds: string[], mode: MultiTabAnalysisMode, query?: string) => {
    set({ multiTabStatus: 'analyzing', multiTabError: null, multiTabResult: null })

    try {
      const { extractRenderedPage } = await import('../services/page-extractor')
      const { useTabStore } = await import('./tab-store')
      const tabs = useTabStore.getState().tabs

      const tabData = await Promise.all(
        tabIds.map(async (tabId) => {
          const tab = tabs.find((t) => t.id === tabId)
          let content = ''
          try {
            const page = await extractRenderedPage(tabId)
            content = page?.html || ''
          } catch {
            // ignore
          }
          return {
            id: tabId,
            url: tab?.url || '',
            title: tab?.title || '',
            content: content.replace(/<script[\s\S]*?<\/script>/gi, '')
              .replace(/<style[\s\S]*?<\/style>/gi, '')
              .replace(/<[^>]+>/g, ' ')
              .replace(/\s+/g, ' ')
              .trim(),
          }
        })
      )

      const result = (await window.api.capabilityMultiTabAnalyze({
        mode,
        tabs: tabData,
        query,
      })) as MultiTabResult

      set({ multiTabResult: result, multiTabStatus: 'done' })
    } catch (err) {
      set({ multiTabError: err instanceof Error ? err.message : String(err), multiTabStatus: 'error' })
    }
  },

  resetMultiTab: () =>
    set({ multiTabStatus: 'idle', multiTabResult: null, multiTabError: null }),

  // ── CSS Smart Editor ──
  cssEditorStatus: 'idle',
  cssEditorResult: null,
  cssEditorError: null,

  generateCss: async (selector: string, description: string, pageUrl: string) => {
    set({ cssEditorStatus: 'generating', cssEditorError: null, cssEditorResult: null })

    try {
      const result = (await window.api.capabilityCssGenerate({
        selector,
        description,
        pageUrl,
      })) as CssEditResult

      set({ cssEditorResult: result, cssEditorStatus: 'done' })
    } catch (err) {
      set({ cssEditorError: err instanceof Error ? err.message : String(err), cssEditorStatus: 'error' })
    }
  },

  resetCssEditor: () =>
    set({ cssEditorStatus: 'idle', cssEditorResult: null, cssEditorError: null }),

  // ── Accessibility Audit ──
  a11yStatus: 'idle',
  a11yResult: null,
  a11yError: null,

  runA11yAudit: async (tabId: string) => {
    set({ a11yStatus: 'auditing', a11yError: null, a11yResult: null })

    try {
      const webview = document.querySelector(`webview[data-tab-id="${tabId}"]`) as Electron.WebviewTag | null
      if (!webview) throw new Error('No webview found for this tab')

      const html = await webview.executeJavaScript('document.documentElement.outerHTML') as string
      const result = (await window.api.capabilityA11yAudit(html)) as A11yAuditResult
      set({ a11yResult: result, a11yStatus: 'done' })
    } catch (err) {
      set({ a11yError: err instanceof Error ? err.message : String(err), a11yStatus: 'error' })
    }
  },

  exportA11yReport: async () => {
    const { a11yResult } = get()
    if (!a11yResult) return

    await window.api.capabilityA11yExport(a11yResult, 'accessibility-audit')
  },

  resetA11y: () =>
    set({ a11yStatus: 'idle', a11yResult: null, a11yError: null }),

  // ── Page Monitor ──
  monitoredPages: [],
  monitorChanges: [],
  monitorLoading: false,

  loadMonitoredPages: async () => {
    set({ monitorLoading: true })
    try {
      const pages = (await window.api.monitorList()) as MonitoredPage[]
      set({ monitoredPages: pages, monitorLoading: false })
    } catch {
      set({ monitorLoading: false })
    }
  },

  addMonitoredPage: async (url: string, title: string, checkIntervalMs?: number, selector?: string) => {
    await window.api.monitorAdd({ url, title, checkIntervalMs, selector })
    await get().loadMonitoredPages()
  },

  removeMonitoredPage: async (id: string) => {
    await window.api.monitorRemove(id)
    await get().loadMonitoredPages()
  },

  toggleMonitoredPage: async (id: string) => {
    await window.api.monitorToggle(id)
    await get().loadMonitoredPages()
  },

  loadMonitorHistory: async (monitoredPageId: string) => {
    const changes = (await window.api.monitorHistory(monitoredPageId)) as ChangeRecord[]
    set({ monitorChanges: changes })
  },

  checkNow: async (id: string) => {
    await window.api.monitorCheckNow(id)
    await get().loadMonitoredPages()
  },

  setupMonitorListener: () => {
    return window.api.onMonitorChangeDetected(() => {
      get().loadMonitoredPages()
    })
  },
}))
