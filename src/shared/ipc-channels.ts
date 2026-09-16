export const IPC_CHANNELS = {
  // Browser
  TAB_CREATE: 'tab:create',
  TAB_CLOSE: 'tab:close',
  TAB_ACTIVATE: 'tab:activate',
  RELOAD_ACTIVE_TAB: 'main:reload-active-tab',
  OPEN_SETTINGS: 'main:open-settings',

  // AI
  AI_CHAT_SEND: 'ai:chat:send',
  AI_CHAT_STREAM: 'ai:chat:stream',
  AI_CHAT_STOP: 'ai:chat:stop',
  AI_SUMMARIZE: 'ai:summarize',
  AI_TRANSLATE: 'ai:translate',
  AI_SMART_TAB_NAME: 'ai:smart-tab-name',

  // Ollama
  OLLAMA_STATUS: 'ollama:status',
  OLLAMA_LIST_MODELS: 'ollama:list-models',
  OLLAMA_SET_MODEL: 'ollama:set-model',
  OLLAMA_PULL_MODEL: 'ollama:pull-model',
  OLLAMA_PULL_PROGRESS: 'ollama:pull:progress',

  // Agent
  AGENT_EXECUTE: 'agent:execute',
  AGENT_STEP_UPDATE: 'agent:step',
  AGENT_CANCEL: 'agent:cancel',
  AGENT_CONFIRM: 'agent:confirm',
  AGENT_ANSWER: 'agent:answer',
  AGENT_OPEN_TAB: 'agent:open-tab',
  AGENT_HISTORY_LIST: 'agent:history:list',
  AGENT_HISTORY_GET: 'agent:history:get',

  // Bookmarks
  BOOKMARK_ADD: 'bookmark:add',
  BOOKMARK_REMOVE: 'bookmark:remove',
  BOOKMARK_LIST: 'bookmark:list',
  BOOKMARK_UPDATE: 'bookmark:update',
  BOOKMARK_SEARCH: 'bookmark:search',

  // History
  HISTORY_ADD: 'history:add',
  HISTORY_SEARCH: 'history:search',
  HISTORY_CLEAR: 'history:clear',
  HISTORY_LIST: 'history:list',

  // Downloads
  DOWNLOAD_LIST: 'download:list',
  DOWNLOAD_CANCEL: 'download:cancel',
  DOWNLOAD_CLEAR: 'download:clear',
  DOWNLOAD_PROGRESS: 'download:progress',
  DOWNLOAD_DONE: 'download:done',

  // Privacy
  PRIVACY_MODE_TOGGLE: 'privacy:mode:toggle',
  PRIVACY_STATS: 'privacy:stats',
  PRIVACY_FILTERS_SET: 'privacy:filters:set',

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',

  // Workspace
  WORKSPACE_SAVE: 'workspace:save',
  WORKSPACE_RESTORE: 'workspace:restore',
  WORKSPACE_LIST: 'workspace:list',
  WORKSPACE_DELETE: 'workspace:delete',

  // Providers
  PROVIDERS_CONFIG_GET: 'providers:config:get',
  PROVIDERS_CONFIG_SET: 'providers:config:set',
  PROVIDERS_TEST: 'providers:test',
  PROVIDERS_STATUS: 'providers:status',
  PROVIDERS_PRIORITY_SET: 'providers:priority:set',

  // Research

  // Capability
  CAPABILITY_ANALYZE_DESIGN: 'capability:analyze-design',
  CAPABILITY_EXPORT_TEMPLATE: 'capability:export-template',
  CAPABILITY_CRAWL_START: 'capability:crawl:start',
  CAPABILITY_CRAWL_DRY_RUN: 'capability:crawl:dry-run',
  CAPABILITY_CRAWL_CANCEL: 'capability:crawl:cancel',
  CAPABILITY_CRAWL_PROGRESS: 'capability:crawl:progress',
  CAPABILITY_CRAWL_EXPORT: 'capability:crawl:export',
  CAPABILITY_MD_EXPORT: 'capability:md-export',

  // Screenshot
  CAPABILITY_SCREENSHOT_CAPTURE: 'capability:screenshot:capture',
  CAPABILITY_SCREENSHOT_PROGRESS: 'capability:screenshot:progress',
  CAPABILITY_SCREENSHOT_SAVE: 'capability:screenshot:save',

  // Recommendation
  RECOMMENDATION_GET: 'recommendation:get',
  RECOMMENDATION_REFRESH: 'recommendation:refresh',
  RECOMMENDATION_STREAM: 'recommendation:stream',

  // Context Menu
  CONTEXT_MENU_SHOW: 'context-menu:show',
  CONTEXT_MENU_ACTION: 'context-menu:action',

  // Reading List
  READING_LIST_ADD: 'reading-list:add',
  READING_LIST_REMOVE: 'reading-list:remove',
  READING_LIST_LIST: 'reading-list:list',
  READING_LIST_SEARCH: 'reading-list:search',
  READING_LIST_SUMMARIZE: 'reading-list:summarize',

  // Semantic Bookmark Search
  BOOKMARK_SEMANTIC_SEARCH: 'bookmark:semantic-search',
  BOOKMARK_COMPUTE_EMBEDDINGS: 'bookmark:compute-embeddings',

  // Data Extraction
  CAPABILITY_EXTRACT_DATA: 'capability:extract-data',
  CAPABILITY_EXTRACT_EXPORT: 'capability:extract-export',

  // Multi-Tab Analysis
  CAPABILITY_MULTI_TAB_ANALYZE: 'capability:multi-tab:analyze',

  // CSS Smart Editor
  CAPABILITY_CSS_GENERATE: 'capability:css:generate',

  // Accessibility Audit
  CAPABILITY_A11Y_AUDIT: 'capability:a11y:audit',
  CAPABILITY_A11Y_EXPORT: 'capability:a11y:export',

  // Page Monitor
  MONITOR_ADD: 'monitor:add',
  MONITOR_REMOVE: 'monitor:remove',
  MONITOR_LIST: 'monitor:list',
  MONITOR_TOGGLE: 'monitor:toggle',
  MONITOR_HISTORY: 'monitor:history',
  MONITOR_CHECK_NOW: 'monitor:check-now',
  MONITOR_CHANGE_DETECTED: 'monitor:change-detected',

  RESEARCH_EXECUTE: 'research:execute',

  // Research Workbench
  RESEARCH_PROJECT_CREATE: 'research:project:create',
  RESEARCH_PROJECT_LIST: 'research:project:list',
  RESEARCH_PROJECT_GET: 'research:project:get',
  RESEARCH_PROJECT_DELETE: 'research:project:delete',
  RESEARCH_SOURCE_ADD: 'research:source:add',
  RESEARCH_SOURCE_REMOVE: 'research:source:remove',
  RESEARCH_SYNTHESIZE: 'research:synthesize',
  RESEARCH_NOTES_EXPORT: 'research:notes:export',
} as const

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS]
