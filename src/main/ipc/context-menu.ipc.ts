import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-channels.js'
import { getMainWindow } from '../index.js'
import { buildWebviewContextMenu } from '../services/context-menu/context-menu-builder.js'

export function registerContextMenuIpc(): void {
  ipcMain.handle(IPC_CHANNELS.CONTEXT_MENU_SHOW, async (_event, params: unknown) => {
    const win = getMainWindow()
    if (!win) return

    const menu = buildWebviewContextMenu(params as Parameters<typeof buildWebviewContextMenu>[0], win.webContents)
    menu.popup({ window: win, x: (params as { x: number }).x, y: (params as { y: number }).y })
  })
}
