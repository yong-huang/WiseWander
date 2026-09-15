import { BrowserWindow, type DownloadItem, type Session } from 'electron'
import { homedir } from 'os'
import { join } from 'path'
import { configStore } from '../../store/config'
import { IPC_CHANNELS } from '../../../shared/ipc-channels'
import { DownloadService } from './download-service'
import type { DownloadItem as DownloadItemRecord } from '../../../shared/types'

const downloadService = new DownloadService()

/** Electron DownloadItem handles for in-flight downloads, keyed by record id. */
const activeItems = new Map<string, DownloadItem>()

function mainWindow(): BrowserWindow | null {
  const windows = BrowserWindow.getAllWindows()
  return windows.length > 0 ? windows[0] : null
}

/**
 * Wire the session's will-download event to the DownloadService so download
 * records are persisted and progress is streamed to the renderer through
 * the standard IPC channels.
 */
export function registerDownloadHandler(session: Session): void {
  session.on('will-download', (_event, item) => {
    const downloadPath = configStore.get('browser.downloadPath').replace(/^~/, homedir())
    const filename = item.getFilename()
    item.setSavePath(join(downloadPath, filename))

    const record: DownloadItemRecord = downloadService.start({
      url: item.getURLChain()[0] ?? item.getURL(),
      filename,
      savePath: item.getSavePath(),
      totalBytes: item.getTotalBytes(),
    })
    activeItems.set(record.id, item)

    const toPayload = (receivedBytes: number, state: DownloadItemRecord['state']): DownloadItemRecord => ({
      ...record,
      state,
      receivedBytes,
    })

    item.on('updated', (_e, state) => {
      const received = item.getReceivedBytes()
      downloadService.updateProgress(record.id, received)
      mainWindow()?.webContents.send(IPC_CHANNELS.DOWNLOAD_PROGRESS, toPayload(received, 'downloading'))
      if (state === 'interrupted') {
        downloadService.markError(record.id)
      }
    })

    item.on('done', (_e, state) => {
      if (state === 'completed') {
        downloadService.complete(record.id)
      } else if (state === 'cancelled') {
        downloadService.cancel(record.id)
      } else {
        downloadService.markError(record.id)
      }
      activeItems.delete(record.id)
      const finalState: DownloadItemRecord['state'] =
        state === 'completed' ? 'completed' : state === 'cancelled' ? 'cancelled' : 'error'
      mainWindow()?.webContents.send(IPC_CHANNELS.DOWNLOAD_DONE, toPayload(item.getReceivedBytes(), finalState))
    })
  })
}

/**
 * Cancel an in-flight download (interrupts the transfer) and mark its record.
 */
export function cancelActiveDownload(id: string): boolean {
  const item = activeItems.get(id)
  if (!item) return false
  item.cancel()
  return true
}

export function getDownloadService(): DownloadService {
  return downloadService
}
