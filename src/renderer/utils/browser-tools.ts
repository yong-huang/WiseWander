import { useTabStore } from '../store/tab-store'
import { extractPageContext } from '../components/browser/BrowserView'
import type { AssistantToolDef } from '../../shared/types'

// ── Helpers ──

function getActiveWebview(): { webview: Electron.WebviewTag; tab: { id: string; url: string; title: string } } | null {
  const { activeTabId, tabs } = useTabStore.getState()
  if (!activeTabId) return null
  const tab = tabs.find(t => t.id === activeTabId)
  if (!tab) return null
  const webview = document.querySelector(`webview[data-tab-id="${activeTabId}"]`) as Electron.WebviewTag | null
  if (!webview) return null
  return { webview, tab }
}

function isInternalPage(): boolean {
  const { activeTabId, tabs } = useTabStore.getState()
  const tab = tabs.find(t => t.id === activeTabId)
  if (!tab) return true
  return tab.url.startsWith('wisewander://') || tab.url.startsWith('about:') || tab.url.startsWith('chrome://')
}

// ── Browser-level Tools (for the browser Assistant panel) ──

export const BROWSER_ASSISTANT_TOOLS: AssistantToolDef[] = [
  // ── Navigation & Tabs ──
  {
    name: 'open_tab',
    description: 'Open a URL in a new browser tab. Use this to navigate to any website.',
    parameters: [
      { name: 'url', type: 'string', description: 'The URL to open', required: true },
    ],
  },
  {
    name: 'open_tabs',
    description: 'Open multiple URLs in new browser tabs at once. Pass an array of URLs.',
    parameters: [
      { name: 'urls', type: 'string', description: 'Comma-separated list of URLs to open', required: true },
    ],
  },
  {
    name: 'navigate_current',
    description: 'Navigate the currently active tab to a URL.',
    parameters: [
      { name: 'url', type: 'string', description: 'The URL to navigate to', required: true },
    ],
  },
  {
    name: 'go_back',
    description: 'Navigate back in the active tab history.',
    parameters: [],
  },
  {
    name: 'go_forward',
    description: 'Navigate forward in the active tab history.',
    parameters: [],
  },
  {
    name: 'reload_page',
    description: 'Reload the currently active page. Set hard to true for a cache-busting reload.',
    parameters: [
      { name: 'hard', type: 'boolean', description: 'If true, reload ignoring cache', required: false },
    ],
  },
  {
    name: 'list_tabs',
    description: 'List all open browser tabs with their titles and URLs.',
    parameters: [],
  },
  {
    name: 'switch_to_tab',
    description: 'Switch to an existing tab that matches a URL or title substring.',
    parameters: [
      { name: 'identifier', type: 'string', description: 'A substring matching the tab URL or title', required: true },
    ],
  },
  {
    name: 'close_tab',
    description: 'Close a tab matching a URL or title substring.',
    parameters: [
      { name: 'identifier', type: 'string', description: 'A substring matching the tab URL or title', required: true },
    ],
  },
  {
    name: 'close_other_tabs',
    description: 'Close all tabs except the currently active one.',
    parameters: [],
  },
  {
    name: 'restore_closed_tab',
    description: 'Reopen the most recently closed tab.',
    parameters: [],
  },
  {
    name: 'search_web',
    description: 'Search the internet using Google. Opens a new tab with search results.',
    parameters: [
      { name: 'query', type: 'string', description: 'The search query', required: true },
    ],
  },

  // ── Bookmarks & History ──
  {
    name: 'bookmark_page',
    description: 'Bookmark (or unbookmark) the currently active page. Toggles the bookmark state.',
    parameters: [],
  },
  {
    name: 'search_bookmarks',
    description: 'Search bookmarks by keyword. Returns matching bookmarks with titles and URLs.',
    parameters: [
      { name: 'query', type: 'string', description: 'The keyword to search bookmarks', required: true },
    ],
  },
  {
    name: 'search_history',
    description: 'Search browsing history by keyword.',
    parameters: [
      { name: 'query', type: 'string', description: 'The keyword to search history', required: true },
    ],
  },
  {
    name: 'list_recent_history',
    description: 'List recent browsing history entries.',
    parameters: [
      { name: 'count', type: 'number', description: 'Number of entries to show (default 10)', required: false },
    ],
  },
  {
    name: 'clear_history',
    description: 'Clear all browsing history.',
    parameters: [],
  },

  // ── Workspaces & Reading ──
  {
    name: 'save_workspace',
    description: 'Save all currently open tabs as a named workspace.',
    parameters: [
      { name: 'name', type: 'string', description: 'Name for the workspace', required: true },
    ],
  },
  {
    name: 'restore_workspace',
    description: 'Restore a previously saved workspace by name.',
    parameters: [
      { name: 'name', type: 'string', description: 'Name of the workspace to restore', required: true },
    ],
  },
  {
    name: 'add_to_reading_list',
    description: 'Save the currently active page to the reading list for later.',
    parameters: [],
  },

  // ── Privacy ──
  {
    name: 'toggle_privacy_mode',
    description: 'Toggle privacy/shield mode on or off.',
    parameters: [],
  },
]

