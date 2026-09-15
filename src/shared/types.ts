// ── Browser ──

export interface Tab {
  id: string
  url: string
  title: string
  favicon?: string
  status: 'loading' | 'loaded' | 'error'
  groupId?: string
  lastAccessed: number
}

export interface Bookmark {
  id: string
  title: string
  url: string
  faviconUrl?: string
  parentId?: string
  createdAt: number
  updatedAt: number
}

export interface HistoryEntry {
  id: number
  url: string
  title: string
  visitCount: number
  lastVisitTime: number
}

export interface DownloadItem {
  id: string
  url: string
  filename: string
  savePath: string
  state: 'downloading' | 'completed' | 'cancelled' | 'error'
  totalBytes: number
  receivedBytes: number
  startedAt: number
  completedAt?: number
}

// ── AI ──

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface Conversation {
  id: string
  tabUrl: string
  model: string
  messages: ChatMessage[]
  createdAt: number
}

export interface PageContext {
  url: string
  title: string
  textContent: string
  headings: Heading[]
  links: Link[]
  images: ImageInfo[]
  tables: TableData[]
  metadata: Record<string, string>
  language: string
}

export interface Heading {
  level: number
  text: string
}

export interface Link {
  text: string
  href: string
}

export interface ImageInfo {
  src: string
  alt: string
}

export interface TableData {
  headers: string[]
  rows: string[][]
}

export interface OllamaModel {
  name: string
  size: number
  modifiedAt: string
}

// ── Agent ──

export interface AgentTask {
  id: string
  description: string
  steps: AgentStep[]
  status: 'planning' | 'executing' | 'completed' | 'failed'
  result?: TaskResult
}

export interface AgentStep {
  id: number
  tool: string
  input: Record<string, unknown>
  output?: unknown
  status: 'pending' | 'running' | 'done' | 'error'
}

export interface TaskResult {
  success: boolean
  data?: unknown
  error?: string
}

export interface ToolParameter {
  name: string
  type: 'string' | 'number' | 'boolean'
  description: string
  required: boolean
}

// ── Capability: Design Analyzer ──

export interface DesignStyleData {
  url: string
  title: string
  cssCustomProperties: Record<string, string>
  colors: {
    primary: string[]
    backgrounds: string[]
    textColors: string[]
  }
  fonts: {
    families: string[]
    sizes: string[]
    weights: string[]
  }
  spacing: {
    margins: string[]
    paddings: string[]
  }
  borders: {
    radii: string[]
    widths: string[]
    colors: string[]
  }
  shadows: {
    box: string[]
    text: string[]
  }
  layout: {
    displayTypes: Record<string, number>
    flexCount: number
    gridCount: number
  }
  buttons: {
    text: string
    backgroundColor: string
    color: string
    borderRadius: string
    padding: string
    fontSize: string
    fontWeight: string
    fontFamily: string
    border: string
    boxShadow: string
  }[]
  tables: {
    borderCollapse: string
    headerBackground: string | null
    headerColor: string | null
  }[]
  forms: {
    tag: string
    borderRadius: string
    border: string
    fontSize: string
    backgroundColor: string
  }[]
  images: {
    count: number
    avgWidth: number
    avgHeight: number
  }
}

export interface DesignAnalysisResult {
  analysis: string
  templateHtml: string
}

// ── Capability: Web Crawler ──

export type CrawlMode = 'images' | 'full-pages'

export interface CrawlConfig {
  startUrl: string
  maxDepth: number
  mode: CrawlMode
  sameDomainOnly: boolean
  maxPages: number
}

export type CrawlStatus = 'idle' | 'running' | 'cancelling' | 'done' | 'error'

export interface CrawlImage {
  src: string
  alt: string
  width?: number
  height?: number
}

export interface CrawlPageResult {
  url: string
  title: string
  depth: number
  images: CrawlImage[]
  html?: string
  links: string[]
  timestamp: number
}

export interface CrawlProgress {
  status: CrawlStatus
  pagesVisited: number
  imagesFound: number
  currentUrl: string
  queueSize: number
  errors: string[]
}

export interface CrawlDryRunResult {
  startPage: { url: string; title: string; imageCount: number; linkCount: number }
  links: Array<{ url: string; title: string }>
  estimatedPages: number
}

export interface CrawlResult {
  pages: CrawlPageResult[]
  totalImages: number
  totalPages: number
  duration: number
  config: CrawlConfig
}

// ── Capability: Markdown Exporter ──

export interface ExtractedArticle {
  title: string
  html: string
  byline: string
  excerpt: string
  siteName: string
  wordCount: number
  imageCount: number
  linkCount: number
}

export interface MarkdownExportMeta {
  title: string
  byline: string
  siteName: string
  wordCount: number
  imageCount: number
  linkCount: number
  readingTime: number // minutes
}

// ── Capability: Screenshot ──

export type ScreenshotMode = 'visible' | 'full-page'

export interface ScreenshotProgress {
  status: 'capturing' | 'stitching' | 'done' | 'error'
  currentSection: number
  totalSections: number
}

export interface ScreenshotResult {
  dataUrl: string
  width: number
  height: number
  mode: ScreenshotMode
}

// ── Context Menu ──

