import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import { registerBrowserIpc } from './browser.ipc'
import { registerAiIpc } from './ai.ipc'
import { registerAgentIpc } from './agent.ipc'
import { registerResearchIpc } from './research.ipc'
import { registerCapabilityIpc } from './capability.ipc'
import { registerWorkspaceIpc } from './workspace.ipc'
import { registerRecommendationIpc } from './recommendation.ipc'
import { registerContextMenuIpc } from './context-menu.ipc'
import { registerMonitorIpc } from './monitor.ipc'
import { configStore } from '../store/config'
import { modelRouter } from '../services/ai/router-instance'
import { contentFilter } from '../services/privacy/filter-instance'
import { historyService, bookmarkService } from './browser.ipc'
import type { AIProviderConfig } from '../../shared/types'

export { modelRouter }

export function registerIpcHandlers(): void {
  modelRouter.initialize()

  registerBrowserIpc()
  registerAiIpc(modelRouter)
  registerAgentIpc()
  registerResearchIpc(modelRouter)
  registerCapabilityIpc(modelRouter)
  registerWorkspaceIpc()
  registerRecommendationIpc(modelRouter, historyService, bookmarkService)
  registerContextMenuIpc()
  registerMonitorIpc(modelRouter)

  // ── Privacy ──
  let privacyMode = false
  ipcMain.handle(IPC_CHANNELS.PRIVACY_MODE_TOGGLE, async () => {
    privacyMode = !privacyMode
    // Privacy mode forces local-only AI routing (PV-002)
    modelRouter.setLocalOnly(privacyMode)
    return privacyMode
  })

  ipcMain.handle(IPC_CHANNELS.PRIVACY_STATS, async () => {
    const stats = contentFilter.getTotalStats()
    return {
      trackersBlocked: stats.trackersBlocked,
      adsBlocked: stats.adsBlocked,
      requestsSaved: stats.requestsBlocked,
    }
  })

  ipcMain.handle(
    IPC_CHANNELS.PRIVACY_FILTERS_SET,
    async (_event, filters: { blockAds: boolean; blockTrackers: boolean }) => {
      configStore.set('privacy.blockAds', filters.blockAds)
      configStore.set('privacy.blockTrackers', filters.blockTrackers)
      contentFilter.setCategoriesEnabled({
        ads: filters.blockAds,
        trackers: filters.blockTrackers,
        annoyances: true,
      })
      return { success: true }
    }
  )

  // ── Settings ──
  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, async () => {
    return configStore.store
  })

  ipcMain.handle(IPC_CHANNELS.SETTINGS_SET, async (_event, key: string, value: unknown) => {
    configStore.set(key as never, value as never)
    return configStore.get(key as never)
  })

  // ── Cloud Config (legacy backward compat) ──
  ipcMain.handle(IPC_CHANNELS.CLOUD_CONFIG_GET, async () => {
    return modelRouter.getCloudConfig()
  })

  ipcMain.handle(
    IPC_CHANNELS.CLOUD_CONFIG_SET,
    async (
      _event,
      config: { provider: string; apiKey: string; model: string }
    ) => {
      modelRouter.setCloudConfig(config as never)
      return { success: true }
    }
  )

  ipcMain.handle(IPC_CHANNELS.CLOUD_CONFIG_TEST, async () => {
    return modelRouter.testCloudConnection()
  })

  // ── Providers ──
  ipcMain.handle(IPC_CHANNELS.PROVIDERS_CONFIG_GET, async () => {
    return modelRouter.getProvidersConfig()
  })

  ipcMain.handle(
    IPC_CHANNELS.PROVIDERS_CONFIG_SET,
    async (_event, config: AIProviderConfig) => {
      modelRouter.setProvider(config)
      return { success: true }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.PROVIDERS_TEST,
    async (_event, id: string) => {
      return modelRouter.testProvider(id)
    }
  )

  ipcMain.handle(IPC_CHANNELS.PROVIDERS_STATUS, async () => {
    return modelRouter.getAllProviderStatus()
  })

  ipcMain.handle(
    IPC_CHANNELS.PROVIDERS_PRIORITY_SET,
    async (_event, priority: string[]) => {
      modelRouter.setPriority(priority)
      return { success: true }
    }
  )
}