// ── Tab-level Tools (for per-tab Chat panel) ──

export const TAB_CHAT_TOOLS: AssistantToolDef[] = [
  // ── Page Content ──
  {
    name: 'get_active_page',
    description: 'Get the title and a text excerpt from the currently active page.',
    parameters: [],
  },
  {
    name: 'summarize_active',
    description: 'Summarize the content of the currently active page using AI.',
    parameters: [],
  },
  {
    name: 'translate_page',
    description: 'Translate the content of the currently active page to a target language using AI.',
    parameters: [
      { name: 'target_lang', type: 'string', description: 'Target language (e.g. "Chinese", "Japanese", "French")', required: true },
    ],
  },
  {
    name: 'translate_text',
    description: 'Translate specific text to a target language using AI.',
    parameters: [
      { name: 'text', type: 'string', description: 'The text to translate', required: true },
      { name: 'target_lang', type: 'string', description: 'Target language (e.g. "Chinese", "Japanese", "French")', required: true },
    ],
  },
  {
    name: 'extract_links',
    description: 'Extract all links from the currently active page. Returns up to 50 links with text and URL.',
    parameters: [],
  },
  {
    name: 'scroll_page',
    description: 'Scroll the active page to the top or bottom.',
    parameters: [
      { name: 'direction', type: 'string', description: '"top" or "bottom"', required: true },
    ],
  },
  {
    name: 'search_in_page',
    description: 'Search for text within the currently active page. Highlights matches on the page.',
    parameters: [
      { name: 'query', type: 'string', description: 'The text to find on the current page', required: true },
    ],
  },
  {
    name: 'screenshot_page',
    description: 'Take a screenshot of the active page. Mode can be "visible" (default) or "full-page".',
    parameters: [
      { name: 'mode', type: 'string', description: '"visible" or "full-page"', required: false },
    ],
  },
]

/** Tools allowed in tab chat: page content tools + shared navigation tools */
export const TAB_CHAT_TOOL_NAMES = new Set([
  ...TAB_CHAT_TOOLS.map(t => t.name),
  'go_back', 'go_forward', 'reload_page',
])

// ── Parsed Tool Call ──

export interface ParsedToolCall {
  name: string
  args: Record<string, unknown>
  raw: string // original `[TOOL: ...]` marker for replacement
}

// ── Parser ──

const TOOL_REGEX = /\[TOOL:\s*(\w+)\s*(\([^)]*\))?\s*\]/g

export function parseToolCalls(text: string): ParsedToolCall[] {
  const calls: ParsedToolCall[] = []
  let match: RegExpExecArray | null
  const regex = new RegExp(TOOL_REGEX.source, TOOL_REGEX.flags)

  while ((match = regex.exec(text)) !== null) {
    const name = match[1]
    const argsGroup = match[2] ?? ''
    // Strip outer parens, then try JSON parse on the content
    const innerArgs = argsGroup.replace(/^\(|\)$/g, '')
    let args: Record<string, unknown> = {}
    if (innerArgs) {
      try {
        const parsed = JSON.parse(innerArgs)
        // LLM sometimes passes a plain string like "https://example.com" instead of {"url": "..."}
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
          args = parsed as Record<string, unknown>
        } else {
          args = { input: String(parsed) }
        }
      } catch {
        args = { input: innerArgs }
      }
    }
    calls.push({ name, args, raw: match[0] })
  }

  return calls
}

