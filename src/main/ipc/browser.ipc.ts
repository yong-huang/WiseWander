import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import { TabManager } from '../services/browser/tab-manager'
import { BookmarkService } from '../services/browser/bookmark-service'
import { HistoryService } from '../services/browser/history-service'
import { DownloadService } from '../services/browser/download-service'
import { cancelActiveDownload } from '../services/browser/download-controller'
import type { Tab } from '../../shared/types'

const tabManager = new TabManager()
const bookmarkService = new BookmarkService()
const historyService = new HistoryService()
const downloadService = new DownloadService()

export { tabManager, bookmarkService, historyService, downloadService }

export function registerBrowserIpc(): void {
  // ── Tabs ──
  ipcMain.handle(IPC_CHANNELS.TAB_CREATE, async (_event, url?: string): Promise<Tab> => {
    return tabManager.createTab(url)
  })

  ipcMain.handle(IPC_CHANNELS.TAB_CLOSE, async (_event, tabId: string) => {
    tabManager.closeTab(tabId)
  })

  ipcMain.handle(IPC_CHANNELS.TAB_ACTIVATE, async (_event, tabId: string) => {
    tabManager.activateTab(tabId)
    return tabManager.getTab(tabId)
  })

  // ── Bookmarks ──
  ipcMain.handle(IPC_CHANNELS.BOOKMARK_ADD, async (_event, title: string, url: string) => {
    return bookmarkService.toggle({ title, url })
  })

  ipcMain.handle(IPC_CHANNELS.BOOKMARK_REMOVE, async (_event, id: string) => {
    return bookmarkService.remove(id)
  })

  ipcMain.handle(IPC_CHANNELS.BOOKMARK_LIST, async () => {
    return bookmarkService.list()
  })

  ipcMain.handle(IPC_CHANNELS.BOOKMARK_UPDATE, async (_event, id: string, fields: Parameters<typeof bookmarkService.update>[1]) => {
    return bookmarkService.update(id, fields)
  })

  ipcMain.handle(IPC_CHANNELS.BOOKMARK_SEARCH, async (_event, query: string) => {
    return bookmarkService.search(query)
  })

  // ── Semantic Bookmark Search ──
  ipcMain.handle(IPC_CHANNELS.BOOKMARK_SEMANTIC_SEARCH, async (_event, query: string) => {
    return bookmarkService.semanticSearch(query)
  })

  ipcMain.handle(IPC_CHANNELS.BOOKMARK_COMPUTE_EMBEDDINGS, async () => {
    return bookmarkService.computeEmbeddings()
  })

  // ── History ──
  ipcMain.handle(IPC_CHANNELS.HISTORY_ADD, async (_event, url: string, title: string) => {
    return historyService.add({ url, title })
  })

  ipcMain.handle(IPC_CHANNELS.HISTORY_SEARCH, async (_event, query: string) => {
    return historyService.search(query)
  })

  ipcMain.handle(IPC_CHANNELS.HISTORY_CLEAR, async () => {
    return historyService.clear()
  })

  ipcMain.handle(IPC_CHANNELS.HISTORY_LIST, async (_event, page?: number, perPage?: number) => {
    return historyService.list(page, perPage)
  })

  // ── Downloads ──
  ipcMain.handle(IPC_CHANNELS.DOWNLOAD_LIST, async (_event, state?: string) => {
    return downloadService.list(state as 'downloading' | 'completed' | 'cancelled' | 'error' | undefined)
  })

  ipcMain.handle(IPC_CHANNELS.DOWNLOAD_CANCEL, async (_event, id: string) => {
    // Interrupt the in-flight transfer first; its 'done' handler updates the record
    cancelActiveDownload(id)
    return downloadService.cancel(id)
  })

  ipcMain.handle(IPC_CHANNELS.DOWNLOAD_CLEAR, async () => {
    return downloadService.clear()
  })
}
