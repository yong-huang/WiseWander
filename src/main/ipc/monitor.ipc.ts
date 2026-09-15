import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import { PageMonitorService } from '../services/capability/page-monitor'
import type { ModelRouter } from '../services/ai/router'

let monitorService: PageMonitorService | null = null

export function registerMonitorIpc(modelRouter: ModelRouter): void {
  monitorService = new PageMonitorService(modelRouter)

  ipcMain.handle(
    IPC_CHANNELS.MONITOR_ADD,
    async (_event, params: { url: string; title: string; checkIntervalMs?: number; selector?: string }) => {
      if (!monitorService) throw new Error('Monitor service not initialized')
      return monitorService.add(params)
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.MONITOR_REMOVE,
    async (_event, id: string) => {
      if (!monitorService) throw new Error('Monitor service not initialized')
      return monitorService.remove(id)
    }
  )

  ipcMain.handle(IPC_CHANNELS.MONITOR_LIST, async () => {
    if (!monitorService) throw new Error('Monitor service not initialized')
    return monitorService.list()
  })

  ipcMain.handle(
    IPC_CHANNELS.MONITOR_TOGGLE,
    async (_event, id: string) => {
      if (!monitorService) throw new Error('Monitor service not initialized')
      return monitorService.toggle(id)
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.MONITOR_HISTORY,
    async (_event, monitoredPageId: string) => {
      if (!monitorService) throw new Error('Monitor service not initialized')
      return monitorService.getHistory(monitoredPageId)
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.MONITOR_CHECK_NOW,
    async (_event, id: string) => {
      if (!monitorService) throw new Error('Monitor service not initialized')
      return monitorService.checkNow(id)
    }
  )
}

export function stopMonitorService(): void {
  monitorService?.stop()
}