export interface WebviewContextParams {
  tabId: string
  webContentsId: number
  linkURL: string
  mediaType: string          // 'none' | 'image' | 'audio' | 'video'
  srcURL: string
  selectionText: string
  isEditable: boolean
  pageURL: string
  pageTitle: string
  suggestedFilename?: string
  x: number                 // screen coords for Menu.popup()
  y: number
  editFlags: {
    canUndo: boolean; canRedo: boolean; canCut: boolean; canCopy: boolean
    canPaste: boolean; canDelete: boolean; canSelectAll: boolean
  }
}

export type ContextMenuAction =
  | { type: 'open-link-new-tab'; url: string }
  | { type: 'search-selection'; text: string }
  | { type: 'ai-summarize-selection'; text: string }
  | { type: 'ai-translate-selection'; text: string }
  | { type: 'bookmark-page'; title: string; url: string }

// ── Assistant Tools ──

export interface AssistantToolDef {
  name: string
  description: string
  parameters: AssistantToolParam[]
}

export interface AssistantToolParam {
  name: string
  type: 'string' | 'number' | 'boolean'
  description: string
  required: boolean
}

// ── AI Providers ──

export type AIProviderType = 'ollama' | 'openai-compatible' | 'openai' | 'anthropic'

export interface AIProviderConfigBase {
  id: string
  type: AIProviderType
  label: string
  enabled: boolean
}

export interface OllamaProviderConfig extends AIProviderConfigBase {
  type: 'ollama'
  baseUrl: string
  defaultModel: string
}

export interface OpenAICompatibleProviderConfig extends AIProviderConfigBase {
  type: 'openai-compatible'
  baseUrl: string
  apiKey: string
  model: string
}

export interface OpenAIProviderConfig extends AIProviderConfigBase {
  type: 'openai'
  apiKey: string
  model: string
}

export interface AnthropicProviderConfig extends AIProviderConfigBase {
  type: 'anthropic'
  apiKey: string
  model: string
}

export type AIProviderConfig =
  | OllamaProviderConfig
  | OpenAICompatibleProviderConfig
  | OpenAIProviderConfig
  | AnthropicProviderConfig

export interface ProvidersConfig {
  priority: string[] // ordered provider IDs; first online wins
  providers: Record<string, AIProviderConfig>
}

export interface ProviderStatus {
  id: string
  type: AIProviderType
  label: string
  online: boolean
  model: string
  error?: string
}

// ── Recommendation ──

export interface ReadingListItem {
  id: number
  url: string
  title: string
  excerpt?: string
  faviconUrl?: string
  addedAt: number
  sourceUrl?: string
  aiSummary?: string
}

export interface InterestProfile {
  id: number
  label: string
  keywords: string[]
  weight: number
  createdAt: number
  updatedAt: number
  sampleUrls: string[]
}

export type RecommendationCategory = 'history' | 'reading_list' | 'interest'
export type RecommendationSourceType = 'frequency' | 'ai_interest' | 'reading_list_similar'

export interface Recommendation {
  id: number
  category: RecommendationCategory
  title: string
  url: string
  excerpt?: string
  faviconUrl?: string
  sourceType: RecommendationSourceType
  interestLabel?: string
  score: number
  createdAt: number
  expiresAt: number
}

export interface RecommendationBundle {
  recommendations: Recommendation[]
  generatedAt: number
  isFromCache: boolean
  interestProfiles: InterestProfile[]
}

// ── Capability: Structured Data Extraction ──

export interface ExtractionRequest {
  description: string
  pageContent: string
  url: string
  cssSelector?: string
  format: 'json' | 'csv'
}

export interface ExtractionResult {
  data: unknown
  format: 'json' | 'csv'
  rawText: string
}

// ── Capability: Page Monitor ──

export interface MonitoredPage {
  id: string
  url: string
  title: string
  checkIntervalMs: number
  selector?: string
  enabled: boolean
  lastCheckedAt?: number
  lastContentHash?: string
  createdAt: number
}

export interface ChangeRecord {
  id: string
  monitoredPageId: string
  detectedAt: number
  previousHash: string
  newHash: string
  diffSummary?: string
  previousSnapshot?: string
  newSnapshot?: string
}

// ── Capability: Multi-Tab Analysis ──

export type MultiTabAnalysisMode = 'compare' | 'aggregate' | 'contradiction'

export interface MultiTabRequest {
  mode: MultiTabAnalysisMode
  tabs: Array<{ id: string; url: string; title: string; content: string }>
  query?: string
}

export interface MultiTabResult {
  analysis: string
  mode: MultiTabAnalysisMode
  tabCount: number
}

// ── Capability: CSS Smart Editor ──

export interface CssEditRequest {
  selector: string
  description: string
  currentCss?: string
  pageUrl: string
}

export interface CssEditResult {
  css: string
  selector: string
  explanation: string
}

// ── Capability: Accessibility Audit ──

export type A11ySeverity = 'critical' | 'warning' | 'info'

export interface A11yIssue {
  severity: A11ySeverity
  rule: string
  selector: string
  description: string
  suggestion: string
}

export interface A11yAuditResult {
  score: number
  issues: A11yIssue[]
  summary: string
}

// ── Research Workbench ──

export interface ResearchProject {
  id: string
  name: string
  topic: string
  createdAt: number
  updatedAt: number
}

export interface ResearchSource {
  id: string
  projectId: string
  url: string
  title?: string
  snippet?: string
  addedAt: number
}

export interface ResearchNote {
  id: string
  projectId: string
  content: string
  citations: string
  createdAt: number
}