// ── Tool Execution Result ──

export interface ToolResult {
  success: boolean
  display: string
}

// ── Executor ──

export async function executeToolCall(call: ParsedToolCall): Promise<ToolResult> {
  const { name, args } = call

  try {
    switch (name) {
      // ── Navigation & Tabs ──

      case 'open_tab': {
        const url = String(args.url ?? args.input ?? '')
        if (!url) return { success: false, display: 'Error: url is required' }
        await useTabStore.getState().createTab(url.startsWith('http') ? url : `https://${url}`)
        return { success: true, display: `Opened new tab: ${url}` }
      }

      case 'open_tabs': {
        const raw = String(args.urls ?? '')
        const urls = raw.split(',').map((u: string) => u.trim()).filter(Boolean)
        if (urls.length === 0) return { success: false, display: 'Error: urls is required' }
        const results: string[] = []
        for (const u of urls) {
          const url = u.startsWith('http') ? u : `https://${u}`
          await useTabStore.getState().createTab(url)
          results.push(url)
        }
        return { success: true, display: `Opened ${results.length} tabs:\n${results.map((u) => `- ${u}`).join('\n')}` }
      }

      case 'navigate_current': {
        const url = String(args.url ?? args.input ?? '')
        if (!url) return { success: false, display: 'Error: url is required' }
        const { activeTabId, updateTab } = useTabStore.getState()
        if (!activeTabId) return { success: false, display: 'Error: no active tab' }
        updateTab(activeTabId, { url, status: 'loading' })
        return { success: true, display: `Navigated to: ${url}` }
      }

      case 'go_back': {
        const r = getActiveWebview()
        if (!r) return { success: false, display: 'Error: no active tab' }
        r.webview.goBack()
        return { success: true, display: 'Navigated back.' }
      }

      case 'go_forward': {
        const r = getActiveWebview()
        if (!r) return { success: false, display: 'Error: no active tab' }
        r.webview.goForward()
        return { success: true, display: 'Navigated forward.' }
      }

      case 'reload_page': {
        const hard = args.hard === true
        const r = getActiveWebview()
        if (!r) return { success: false, display: 'Error: no active tab' }
        if (hard) {
          r.webview.reloadIgnoringCache()
        } else {
          r.webview.reload()
        }
        return { success: true, display: hard ? 'Reloaded page (ignoring cache).' : 'Reloaded page.' }
      }

      case 'switch_to_tab': {
        const identifier = String(args.identifier ?? args.input ?? '')
        if (!identifier) return { success: false, display: 'Error: identifier is required' }
        const { tabs, activateTab } = useTabStore.getState()
        const match = tabs.find(t =>
          t.url.toLowerCase().includes(identifier.toLowerCase()) ||
          t.title.toLowerCase().includes(identifier.toLowerCase())
        )
        if (!match) return { success: false, display: `No tab found matching "${identifier}"` }
        await activateTab(match.id)
        return { success: true, display: `Switched to: ${match.title || match.url}` }
      }

      case 'restore_closed_tab': {
        const { recentlyClosed, restoreTab } = useTabStore.getState()
        if (recentlyClosed.length === 0) return { success: false, display: 'No recently closed tabs to restore.' }
        const last = recentlyClosed[0]
        await restoreTab(last)
        return { success: true, display: `Restored tab: ${last.title || last.url}` }
      }

      case 'close_tab': {
        const identifier = String(args.identifier ?? args.input ?? '')
        if (!identifier) return { success: false, display: 'Error: identifier is required' }
        const { tabs, closeTab } = useTabStore.getState()
        const match = tabs.find(
          (t) => t.url.toLowerCase().includes(identifier.toLowerCase()) ||
            t.title.toLowerCase().includes(identifier.toLowerCase())
        )
        if (!match) return { success: false, display: `No tab found matching "${identifier}"` }
        await closeTab(match.id)
        return { success: true, display: `Closed tab: ${match.title || match.url}` }
      }

      case 'close_other_tabs': {
        const { tabs, activeTabId, closeTab } = useTabStore.getState()
        const others = tabs.filter(t => t.id !== activeTabId)
        if (others.length === 0) return { success: true, display: 'Only one tab is open.' }
        const closedTitles: string[] = []
        for (const t of others) {
          closedTitles.push(t.title || t.url)
          await closeTab(t.id)
        }
        return { success: true, display: `Closed ${closedTitles.length} tab(s):\n${closedTitles.map(t => `- ${t}`).join('\n')}` }
      }

      case 'list_tabs': {
        const { tabs } = useTabStore.getState()
        if (tabs.length === 0) return { success: true, display: 'No tabs open.' }
        const lines = tabs.map((t, i) => `${i + 1}. **${t.title || t.url}** — ${t.url}`)
        return { success: true, display: lines.join('\n') }
      }

      case 'get_active_page': {
        if (isInternalPage()) return { success: false, display: 'Cannot read content from internal pages. Please navigate to a website first.' }
        const { activeTabId } = useTabStore.getState()
        if (!activeTabId) return { success: false, display: 'Error: no active tab' }
        const ctx = await extractPageContext(activeTabId) as {
          title?: string; textContent?: string; url?: string
        } | null
        if (!ctx) return { success: false, display: 'Could not extract page content' }
        const excerpt = (ctx.textContent ?? '').slice(0, 500)
        return {
          success: true,
          display: `**Title:** ${ctx.title ?? 'Untitled'}\n**URL:** ${ctx.url ?? 'unknown'}\n\n${excerpt}${excerpt.length >= 500 ? '...' : ''}`,
        }
      }

      // ── Bookmarks & History ──

      case 'bookmark_page': {
        const r = getActiveWebview()
        if (!r) return { success: false, display: 'Error: no active tab' }
        const title = r.tab.title || r.tab.url
        const url = r.tab.url
        const result = await window.api.bookmarkAdd(title, url) as { action: 'added' | 'removed' }
        if (result.action === 'removed') {
          // Was already bookmarked — re-add it to keep it bookmarked
          await window.api.bookmarkAdd(title, url)
        }
        window.dispatchEvent(new CustomEvent('bookmark-changed'))
        return { success: true, display: result.action === 'added' ? `Bookmarked: ${title}` : `Already bookmarked: ${title}` }
      }

      case 'search_bookmarks': {
        const query = String(args.query ?? args.input ?? '')
        if (!query) return { success: false, display: 'Error: query is required' }
        const results = await window.api.bookmarkSearch(query) as Array<{ title: string; url: string }>
        if (!results || results.length === 0) return { success: true, display: `No bookmarks found for "${query}".` }
        const lines = results.slice(0, 20).map((b, i) => `${i + 1}. **${b.title}** — ${b.url}`)
        return { success: true, display: `**Bookmarks matching "${query}"** (${results.length}):\n${lines.join('\n')}` }
      }

      case 'search_history': {
        const query = String(args.query ?? args.input ?? '')
        if (!query) return { success: false, display: 'Error: query is required' }
        const results = await window.api.historySearch(query) as Array<{ title: string; url: string; lastVisitTime: number }>
        if (!results || results.length === 0) return { success: true, display: `No history found for "${query}".` }
        const lines = results.slice(0, 20).map((h, i) => `${i + 1}. **${h.title}** — ${h.url}`)
        return { success: true, display: `**History matching "${query}"** (${results.length}):\n${lines.join('\n')}` }
      }

      case 'list_recent_history': {
        const count = Number(args.count) || 10
        const results = await window.api.historyList(1, count) as Array<{ title: string; url: string; lastVisitTime: number }>
        if (!results || results.length === 0) return { success: true, display: 'No browsing history.' }
        const lines = results.map((h, i) => `${i + 1}. **${h.title}** — ${h.url}`)
        return { success: true, display: `**Recent history** (${results.length}):\n${lines.join('\n')}` }
      }

      case 'clear_history': {
        await window.api.historyClear()
        return { success: true, display: 'All browsing history has been cleared.' }
      }

      // ── Content & AI ──

      case 'summarize_active': {
        if (isInternalPage()) return { success: false, display: 'Cannot summarize internal pages. Please navigate to a website first.' }
        const { activeTabId } = useTabStore.getState()
        if (!activeTabId) return { success: false, display: 'Error: no active tab' }
        const result = await window.api.aiSummarize(activeTabId) as { text: string }
        return { success: true, display: result.text ?? 'No summary available' }
      }

      case 'translate_page': {
        if (isInternalPage()) return { success: false, display: 'Cannot translate internal pages. Please navigate to a website first.' }
        const targetLang = String(args.target_lang ?? args.input ?? 'English')
        const r = getActiveWebview()
        if (!r) return { success: false, display: 'Error: no active tab' }
        const ctx = await extractPageContext(r.tab.id) as { textContent?: string } | null
        if (!ctx?.textContent) return { success: false, display: 'Could not extract page content' }
        const text = ctx.textContent.slice(0, 3000)
        const result = await window.api.aiTranslate(text, targetLang) as string
        return { success: true, display: `**Translation (${targetLang}):**\n\n${result}` }
      }

      case 'translate_text': {
        const text = String(args.text ?? '')
        const targetLang = String(args.target_lang ?? 'English')
        if (!text) return { success: false, display: 'Error: text is required' }
        const result = await window.api.aiTranslate(text, targetLang) as string
        return { success: true, display: `**Translation (${targetLang}):**\n\n${result}` }
      }

      case 'extract_links': {
        if (isInternalPage()) return { success: false, display: 'Cannot extract links from internal pages. Please navigate to a website first.' }
        const r = getActiveWebview()
        if (!r) return { success: false, display: 'Error: no active tab' }
        const links = await r.webview.executeJavaScript(`
          Array.from(document.querySelectorAll('a[href]')).slice(0, 50).map(a => ({
            text: a.textContent.trim().slice(0, 80),
            href: a.href
          }))
        `) as { text: string; href: string }[]
        if (!links?.length) return { success: true, display: 'No links found on this page.' }
        const lines = links.map((l, i) => `${i + 1}. [${l.text}](${l.href})`)
        return { success: true, display: `**Links on this page** (${links.length}):\n${lines.join('\n')}` }
      }

      case 'scroll_page': {
        const direction = String(args.direction ?? args.input ?? '').toLowerCase()
        const r = getActiveWebview()
        if (!r) return { success: false, display: 'Error: no active tab' }
        if (direction === 'top') {
          await r.webview.executeJavaScript('window.scrollTo({top: 0, behavior: "smooth"})')
          return { success: true, display: 'Scrolled to top.' }
        } else if (direction === 'bottom') {
          await r.webview.executeJavaScript('window.scrollTo({top: document.body.scrollHeight, behavior: "smooth"})')
          return { success: true, display: 'Scrolled to bottom.' }
        }
        return { success: false, display: 'Error: direction must be "top" or "bottom"' }
      }

      case 'search_in_page': {
        if (isInternalPage()) return { success: false, display: 'Cannot search in internal pages. Please navigate to a website first.' }
        const query = String(args.query ?? args.input ?? '')
        const r = getActiveWebview()
        if (!r) return { success: false, display: 'Error: no active tab' }
        const result = await r.webview.findInPage(query)
        const count = typeof result === 'number' ? result : 0
        return {
          success: true,
          display: count > 0
            ? `Found ${count} match${count > 1 ? 'es' : ''} for "${query}" on the current page.`
            : `No matches found for "${query}" on the current page.`,
        }
      }

      case 'search_web': {
        const query = String(args.query ?? args.input ?? '')
        if (!query) return { success: false, display: 'Error: query is required' }
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`
        await useTabStore.getState().createTab(searchUrl)
        return { success: true, display: `Searched for: "${query}"` }
      }

      // ── Reading & Workspaces ──

      case 'add_to_reading_list': {
        const r = getActiveWebview()
        if (!r) return { success: false, display: 'Error: no active tab' }
        await window.api.readingListAdd({ url: r.tab.url, title: r.tab.title || r.tab.url })
        return { success: true, display: `Added to reading list: ${r.tab.title || r.tab.url}` }
      }

      case 'save_workspace': {
        const name = String(args.name ?? args.input ?? '')
        if (!name) return { success: false, display: 'Error: workspace name is required' }
        await window.api.workspaceSave(name)
        return { success: true, display: `Workspace "${name}" saved.` }
      }

      case 'restore_workspace': {
        const name = String(args.name ?? args.input ?? '')
        if (!name) return { success: false, display: 'Error: workspace name is required' }
        await window.api.workspaceRestore(name)
        return { success: true, display: `Workspace "${name}" restored.` }
      }

      // ── Screenshots & Privacy ──

      case 'screenshot_page': {
        if (isInternalPage()) return { success: false, display: 'Cannot screenshot internal pages. Please navigate to a website first.' }
        const r = getActiveWebview()
        if (!r) return { success: false, display: 'Error: no active tab' }
        const wcId = r.webview.getWebContentsId()
        const mode = String(args.mode ?? 'visible')
        const result = await window.api.capabilityScreenshotCapture(wcId, mode) as { dataUrl: string }
        await window.api.capabilityScreenshotSave(result.dataUrl, r.tab.title || 'screenshot')
        return { success: true, display: `Screenshot saved: ${r.tab.title || 'screenshot'} (${mode})` }
      }

      case 'toggle_privacy_mode': {
        await window.api.privacyModeToggle()
        return { success: true, display: 'Privacy mode toggled.' }
      }

      default:
        return { success: false, display: `Unknown tool: ${name}` }
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return { success: false, display: `Error executing ${name}: ${msg}` }
  }
}

// ── System Prompt Builder ──

export function buildAssistantSystemPrompt(): string {
  return `You are the WiseWander Browser Assistant, an AI assistant built into a desktop browser. You can control the browser by calling tools.

## Available Tools

### Navigation & Tabs
- open_tab(url): Open a URL in a new browser tab
- open_tabs(urls): Open multiple URLs in new tabs (comma-separated)
- navigate_current(url): Navigate the active tab to a URL
- go_back(): Navigate back in the active tab
- go_forward(): Navigate forward in the active tab
- reload_page(hard?): Reload the active page (hard=true ignores cache)
- switch_to_tab(identifier): Switch to a tab matching a URL/title substring
- close_tab(identifier): Close a tab matching a URL/title substring
- close_other_tabs(): Close all tabs except the active one
- list_tabs(): List all open tabs
- restore_closed_tab(): Reopen the most recently closed tab
- search_web(query): Search the internet with Google

### Bookmarks & History
- bookmark_page(): Bookmark the active page
- search_bookmarks(query): Search bookmarks by keyword
- search_history(query): Search browsing history by keyword
- list_recent_history(count?): List recent history entries (default 10)
- clear_history(): Clear all browsing history

### Workspaces & Reading
- save_workspace(name): Save all open tabs as a named workspace
- restore_workspace(name): Restore a saved workspace
- add_to_reading_list(): Save the active page to the reading list

### Privacy
- toggle_privacy_mode(): Toggle privacy/shield mode on or off

## Tool Calling Protocol

To call a tool, include a tool marker in your response using this exact format:
[TOOL: tool_name({"param": "value"})]

You can call multiple tools in a single response. Each tool call will be executed and its result will be shown as a blockquote below your response.

**IMPORTANT: Always include a brief conversational message alongside your tool call.** For example:
- User: "收藏当前页面" → "好的，已为你收藏当前页面。 [TOOL: bookmark_page()]"
- User: "后退" → "好的，正在后退。 [TOOL: go_back()]"
- User: "搜索react" → "正在为你搜索 react。 [TOOL: search_web({"query": "react"})]"
Never respond with ONLY a tool call marker and no text.

## Intent Disambiguation

**Page search vs Web search:**
- "搜索" / "search online" / "google" / "look up" → search_web

**Navigation:**
- "后退" / "回退" / "go back" / "back" → go_back
- "前进" / "go forward" / "forward" → go_forward
- "刷新" / "reload" / "refresh" → reload_page
- "打开" / "open X" → open_tab
- "切换到" / "switch to" / "go to tab" → switch_to_tab (if tab already exists)
- "关闭其他标签" / "close other tabs" → close_other_tabs

**Bookmarks:**
- "收藏" / "bookmark this" / "add bookmark" → bookmark_page
- "搜索书签" / "search bookmarks" → search_bookmarks

**History:**
- "搜索历史" / "search history" → search_history
- "清除历史" / "clear history" → clear_history
- "最近浏览" / "recent history" → list_recent_history

**Other:**
- "保存工作区" / "save workspace" → save_workspace
- "恢复工作区" / "restore workspace" → restore_workspace
- "稍后再读" / "save for later" / "reading list" → add_to_reading_list
- "恢复关闭的标签" / "reopen closed tab" / "undo close" → restore_closed_tab
- "隐私模式" / "privacy mode" / "shield" → toggle_privacy_mode

**Help:**
- "帮助" / "help" / "你能做什么" / "what can you do" → Reply with a summary of all available tools organized by category, in the user's language. List each tool name and a brief description. Do NOT call any tools.

## Usage Guidelines

- **"This page"** always means the currently active tab.
- **Prefer switch_to_tab over open_tab** when the user likely already has the tab open.
- If a URL doesn't start with http:// or https://, prepend https:// automatically.
- You can chain multiple tool calls in one response for multi-step tasks.
- For general questions that don't require browser actions, respond normally without tools.
- Respond in the user's language. Tool names and parameter values must always be in English.
- Always be helpful, concise, and clear.`
}

export function buildTabChatSystemPrompt(pageContext?: string): string {
  const pageContextSection = pageContext
    ? `\n## Current Page Context\n\n${pageContext}\n`
    : ''

  return `You are the WiseWander Page Assistant. You help the user interact with the currently active page. You can navigate the page, summarize, translate, extract links, scroll, search, and take screenshots.
${pageContextSection}
## Available Tools

### Page Navigation
- go_back(): Navigate back in the active tab
- go_forward(): Navigate forward in the active tab
- reload_page(hard?): Reload the active page (hard=true ignores cache)

### Page Content
- get_active_page(): Get title and text excerpt from the active page
- summarize_active(): Summarize the active page using AI
- translate_page(target_lang): Translate the active page to a target language
- translate_text(text, target_lang): Translate specific text
- extract_links(): Extract all links from the active page (up to 50)
- scroll_page(direction): Scroll to "top" or "bottom"
- search_in_page(query): Search for text on the current page
- screenshot_page(mode?): Take a screenshot ("visible" or "full-page", default "visible")

## Tool Calling Protocol

To call a tool, include a tool marker in your response using this exact format:
[TOOL: tool_name({"param": "value"})]

You can call multiple tools in a single response. Each tool call will be executed and its result will be shown as a blockquote below your response.

**IMPORTANT: Always include a brief conversational message alongside your tool call.** For example:
- User: "总结这个页面" → "好的，正在为你总结这个页面。 [TOOL: summarize_active()]"
- User: "后退" → "好的，正在后退。 [TOOL: go_back()]"
- User: "截图" → "好的，正在截图。 [TOOL: screenshot_page()]"
Never respond with ONLY a tool call marker and no text.

## Intent Disambiguation

**Navigation:**
- "后退" / "go back" / "back" → go_back
- "前进" / "go forward" / "forward" → go_forward
- "刷新" / "reload" / "refresh" → reload_page

**Content:**
- "总结" / "summarize" / "总结这个页面" → summarize_active
- "翻译这个页面" / "translate this page" → translate_page
- "翻译" with text / "translate X to Y" → translate_text
- "提取链接" / "extract links" / "get links" → extract_links
- "搜索" / "find on this page" / "search in page" → search_in_page
- "截图" / "screenshot" / "take a screenshot" → screenshot_page
- "滚动到底部" / "scroll to bottom" → scroll_page("bottom")
- "滚动到顶部" / "scroll to top" → scroll_page("top")

**Help:**
- "帮助" / "help" / "你能做什么" / "what can you do" → Reply with a summary of all available tools organized by category, in the user's language. List each tool name and a brief description. Do NOT call any tools.

## Usage Guidelines

- You only have access to page-level tools. For browser-wide actions (open tabs, bookmarks, history, workspaces), tell the user to use the Browser Assistant.
- **"This page"** always means the currently active tab.
- You can chain multiple tool calls in one response for multi-step tasks.
- For general questions that don't require page actions, respond normally without tools.
- Respond in the user's language. Tool names and parameter values must always be in English.
- Always be helpful, concise, and clear.`
}
