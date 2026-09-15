import { ipcMain, BrowserWindow } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import { ReadingListService } from '../services/browser/reading-list-service'
import { RecommendationService } from '../services/recommendation/recommendation-service'
import type { HistoryService } from '../services/browser/history-service'
import type { BookmarkService } from '../services/browser/bookmark-service'
import type { ModelRouter } from '../services/ai/router'
import type { ChatMessage } from '../../shared/types'

let recommendationService: RecommendationService | null = null
let readingListService: ReadingListService | null = null

export function registerRecommendationIpc(
  modelRouter: ModelRouter,
  historyService: HistoryService,
  bookmarkService: BookmarkService,
): void {
  readingListService = new ReadingListService()
  recommendationService = new RecommendationService(
    readingListService,
    historyService,
    bookmarkService,
    modelRouter,
  )

  ipcMain.handle(IPC_CHANNELS.RECOMMENDATION_GET, async () => {
    if (!recommendationService) return { recommendations: [], generatedAt: 0, isFromCache: false, interestProfiles: [] }
    return recommendationService.getRecommendations()
  })

  ipcMain.handle(IPC_CHANNELS.RECOMMENDATION_REFRESH, async () => {
    if (!recommendationService) return { recommendations: [], generatedAt: 0, isFromCache: false, interestProfiles: [] }
    const result = recommendationService.refreshRecommendations()

    // Fire background AI analysis and stream results when done
    recommendationService.analyzeInterestsAsync().then((bundle) => {
      if (bundle) {
        const win = BrowserWindow.getAllWindows()[0]
        if (win) {
          win.webContents.send(IPC_CHANNELS.RECOMMENDATION_STREAM, bundle)
        }
      }
    }).catch(() => {})

    return result
  })

  ipcMain.handle(IPC_CHANNELS.READING_LIST_ADD, async (_event, params: { url: string; title: string; excerpt?: string; faviconUrl?: string }) => {
    if (!readingListService) return null
    return readingListService.add(params)
  })

  ipcMain.handle(IPC_CHANNELS.READING_LIST_REMOVE, async (_event, id: number) => {
    if (!readingListService) return false
    return readingListService.remove(id)
  })

  ipcMain.handle(IPC_CHANNELS.READING_LIST_LIST, async (_event, page?: number, perPage?: number) => {
    if (!readingListService) return { entries: [], total: 0 }
    return readingListService.list(page, perPage)
  })

  ipcMain.handle(IPC_CHANNELS.READING_LIST_SEARCH, async (_event, query: string) => {
    if (!readingListService) return []
    return readingListService.search(query)
  })

  ipcMain.handle(IPC_CHANNELS.READING_LIST_SUMMARIZE, async (_event, id: number) => {
    const db = (await import('../store/database')).getDatabase()
    const item = db.prepare('SELECT * FROM reading_list WHERE id = ?').get(id) as { url: string; title: string } | undefined
    if (!item) throw new Error('Reading list item not found')

    try {
      const response = await fetch(item.url, {
        headers: { 'User-Agent': 'WiseWander/1.0' },
      })
      const html = await response.text()
      // Strip tags for plain text
      const text = html.replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()

      const messages: ChatMessage[] = [
        {
          role: 'system',
          content: 'Summarize the following web page content in 2-3 concise sentences. Focus on the main points and key takeaways. Return only the summary text, no formatting.',
        },
        { role: 'user', content: text.slice(0, 30_000) },
      ]

      const summary = await modelRouter.chatSync(messages)
      db.prepare('UPDATE reading_list SET ai_summary = ? WHERE id = ?').run(summary, id)
      return { success: true, summary }
    } catch {
      return { success: false, summary: null, error: 'Failed to generate summary' }
    }
  })
}
