import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '../shared/ipc-channels'

const api = {
  // ── Browser: Tabs ──
  tabCreate: (url?: string) => ipcRenderer.invoke(IPC_CHANNELS.TAB_CREATE, url),
  tabClose: (tabId: string) => ipcRenderer.invoke(IPC_CHANNELS.TAB_CLOSE, tabId),
  tabActivate: (tabId: string) => ipcRenderer.invoke(IPC_CHANNELS.TAB_ACTIVATE, tabId),
  tabRestore: () => ipcRenderer.invoke(IPC_CHANNELS.TAB_RESTORE),
  tabReorder: (tabIds: string[]) =>
    ipcRenderer.invoke(IPC_CHANNELS.TAB_REORDER, tabIds),

  // ── Browser: Navigation ──
  navigate: (tabId: string, url: string) => ipcRenderer.invoke(IPC_CHANNELS.NAVIGATE, tabId, url),
  navigateBack: (tabId: string) => ipcRenderer.invoke(IPC_CHANNELS.NAVIGATE_BACK, tabId),
  navigateForward: (tabId: string) => ipcRenderer.invoke(IPC_CHANNELS.NAVIGATE_FORWARD, tabId),
  navigateReload: (tabId: string, ignoreCache?: boolean) =>
    ipcRenderer.invoke(IPC_CHANNELS.NAVIGATE_RELOAD, tabId, ignoreCache),
  onReloadActiveTab: (callback: (ignoreCache: boolean) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, ignoreCache: boolean) => callback(ignoreCache)
    ipcRenderer.on(IPC_CHANNELS.RELOAD_ACTIVE_TAB, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.RELOAD_ACTIVE_TAB, handler)
  },
  onOpenSettings: (callback: () => void) => {
    const handler = () => callback()
    ipcRenderer.on(IPC_CHANNELS.OPEN_SETTINGS, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.OPEN_SETTINGS, handler)
  },

  // ── AI ──
  aiChatSend: (tabId: string, message: string, pageContext?: unknown, templateId?: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.AI_CHAT_SEND, tabId, message, pageContext, templateId),
  aiChatStop: (tabId: string) => ipcRenderer.invoke(IPC_CHANNELS.AI_CHAT_STOP, tabId),
  onChatStream: (
    callback: (data: { tabId: string; text: string; delta: string; done: boolean }) => void
  ) => {
    const handler = (_event: Electron.IpcRendererEvent, data: unknown) => callback(data as never)
    ipcRenderer.on(IPC_CHANNELS.AI_CHAT_STREAM, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.AI_CHAT_STREAM, handler)
  },
  aiSummarize: (tabId: string, pageContext?: unknown, length?: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.AI_SUMMARIZE, tabId, pageContext, length),
  aiTranslate: (text: string, targetLang: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.AI_TRANSLATE, text, targetLang),
  aiSmartTabName: (title: string, content: string, url: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.AI_SMART_TAB_NAME, title, content, url),

  // ── Ollama ──
  ollamaStatus: () => ipcRenderer.invoke(IPC_CHANNELS.OLLAMA_STATUS),
  ollamaListModels: () => ipcRenderer.invoke(IPC_CHANNELS.OLLAMA_LIST_MODELS),
  ollamaSetModel: (model: string) => ipcRenderer.invoke(IPC_CHANNELS.OLLAMA_SET_MODEL, model),
  ollamaPullModel: (name: string) => ipcRenderer.invoke(IPC_CHANNELS.OLLAMA_PULL_MODEL, name),
  onOllamaPullProgress: (
    callback: (data: { name: string; progress: { status: string; total?: number; completed?: number; percent?: number } }) => void
  ) => {
    const handler = (_event: Electron.IpcRendererEvent, data: unknown) => callback(data as never)
    ipcRenderer.on(IPC_CHANNELS.OLLAMA_PULL_PROGRESS, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.OLLAMA_PULL_PROGRESS, handler)
  },

  // ── Agent ──
  agentExecute: (description: string, webContentsId?: number, tabId?: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.AGENT_EXECUTE, description, webContentsId, tabId),
  agentCancel: (taskId?: string) => ipcRenderer.invoke(IPC_CHANNELS.AGENT_CANCEL, taskId),
  onAgentStep: (callback: (data: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: unknown) => callback(data)
    ipcRenderer.on(IPC_CHANNELS.AGENT_STEP_UPDATE, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.AGENT_STEP_UPDATE, handler)
  },

  // ── Bookmarks ──
  bookmarkAdd: (title: string, url: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.BOOKMARK_ADD, title, url),
  bookmarkRemove: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.BOOKMARK_REMOVE, id),
  bookmarkList: () => ipcRenderer.invoke(IPC_CHANNELS.BOOKMARK_LIST),
  bookmarkUpdate: (id: string, fields: unknown) =>
    ipcRenderer.invoke(IPC_CHANNELS.BOOKMARK_UPDATE, id, fields),
  bookmarkSearch: (query: string) => ipcRenderer.invoke(IPC_CHANNELS.BOOKMARK_SEARCH, query),

  // ── History ──
  historyAdd: (url: string, title: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.HISTORY_ADD, url, title),
  historySearch: (query: string) => ipcRenderer.invoke(IPC_CHANNELS.HISTORY_SEARCH, query),
  historyClear: () => ipcRenderer.invoke(IPC_CHANNELS.HISTORY_CLEAR),
  historyList: (page?: number, perPage?: number) =>
    ipcRenderer.invoke(IPC_CHANNELS.HISTORY_LIST, page, perPage),

  // ── Downloads ──
  downloadList: (state?: string) => ipcRenderer.invoke(IPC_CHANNELS.DOWNLOAD_LIST, state),
  downloadCancel: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.DOWNLOAD_CANCEL, id),
  downloadClear: () => ipcRenderer.invoke(IPC_CHANNELS.DOWNLOAD_CLEAR),
  onDownloadProgress: (callback: (data: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: unknown) => callback(data)
    ipcRenderer.on(IPC_CHANNELS.DOWNLOAD_PROGRESS, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.DOWNLOAD_PROGRESS, handler)
  },
  onDownloadDone: (callback: (data: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: unknown) => callback(data)
    ipcRenderer.on(IPC_CHANNELS.DOWNLOAD_DONE, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.DOWNLOAD_DONE, handler)
  },

  // ── Privacy ──
  privacyModeToggle: () => ipcRenderer.invoke(IPC_CHANNELS.PRIVACY_MODE_TOGGLE),
  privacyStats: () => ipcRenderer.invoke(IPC_CHANNELS.PRIVACY_STATS),
  privacyFiltersSet: (filters: { blockAds: boolean; blockTrackers: boolean }) =>
    ipcRenderer.invoke(IPC_CHANNELS.PRIVACY_FILTERS_SET, filters),

  // ── Settings ──
  settingsGet: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET),
  settingsSet: (key: string, value: unknown) =>
    ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SET, key, value),

  // ── Workspace ──
  workspaceSave: (workspaceName: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_SAVE, workspaceName),
  workspaceRestore: (workspaceName: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_RESTORE, workspaceName),
  workspaceList: () => ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_LIST),
  workspaceDelete: (workspaceName: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_DELETE, workspaceName),

  // ── Cloud Config ──
  cloudConfigGet: () => ipcRenderer.invoke(IPC_CHANNELS.CLOUD_CONFIG_GET),
  cloudConfigSet: (config: { provider: string; apiKey: string; model: string }) =>
    ipcRenderer.invoke(IPC_CHANNELS.CLOUD_CONFIG_SET, config),
  cloudConfigTest: () => ipcRenderer.invoke(IPC_CHANNELS.CLOUD_CONFIG_TEST),

  // ── Providers ──
  providersConfigGet: () => ipcRenderer.invoke(IPC_CHANNELS.PROVIDERS_CONFIG_GET),
  providersConfigSet: (config: unknown) => ipcRenderer.invoke(IPC_CHANNELS.PROVIDERS_CONFIG_SET, config),
  providersTest: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.PROVIDERS_TEST, id),
  providersStatus: () => ipcRenderer.invoke(IPC_CHANNELS.PROVIDERS_STATUS),
  providersPrioritySet: (priority: string[]) => ipcRenderer.invoke(IPC_CHANNELS.PROVIDERS_PRIORITY_SET, priority),

  // ── Research ──
  researchExecute: (topic: string, tabUrls: string[]) =>
    ipcRenderer.invoke(IPC_CHANNELS.RESEARCH_EXECUTE, topic, tabUrls),
  researchGetReport: () => ipcRenderer.invoke(IPC_CHANNELS.RESEARCH_REPORT),

  // ── Capability ──
  capabilityAnalyzeDesign: (styleData: unknown) =>
    ipcRenderer.invoke(IPC_CHANNELS.CAPABILITY_ANALYZE_DESIGN, styleData),
  capabilityExportTemplate: (html: string, defaultName: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.CAPABILITY_EXPORT_TEMPLATE, html, defaultName),

  capabilityCrawlStart: (config: unknown, firstPage?: unknown) =>
    ipcRenderer.invoke(IPC_CHANNELS.CAPABILITY_CRAWL_START, config, firstPage),
  capabilityCrawlDryRun: (config: unknown, firstPage?: unknown) =>
    ipcRenderer.invoke(IPC_CHANNELS.CAPABILITY_CRAWL_DRY_RUN, config, firstPage),
  capabilityCrawlCancel: () =>
    ipcRenderer.invoke(IPC_CHANNELS.CAPABILITY_CRAWL_CANCEL),
  onCrawlProgress: (callback: (data: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: unknown) => callback(data)
    ipcRenderer.on(IPC_CHANNELS.CAPABILITY_CRAWL_PROGRESS, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.CAPABILITY_CRAWL_PROGRESS, handler)
  },
  capabilityCrawlExport: (result: unknown) =>
    ipcRenderer.invoke(IPC_CHANNELS.CAPABILITY_CRAWL_EXPORT, result),

  capabilityMdExport: (markdown: string, defaultName: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.CAPABILITY_MD_EXPORT, markdown, defaultName),

  // ── Screenshot ──
  capabilityScreenshotCapture: (wcId: number, mode: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.CAPABILITY_SCREENSHOT_CAPTURE, wcId, mode),
  onScreenshotProgress: (callback: (data: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: unknown) => callback(data)
    ipcRenderer.on(IPC_CHANNELS.CAPABILITY_SCREENSHOT_PROGRESS, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.CAPABILITY_SCREENSHOT_PROGRESS, handler)
  },
  capabilityScreenshotSave: (dataUrl: string, name: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.CAPABILITY_SCREENSHOT_SAVE, dataUrl, name),

  // ── Recommendation ──
  recommendationGet: () => ipcRenderer.invoke(IPC_CHANNELS.RECOMMENDATION_GET),
  recommendationRefresh: () => ipcRenderer.invoke(IPC_CHANNELS.RECOMMENDATION_REFRESH),
  onRecommendationStream: (callback: (data: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: unknown) => callback(data)
    ipcRenderer.on(IPC_CHANNELS.RECOMMENDATION_STREAM, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.RECOMMENDATION_STREAM, handler)
  },

  // ── Context Menu ──
  contextMenuShow: (params: unknown) => ipcRenderer.invoke(IPC_CHANNELS.CONTEXT_MENU_SHOW, params),
  onContextMenuAction: (callback: (data: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: unknown) => callback(data)
    ipcRenderer.on(IPC_CHANNELS.CONTEXT_MENU_ACTION, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.CONTEXT_MENU_ACTION, handler)
  },

  // ── Reading List ──
  readingListAdd: (params: { url: string; title: string; excerpt?: string; faviconUrl?: string }) =>
    ipcRenderer.invoke(IPC_CHANNELS.READING_LIST_ADD, params),
  readingListRemove: (id: number) => ipcRenderer.invoke(IPC_CHANNELS.READING_LIST_REMOVE, id),
  readingListList: (page?: number, perPage?: number) =>
    ipcRenderer.invoke(IPC_CHANNELS.READING_LIST_LIST, page, perPage),
  readingListSearch: (query: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.READING_LIST_SEARCH, query),
  readingListSummarize: (id: number) =>
    ipcRenderer.invoke(IPC_CHANNELS.READING_LIST_SUMMARIZE, id),

  // ── Semantic Bookmark Search ──
  bookmarkSemanticSearch: (query: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.BOOKMARK_SEMANTIC_SEARCH, query),
  bookmarkComputeEmbeddings: () =>
    ipcRenderer.invoke(IPC_CHANNELS.BOOKMARK_COMPUTE_EMBEDDINGS),

  // ── Data Extraction ──
  capabilityExtractData: (request: unknown) =>
    ipcRenderer.invoke(IPC_CHANNELS.CAPABILITY_EXTRACT_DATA, request),
  capabilityExtractExport: (data: unknown, format: string, defaultName: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.CAPABILITY_EXTRACT_EXPORT, data, format, defaultName),

  // ── Multi-Tab Analysis ──
  capabilityMultiTabAnalyze: (request: unknown) =>
    ipcRenderer.invoke(IPC_CHANNELS.CAPABILITY_MULTI_TAB_ANALYZE, request),

  // ── CSS Smart Editor ──
  capabilityCssGenerate: (request: unknown) =>
    ipcRenderer.invoke(IPC_CHANNELS.CAPABILITY_CSS_GENERATE, request),

  // ── Accessibility Audit ──
  capabilityA11yAudit: (html: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.CAPABILITY_A11Y_AUDIT, html),
  capabilityA11yExport: (result: unknown, defaultName: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.CAPABILITY_A11Y_EXPORT, result, defaultName),

  // ── Page Monitor ──
  monitorAdd: (params: { url: string; title: string; checkIntervalMs?: number; selector?: string }) =>
    ipcRenderer.invoke(IPC_CHANNELS.MONITOR_ADD, params),
  monitorRemove: (id: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.MONITOR_REMOVE, id),
  monitorList: () =>
    ipcRenderer.invoke(IPC_CHANNELS.MONITOR_LIST),
  monitorToggle: (id: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.MONITOR_TOGGLE, id),
  monitorHistory: (monitoredPageId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.MONITOR_HISTORY, monitoredPageId),
  monitorCheckNow: (id: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.MONITOR_CHECK_NOW, id),
  onMonitorChangeDetected: (callback: (data: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: unknown) => callback(data)
    ipcRenderer.on(IPC_CHANNELS.MONITOR_CHANGE_DETECTED, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.MONITOR_CHANGE_DETECTED, handler)
  },

  // ── Research Workbench ──
  researchProjectCreate: (name: string, topic: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.RESEARCH_PROJECT_CREATE, name, topic),
  researchProjectList: () =>
    ipcRenderer.invoke(IPC_CHANNELS.RESEARCH_PROJECT_LIST),
  researchProjectGet: (id: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.RESEARCH_PROJECT_GET, id),
  researchProjectDelete: (id: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.RESEARCH_PROJECT_DELETE, id),
  researchSourceAdd: (projectId: string, url: string, title?: string, snippet?: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.RESEARCH_SOURCE_ADD, projectId, url, title, snippet),
  researchSourceRemove: (id: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.RESEARCH_SOURCE_REMOVE, id),
  researchSynthesize: (projectId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.RESEARCH_SYNTHESIZE, projectId),
  researchNotesExport: (projectId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.RESEARCH_NOTES_EXPORT, projectId),
}

export type WindowApi = typeof api

contextBridge.exposeInMainWorld('api', api)
