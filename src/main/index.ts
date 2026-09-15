import { app, BrowserWindow, Menu, session, protocol } from 'electron'
import { join } from 'path'
import { registerIpcHandlers } from './ipc'
import { getDatabase, closeDatabase } from './store/database'
import { contentFilter } from './services/privacy/filter-instance'
import { FingerprintProtection } from './services/privacy/fingerprint'
import { registerDownloadHandler } from './services/browser/download-controller'
import { stopMonitorService } from './ipc/monitor.ipc'
import { configStore } from './store/config'
import { IPC_CHANNELS } from '../shared/ipc-channels'

// Register custom scheme before app.ready (required by Electron for custom protocols)
protocol.registerSchemesAsPrivileged([
  { scheme: 'wisewander', privileges: { standard: true, secure: true, supportFetchAPI: true } },
])

// Workaround: Ollama Metal GPU crash on some macOS versions
// Forces CPU-only inference to avoid Metal initialization failure
if (!process.env.OLLAMA_LLM_LIBRARY) {
  process.env.OLLAMA_LLM_LIBRARY = 'cpu'
}

let mainWindow: BrowserWindow | null = null

export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}

const fingerprintProtection = new FingerprintProtection()

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
    },
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // Application menu — register reload shortcuts at OS level so they work
  // even when a webview has focus (renderer keydown can't reach webview-guest)
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'WiseWander',
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        {
          label: 'Settings…',
          accelerator: 'CmdOrCtrl+,',
          click: () => mainWindow?.webContents.send(IPC_CHANNELS.OPEN_SETTINGS),
        },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click: () => mainWindow?.webContents.send(IPC_CHANNELS.RELOAD_ACTIVE_TAB, false),
        },
        {
          label: 'Force Reload',
          accelerator: 'CmdOrCtrl+Shift+R',
          click: () => mainWindow?.webContents.send(IPC_CHANNELS.RELOAD_ACTIVE_TAB, true),
        },
        { type: 'separator' },
        { role: 'toggleDevTools' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' },
        { role: 'close' },
      ],
    },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

app.whenReady().then(() => {
  app.setAppUserModelId('com.wisewander')

  // Initialize database
  getDatabase()

  // Content filter: always installed; category toggles control what is blocked
  contentFilter.setCategoriesEnabled({
    ads: configStore.get('privacy.blockAds'),
    trackers: configStore.get('privacy.blockTrackers'),
    annoyances: true,
  })
  contentFilter.installSessionFilter(session.defaultSession)

  // Fingerprint protection for webview guests (applies to pages loaded
  // after the setting is enabled; script is idempotent per page)
  app.on('web-contents-created', (_event, contents) => {
    if (contents.getType() !== 'webview') return
    contents.on('did-start-navigation', (_e, _url, isMainFrame) => {
      if (isMainFrame && configStore.get('privacy.fingerprintProtection')) {
        fingerprintProtection.injectFingerprintProtection(contents)
      }
    })
  })

  // Register all IPC handlers
  registerIpcHandlers()

  // Register custom protocol for new tab page
  try {
    protocol.handle('wisewander', (request) => {
      if (request.url === 'wisewander://newtab') {
        return new Response('<html><body></body></html>', {
          headers: { 'content-type': 'text/html' },
        })
      }
      return new Response('Not Found', { status: 404 })
    })
  } catch (err) {
    console.error('Failed to register wisewander protocol:', err)
  }

  // Real file downloads: persist records + stream progress via IPC
  registerDownloadHandler(session.defaultSession)

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('before-quit', () => {
  stopMonitorService()
})

app.on('window-all-closed', () => {
  stopMonitorService()
  closeDatabase()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
