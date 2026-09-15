import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import { WorkspaceService } from '../services/browser/workspace'
import { tabManager } from './browser.ipc'

const workspaceService = new WorkspaceService()

export { workspaceService }

export function registerWorkspaceIpc(): void {
  ipcMain.handle(
    IPC_CHANNELS.WORKSPACE_SAVE,
    async (_event, workspaceName: string) => {
      const tabs = tabManager.getAllTabs()
      workspaceService.save(workspaceName, tabs)
      return { success: true, tabCount: tabs.length }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.WORKSPACE_RESTORE,
    async (_event, workspaceName: string) => {
      return workspaceService.restore(workspaceName)
    }
  )

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_LIST, async () => {
    return workspaceService.list()
  })

  ipcMain.handle(
    IPC_CHANNELS.WORKSPACE_DELETE,
    async (_event, workspaceName: string) => {
      return workspaceService.delete(workspaceName)
    }
  )
}
