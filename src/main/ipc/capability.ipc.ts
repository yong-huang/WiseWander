import { ipcMain, dialog, BrowserWindow } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import type { DesignStyleData, CrawlConfig, CrawlResult, CrawlPageResult, CrawlDryRunResult, ScreenshotMode, ScreenshotProgress, ScreenshotResult, ExtractionRequest, ExtractionResult, MultiTabRequest, MultiTabResult, CssEditRequest, CssEditResult, A11yAuditResult } from '../../shared/types'
import { DesignAnalyzer } from '../services/capability/design-analyzer'
import { WebCrawler } from '../services/capability/web-crawler'
import { ScreenshotCapturer } from '../services/capability/screenshot'
import { DataExtractor } from '../services/capability/data-extractor'
import { MultiTabAnalyzer } from '../services/capability/multi-tab-analyzer'
import { CssEditor } from '../services/capability/css-editor'
import { AccessibilityAuditor } from '../services/capability/accessibility-auditor'
import type { ModelRouter } from '../services/ai/router'

let designAnalyzer: DesignAnalyzer | null = null
let activeCrawler: WebCrawler | null = null

export function registerCapabilityIpc(modelRouter: ModelRouter): void {
  designAnalyzer = new DesignAnalyzer(modelRouter)

  ipcMain.handle(
    IPC_CHANNELS.CAPABILITY_ANALYZE_DESIGN,
    async (event, styleData: DesignStyleData) => {
      if (!designAnalyzer) {
        throw new Error('Design analyzer not initialized')
      }
      return designAnalyzer.analyze(styleData)
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.CAPABILITY_EXPORT_TEMPLATE,
    async (event, html: string, defaultName: string) => {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (!win) return { success: false, error: 'No window' }

      const result = await dialog.showSaveDialog(win, {
        defaultPath: path.join(require('os').homedir(), 'Desktop', defaultName),
        filters: [{ name: 'HTML', extensions: ['html'] }],
      })

      if (result.canceled || !result.filePath) return { success: false, error: 'Cancelled' }

      try {
        fs.writeFileSync(result.filePath, html, 'utf-8')
        return { success: true, path: result.filePath }
      } catch (err) {
        return { success: false, error: (err as Error).message }
      }
    }
  )

  // ── Web Crawler ──

  ipcMain.handle(
    IPC_CHANNELS.CAPABILITY_CRAWL_START,
    async (event, config: CrawlConfig, firstPage?: CrawlPageResult) => {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (!win) throw new Error('No window')

      const crawler = new WebCrawler()
      activeCrawler = crawler

      try {
        const result = await crawler.crawl(config, (progress) => {
          win.webContents.send(IPC_CHANNELS.CAPABILITY_CRAWL_PROGRESS, progress)
        }, firstPage)
        return result
      } finally {
        if (activeCrawler === crawler) activeCrawler = null
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.CAPABILITY_CRAWL_DRY_RUN,
    async (_event, config: CrawlConfig, firstPage?: CrawlPageResult): Promise<CrawlDryRunResult> => {
      const crawler = new WebCrawler()
      return crawler.dryRun(config, firstPage)
    }
  )

  ipcMain.handle(IPC_CHANNELS.CAPABILITY_CRAWL_CANCEL, async () => {
    activeCrawler?.cancel()
    return { success: true }
  })

  ipcMain.handle(
    IPC_CHANNELS.CAPABILITY_CRAWL_EXPORT,
    async (event, result: CrawlResult) => {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (!win) return { success: false, error: 'No window' }

      const { canceled, filePaths } = await dialog.showOpenDialog(win, {
        properties: ['createDirectory', 'openDirectory'],
        title: 'Select export folder',
      })
      if (canceled || filePaths.length === 0) return { success: false, error: 'Cancelled' }

      const base = filePaths[0]

      try {
        if (result.config.mode === 'images') {
          const imgDir = path.join(base, 'images')
          fs.mkdirSync(imgDir, { recursive: true })
          let idx = 0
          for (const page of result.pages) {
            for (const img of page.images) {
              try {
                const res = await fetch(img.src, {
                  headers: { 'User-Agent': 'WiseWander-Crawler/1.0' },
                })
                if (!res.ok) continue
                const buf = Buffer.from(await res.arrayBuffer())
                const ext = img.src.split('.').pop()?.split('?')[0] ?? 'jpg'
                fs.writeFileSync(path.join(imgDir, `image_${++idx}.${ext}`), buf)
              } catch {
                // skip failed downloads
              }
            }
          }
        } else {
          const pagesDir = path.join(base, 'pages')
          fs.mkdirSync(pagesDir, { recursive: true })
          let idx = 0
          for (const page of result.pages) {
            if (page.html) {
              // Inject <base> tag so relative URLs (CSS, images) resolve to the original server
              const baseTag = `<base href="${page.url}">`
              let fixedHtml = page.html.replace(/<head([^>]*)>/i, `<head$1>${baseTag}`)
              // Strip <script> tags — they cannot run from file:// and cause JS errors
              fixedHtml = fixedHtml.replace(/<script[\s\S]*?<\/script>/gi, '')
              // Generate a clean filename
              const rawName = page.title.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9\u4e00-\u9fff-]/g, '').slice(0, 80)
              const safeName = rawName || `page_${idx}`
              fs.writeFileSync(path.join(pagesDir, `${safeName}.html`), fixedHtml, 'utf-8')
            }
            idx++
          }
        }
        return { success: true, path: base }
      } catch (err) {
        return { success: false, error: (err as Error).message }
      }
    }
  )

  // ── Markdown Export ──

  ipcMain.handle(
    IPC_CHANNELS.CAPABILITY_MD_EXPORT,
    async (event, markdown: string, defaultName: string) => {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (!win) return { success: false, error: 'No window' }

      const result = await dialog.showSaveDialog(win, {
        defaultPath: path.join(require('os').homedir(), 'Desktop', defaultName),
        filters: [{ name: 'Markdown', extensions: ['md'] }],
      })

      if (result.canceled || !result.filePath) return { success: false, error: 'Cancelled' }

      try {
        fs.writeFileSync(result.filePath, markdown, 'utf-8')
        return { success: true, path: result.filePath }
      } catch (err) {
        return { success: false, error: (err as Error).message }
      }
    }
  )

  // ── Screenshot ──

  ipcMain.handle(
    IPC_CHANNELS.CAPABILITY_SCREENSHOT_CAPTURE,
    async (event, wcId: number, mode: ScreenshotMode): Promise<ScreenshotResult> => {
      const wc = (await import('electron')).webContents.getAllWebContents().find((w) => w.id === wcId)
      if (!wc) throw new Error(`WebContents with id ${wcId} not found`)

      const win = BrowserWindow.fromWebContents(event.sender)
      const capturer = new ScreenshotCapturer()

      const image =
        mode === 'visible'
          ? await capturer.captureVisible(wcId)
          : await capturer.captureFullPage(wcId, (progress: ScreenshotProgress) => {
              win?.webContents.send(IPC_CHANNELS.CAPABILITY_SCREENSHOT_PROGRESS, progress)
            })

      const { width, height } = image.getSize()
      const dataUrl = image.toDataURL()

      return { dataUrl, width, height, mode }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.CAPABILITY_SCREENSHOT_SAVE,
    async (event, dataUrl: string, defaultName: string) => {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (!win) return { success: false, error: 'No window' }

      const result = await dialog.showSaveDialog(win, {
        defaultPath: path.join(require('os').homedir(), 'Desktop', defaultName),
        filters: [{ name: 'PNG Image', extensions: ['png'] }],
      })

      if (result.canceled || !result.filePath) return { success: false, error: 'Cancelled' }

      try {
        const base64 = dataUrl.replace(/^data:image\/png;base64,/, '')
        const buffer = Buffer.from(base64, 'base64')
        fs.writeFileSync(result.filePath, buffer)
        return { success: true, path: result.filePath }
      } catch (err) {
        return { success: false, error: (err as Error).message }
      }
    }
  )

  // ── Data Extraction ──

  const dataExtractor = new DataExtractor(modelRouter)

  ipcMain.handle(
    IPC_CHANNELS.CAPABILITY_EXTRACT_DATA,
    async (_event, request: ExtractionRequest): Promise<ExtractionResult> => {
      return dataExtractor.extract(request)
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.CAPABILITY_EXTRACT_EXPORT,
    async (event, data: unknown, format: string, defaultName: string) => {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (!win) return { success: false, error: 'No window' }

      const ext = format === 'csv' ? 'csv' : 'json'
      const result = await dialog.showSaveDialog(win, {
        defaultPath: path.join(require('os').homedir(), 'Desktop', defaultName),
        filters: [{ name: ext.toUpperCase(), extensions: [ext] }],
      })

      if (result.canceled || !result.filePath) return { success: false, error: 'Cancelled' }

      try {
        const content = typeof data === 'string' ? data : JSON.stringify(data, null, 2)
        fs.writeFileSync(result.filePath, content, 'utf-8')
        return { success: true, path: result.filePath }
      } catch (err) {
        return { success: false, error: (err as Error).message }
      }
    }
  )

  // ── Multi-Tab Analysis ──

  const multiTabAnalyzer = new MultiTabAnalyzer(modelRouter)

  ipcMain.handle(
    IPC_CHANNELS.CAPABILITY_MULTI_TAB_ANALYZE,
    async (_event, request: MultiTabRequest): Promise<MultiTabResult> => {
      return multiTabAnalyzer.analyze(request)
    }
  )

  // ── CSS Smart Editor ──

  const cssEditor = new CssEditor(modelRouter)

  ipcMain.handle(
    IPC_CHANNELS.CAPABILITY_CSS_GENERATE,
    async (_event, request: CssEditRequest): Promise<CssEditResult> => {
      return cssEditor.generate(request)
    }
  )

  // ── Accessibility Audit ──

  const a11yAuditor = new AccessibilityAuditor(modelRouter)

  ipcMain.handle(
    IPC_CHANNELS.CAPABILITY_A11Y_AUDIT,
    async (_event, html: string): Promise<A11yAuditResult> => {
      return a11yAuditor.audit(html)
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.CAPABILITY_A11Y_EXPORT,
    async (event, result: A11yAuditResult, defaultName: string) => {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (!win) return { success: false, error: 'No window' }

      const saveResult = await dialog.showSaveDialog(win, {
        defaultPath: path.join(require('os').homedir(), 'Desktop', defaultName),
        filters: [{ name: 'HTML Report', extensions: ['html'] }, { name: 'Markdown', extensions: ['md'] }],
      })

      if (saveResult.canceled || !saveResult.filePath) return { success: false, error: 'Cancelled' }

      try {
        const ext = path.extname(saveResult.filePath).toLowerCase()
        if (ext === '.md') {
          let report = `# Accessibility Audit Report\n\n**Score:** ${result.score}/100\n\n${result.summary}\n\n## Issues\n\n`
          for (const issue of result.issues) {
            report += `### [${issue.severity.toUpperCase()}] ${issue.rule}\n- **Selector:** \`${issue.selector}\`\n- ${issue.description}\n- **Fix:** ${issue.suggestion}\n\n`
          }
          fs.writeFileSync(saveResult.filePath, report, 'utf-8')
        } else {
          let html = `<!DOCTYPE html><html><head><title>Accessibility Audit</title>
<style>body{font-family:system-ui;max-width:800px;margin:2rem auto;padding:0 1rem}
.score{font-size:3rem;font-weight:bold;text-align:center;margin:1rem 0}
.critical{color:#ef4444}.warning{color:#f59e0b}.info{color:#3b82f6}
.issue{border:1px solid #e5e7eb;border-radius:8px;padding:1rem;margin:0.5rem 0}
.issue-critical{border-left:4px solid #ef4444}.issue-warning{border-left:4px solid #f59e0b}.issue-info{border-left:4px solid #3b82f6}
h2{margin-top:2rem}code{background:#f3f4f6;padding:2px 6px;border-radius:4px}</style></head><body>
<h1>Accessibility Audit</h1><div class="score">${result.score}/100</div><p>${result.summary}</p><h2>Issues (${result.issues.length})</h2>`
          for (const issue of result.issues) {
            html += `<div class="issue issue-${issue.severity}"><strong class="${issue.severity}">[${issue.severity.toUpperCase()}]</strong> ${issue.rule}<br><code>${issue.selector}</code><p>${issue.description}</p><p><strong>Fix:</strong> ${issue.suggestion}</p></div>`
          }
          html += '</body></html>'
          fs.writeFileSync(saveResult.filePath, html, 'utf-8')
        }
        return { success: true, path: saveResult.filePath }
      } catch (err) {
        return { success: false, error: (err as Error).message }
      }
    }
  )
}
