# WiseWander — Technical Design Document

> Version: 1.1.0
> Last updated: 2026-09-15
> Status: Active (revised in sync with the code)

> **Architecture diagrams (generated with archify, interactive, open in a browser)**
>
> | Diagram | Description |
> |----|------|
> | [System Architecture](diagrams/wisewander-architecture.html) | Three-process model, IPC channels, services, and storage locations |
> | [AI Chat Data Flow](diagrams/wisewander-chat-dataflow.html) | Main path from send to streaming render + the true-abort Stop path |
> | [Agent Execution Sequence](diagrams/wisewander-agent-sequence.html) | Plan → step-by-step execution → progress push → cancel |
>
> Static previews (1440×900): `docs/diagrams/*.visual-check.*.png`

---

## 1. Tech Stack

| Layer | Technology | Version | Purpose |
|------|------|------|------|
| Framework | Electron | 33+ | Desktop app shell |
| Rendering engine | Chromium | (bundled with Electron) | Web page rendering |
| Frontend framework | React | 19+ | UI components |
| Language | TypeScript | 5.7+ | Type safety |
| Build tooling | Vite + electron-vite | Latest | Development and packaging |
| State management | Zustand | 5+ | Lightweight state management |
| Styling | Tailwind CSS | 4+ | Utility-first CSS |
| AI runtime | Ollama | Latest | Local LLM inference |
| Data storage | better-sqlite3 | Latest | Structured data |
| Key-value storage | electron-store | Latest | Configuration and preferences |
| Testing | Vitest + Playwright | Latest | Testing frameworks |

---

## 2. System Architecture

### 2.1 Architecture Overview

![WiseWander system architecture](diagrams/wisewander-architecture.visual-check.1440x900.light.png)

> Interactive version: [wisewander-architecture.html](diagrams/wisewander-architecture.html) (supports theme switching, relation tracing, and per-view focus)

Key points:

- **The page container is a `<webview>` tag inside the Renderer** (`webviewTag: true`, `partition="persist:wisewander"`); the main-process `TabManager` only maintains metadata and a stack of closed tabs
- All cross-process communication goes through the channel constants in `shared/ipc-channels.ts`; streaming data (chat, agent steps, crawler/screenshot progress, download progress) is pushed via `webContents.send`
- The AI layer's `ModelRouter` probes providers per request in `providers` priority order and the first one online serves the request; privacy mode enforces local-only

### 2.2 Process Model

Electron uses a multi-process architecture:

- **Main Process**: the single Node.js process (ESM), responsible for window management, native APIs, AI routing, agent execution, SQLite, and content filtering; page-intensive operations are delegated to the webview guest via `executeJavaScript`
- **Renderer Process**: the Chromium renderer process running the React UI; pages are hosted via `<webview>` tags (not WebContentsView), and navigation/back/forward is invoked by the renderer directly on webview methods
- **Preload Scripts**: the secure bridge layer exposing `window.api` via `contextBridge` (typed wrappers for ~90 channels + streaming subscriptions)

### 2.3 Security Boundary

```
Renderer Process          Preload              Main Process
     │                      │                      │
     │  window.api.xxx()    │                      │
     ├─────────────────────►│  ipcRenderer.invoke  │
     │                      ├─────────────────────►│
     │                      │                      │ Node.js APIs
     │                      │                      │ Ollama HTTP
     │                      │                      │ SQLite
     │                      │  return result       │
     │   result             │◄─────────────────────┤
     │◄─────────────────────┤                      │
```

Key principles:
- The renderer **never** accesses Node.js APIs directly
- All cross-process calls go through the API exposed by the Preload's `contextBridge`
- IPC channels are validated against a whitelist

---

## 3. Directory Structure

```
wisewander/
├── electron.vite.config.ts         # Build configuration
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── tsconfig.web.json
│
├── src/
│   ├── main/                       # Main Process
│   │   ├── index.ts                # Entry point: creates the window, registers IPC
│   │   ├── ipc/                    # IPC handler registration
│   │   │   ├── index.ts
│   │   │   ├── browser.ipc.ts      # Browser-related IPC
│   │   │   ├── ai.ipc.ts           # AI-related IPC
│   │   │   ├── agent.ipc.ts        # Agent-related IPC
│   │   │   ├── capability.ipc.ts   # Capability (crawler/design analysis) IPC
│   │   │   ├── research.ipc.ts     # Research assistant IPC
│   │   │   └── workspace.ipc.ts    # Workspace IPC
│   │   │
│   │   ├── services/               # Main-process services
│   │   │   ├── browser/
│   │   │   │   ├── tab-manager.ts      # Tab lifecycle management
│   │   │   │   ├── bookmark-service.ts # Bookmark CRUD
│   │   │   │   ├── history-service.ts  # History management
│   │   │   │   ├── download-service.ts # Download management
│   │   │   │   └── workspace.ts        # Workspace management
│   │   │   │
│   │   │   ├── ai/
│   │   │   │   ├── ollama-client.ts    # Ollama API client
│   │   │   │   ├── cloud-client.ts     # Cloud AI client
│   │   │   │   ├── router.ts           # AI routing (local/cloud)
│   │   │   │   ├── model-manager.ts    # Model discovery and selection
│   │   │   │   ├── prompt-builder.ts   # Prompt template builder
│   │   │   │   ├── stream-handler.ts   # Streaming response handling
│   │   │   │   └── context-extractor.ts # Page context extraction
│   │   │   │
│   │   │   ├── agent/
│   │   │   │   ├── planner.ts          # Task decomposition and planning
│   │   │   │   ├── executor.ts         # Action execution engine
│   │   │   │   ├── tool-registry.ts    # Agent tool registry
│   │   │   │   └── tools/              # Built-in tool definitions
│   │   │   │       ├── index.ts
│   │   │   │       ├── navigate.ts
│   │   │   │       ├── click.ts
│   │   │   │       ├── type.ts
│   │   │   │       ├── extract.ts
│   │   │   │       ├── scroll.ts
│   │   │   │       ├── wait.ts
│   │   │   │       └── ai-process.ts
│   │   │   │
│   │   │   ├── capability/
│   │   │   │   ├── web-crawler.ts      # Web crawler
│   │   │   │   └── design-analyzer.ts  # Design style analysis
│   │   │   │
│   │   │   ├── research/
│   │   │   │   └── research-engine.ts  # Research assistant engine
│   │   │   │
│   │   │   └── privacy/
│   │   │       ├── content-filter.ts   # Ad/tracker filtering
│   │   │       ├── tracker-detector.ts # Tracker detection
│   │   │       └── fingerprint.ts      # Fingerprint protection
│   │   │
│   │   └── store/                  # Data storage layer
│   │       ├── database.ts             # SQLite initialization and migrations
│   │       └── config.ts               # electron-store configuration
│   │
│   ├── preload/                    # Preload Scripts
│   │   └── index.ts                # Main-window preload + contextBridge
│   │
│   ├── renderer/                   # Renderer Process (React)
│   │   ├── index.html              # HTML entry
│   │   ├── main.tsx                # React entry
│   │   ├── App.tsx                 # Root component
│   │   │
│   │   ├── components/             # UI components
│   │   │   ├── browser/
│   │   │   │   ├── TabBar.tsx          # Tab bar
│   │   │   │   ├── AddressBar.tsx      # Address bar (with navigation buttons)
│   │   │   │   ├── BrowserView.tsx     # WebView container
│   │   │   │   ├── BookmarkBar.tsx     # Bookmark bar
│   │   │   │   └── DownloadBar.tsx     # Download bar
│   │   │   │
│   │   │   ├── ai/
│   │   │   │   ├── AISidebar.tsx       # AI sidebar container
│   │   │   │   ├── ChatPanel.tsx       # Chat panel
│   │   │   │   ├── SummaryPanel.tsx    # Summary panel
│   │   │   │   ├── TranslatePanel.tsx  # Translate panel
│   │   │   │   ├── MessageBubble.tsx   # Message bubble
│   │   │   │   └── StreamingText.tsx   # Streaming text rendering
│   │   │   │
│   │   │   ├── agent/
│   │   │   │   ├── AgentPanel.tsx      # Agent control panel
│   │   │   │   ├── TaskList.tsx        # Task list
│   │   │   │   └── ExecutionLog.tsx    # Execution log
│   │   │   │
│   │   │   ├── capability/
│   │   │   │   ├── CapabilityListPanel.tsx  # Capability list panel
│   │   │   │   ├── DesignAnalyzerPanel.tsx  # Design analysis panel
│   │   │   │   ├── MarkdownExporterPanel.tsx # Markdown export
│   │   │   │   ├── TemplatePreview.tsx      # Template preview
│   │   │   │   └── WebCrawlerPanel.tsx      # Crawler panel
│   │   │   │
│   │   │   ├── research/
│   │   │   │   ├── ResearchPanel.tsx   # Research assistant panel
│   │   │   │   ├── ReportView.tsx      # Report view
│   │   │   │   └── SourceList.tsx      # Source list
│   │   │   │
│   │   │   ├── settings/
│   │   │   │   ├── SettingsPage.tsx    # Settings page
│   │   │   │   ├── ModelConfig.tsx     # Model configuration
│   │   │   │   └── PrivacyConfig.tsx   # Privacy configuration
│   │   │   │
│   │   │   ├── devtools/
│   │   │   │   ├── DevToolsPanel.tsx   # DevTools panel
│   │   │   │   ├── AIPanel.tsx         # AI debug panel
│   │   │   │   ├── ConsolePanel.tsx    # Console panel
│   │   │   │   ├── ElementsPanel.tsx   # Elements panel
│   │   │   │   ├── NetworkPanel.tsx    # Network panel
│   │   │   │   └── StoragePanel.tsx    # Storage panel
│   │   │   │
│   │   │   └── common/
│   │   │       ├── CommandPalette.tsx  # Command palette (Cmd+K)
│   │   │       ├── Tooltip.tsx
│   │   │       └── Modal.tsx
│   │   │
│   │   ├── hooks/                  # React Hooks
│   │   │   └── useTheme.ts             # Theme toggle hook
│   │   │
│   │   ├── services/               # Renderer services
│   │   │   ├── page-extractor.ts       # Page content extraction
│   │   │   ├── readability-extractor.ts # Readability extraction
│   │   │   ├── html-to-markdown.ts     # HTML → Markdown
│   │   │   └── design-style-extractor.ts # Design style extraction
│   │   │
│   │   ├── store/                  # Zustand state management
│   │   │   ├── tab-store.ts           # Tab state
│   │   │   ├── ai-store.ts            # AI chat state
│   │   │   ├── agent-store.ts         # Agent state
│   │   │   ├── capability-store.ts    # Capability state
│   │   │   ├── settings-store.ts      # Settings state
│   │   │   └── devtools-store.ts      # DevTools state
│   │   │
│   │   ├── styles/                 # Global styles
│   │   │   └── globals.css
│   │   │
│   │   └── types/                  # TypeScript types
│   │       └── window.d.ts
│   │
│   └── shared/                     # Shared across processes
│       ├── types.ts                # Shared type definitions
│       ├── constants.ts            # Shared constants
│       └── ipc-channels.ts         # IPC channel names
│
├── docs/                           # Documentation
│   ├── PRD.md
│   ├── DESIGN.md
│   └── TEST.md
│
└── tests/                          # Tests
    ├── unit/
    ├── integration/
    └── e2e/
```

---

## 4. Core Module Design

### 4.1 Browser Core

#### 4.1.1 Tab Management (TabManager)

```typescript
// src/main/services/browser/tab-manager.ts

interface Tab {
  id: string;
  url: string;
  title: string;
  favicon?: string;
  status: 'loading' | 'loaded' | 'error';
  webContentsId: number;
  groupId?: string;
  lastAccessed: number;
}

class TabManager {
  private tabs: Map<string, Tab>;
  private activeTabId: string | null;

  createTab(url?: string): Tab;
  closeTab(id: string): void;
  activateTab(id: string): void;
  reorderTab(id: string, newIndex: number): void;
  getActiveTab(): Tab | null;
  getAllTabs(): Tab[];
}
```

**Implementation notes**:
- Each Tab corresponds to a `<webview>` tag (in the renderer) or a `BrowserView` (in the main process)
- The MVP uses `<webview>` tags — simpler and easier to control
- Tab state is synced to the renderer via IPC

#### 4.1.2 Navigation Control (Navigation)

```typescript
// src/main/services/browser/navigation.ts

class Navigation {
  goBack(tabId: string): void;
  goForward(tabId: string): void;
  reload(tabId: string, ignoreCache?: boolean): void;
  loadURL(tabId: string, url: string): void;
  stopLoading(tabId: string): void;
}
```

#### 4.1.3 Page Context Extraction (ContextExtractor)

```typescript
// src/main/services/ai/context-extractor.ts

interface PageContext {
  url: string;
  title: string;
  textContent: string;        // main text content (denoised)
  headings: Heading[];        // heading structure
  links: Link[];              // link list
  images: Image[];            // images (with alt text)
  tables: Table[];            // table data
  metadata: Record<string, string>;  // meta tag info
  language: string;           // page language
}

class ContextExtractor {
  // Extract page content by injecting JS into the webview
  extractFromWebview(webContentsId: number): Promise<PageContext>;
  // Capture a page screenshot for multimodal use
  captureScreenshot(webContentsId: number): Promise<Buffer>;
}
```

---

### 4.2 AI Service Layer

#### 4.2.1 Ollama Client

```typescript
// src/main/services/ai/ollama-client.ts

interface OllamaConfig {
  baseUrl: string;            // default http://localhost:11434
  defaultModel: string;       // default model name
  timeout: number;            // request timeout in ms
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface StreamChunk {
  done: boolean;
  response: string;
  model: string;
}

class OllamaClient {
  // Health check
  async healthCheck(): Promise<{ status: 'ok' | 'error'; models: Model[] }>;
  // List available models
  async listModels(): Promise<Model[]>;
  // Pull a model
  async pullModel(name: string, onProgress?: (p: number) => void): Promise<void>;
  // Chat (streaming)
  async chat(
    model: string,
    messages: ChatMessage[],
    onChunk: (chunk: StreamChunk) => void
  ): Promise<void>;
  // Generate (one-shot, streaming)
  async generate(
    model: string,
    prompt: string,
    system?: string,
    onChunk: (chunk: StreamChunk) => void
  ): Promise<void>;
}
```

**Ollama API integration**:
- Uses the Ollama REST API (`/api/chat`, `/api/generate`, `/api/tags`)
- Streaming responses are parsed line by line as NDJSON (Newline Delimited JSON)
- Automatic retry on connection failure (up to 3 times with exponential backoff)

#### 4.2.2 Prompt Template System

```typescript
// src/main/services/ai/prompt-builder.ts

interface PromptTemplate {
  id: string;
  name: string;
  system: string;
  user: (context: PageContext, userMessage: string) => string;
}

// Built-in templates
const TEMPLATES: Record<string, PromptTemplate> = {
  chat: {
    id: 'chat',
    name: 'Page Chat',
    system: `You are an intelligent assistant. The user is browsing a web page; answer questions based on the page content.
Rules:
- Base answers on the page content; do not fabricate
- When quoting the original text, indicate where it appears
- If the page content is insufficient to answer, say so honestly`,
    user: (ctx, msg) => `Page title: ${ctx.title}\nPage URL: ${ctx.url}\n\nPage content:\n${ctx.textContent.slice(0, 8000)}\n\nUser question: ${msg}`,
  },
  summary: {
    id: 'summary',
    name: 'Page Summary',
    system: `You are a content summarization expert. Generate a summary of the following web page content.`,
    user: (ctx, _msg) => `Please summarize the following content:\n\n${ctx.textContent.slice(0, 12000)}`,
  },
  translate: {
    id: 'translate',
    name: 'Translate',
    system: `You are a professional translator. Translate the text provided by the user into the target language. Output only the translation, with no explanations.`,
    user: (ctx, msg) => msg,  // translation uses the user's selected text directly
  },
};
```

#### 4.2.3 Streaming Response Handling

```typescript
// src/main/services/ai/stream-handler.ts

class StreamHandler {
  private buffer: string = '';

  // Handle the NDJSON of an Ollama streaming response
  handleNDJSON(line: string): { text: string; done: boolean } {
    const chunk = JSON.parse(line);
    this.buffer += chunk.response;
    return { text: this.buffer, done: chunk.done };
  }

  // Send streaming updates to the renderer via IPC
  async pipeToIPC(
    stream: AsyncIterable<Buffer>,
    channel: string,
    tabId: string
  ): Promise<string> {
    for await (const chunk of stream) {
      const { text, done } = this.handleNDJSON(chunk.toString());
      // Send incremental update
      mainWindow.webContents.send(channel, {
        tabId,
        text,
        delta: chunk.response,
        done,
      });
      if (done) break;
    }
    return this.buffer;
  }
}
```

---

### 4.3 Agent Engine

> **Evolution plan:** the current design is a one-shot planner + fixed executor. The proposal to evolve it into a closed-loop, page-grounded agent (ReAct-style) lives in [AGENT_EVOLUTION.md](AGENT_EVOLUTION.md).

#### 4.3.1 Agent Controller (iterative loop, current design)

Since 2026-09-15 the agent is a closed loop (`AgentController`, `src/main/services/agent/controller.ts`) instead of a one-shot planner:

```
loop (while iterations < budget):
  1. Observe  — PageStateSerializer stamps data-ww-ref ids on interactive
                elements and returns URL/title/scroll/text/element list
  2. Reason   — ModelRouter.chatSync with goal + history digest + last
                observation + compact page view; model must answer with
                ONE JSON object: {"thought", "action", "params"} or
                {"action": "done", "report"}
  3. Validate — JSON repair (json-utils.ts) + tool existence check;
                invalid output is re-prompted (≤ 2 times)
  4. Act      — ToolRegistry.execute against the guest webContents
  5. Emit     — agent:step { thought | action | observation, tabId }
```

Hard budgets (non-negotiable): 15 iterations / 3 minutes / ~160k chars of
cumulative prompt traffic; the AbortController cancels between and during
steps. Page content is framed as untrusted data and never instructions.
Phase 2 safety: identical failing actions are blocked after two attempts;
"done" reports pass a model-run goal self-check (bounded continuations);
off-domain navigation, off-domain links, and risky-click targets (commerce
keywords) pause the loop for user approval via the `agent:confirm` gate
(120s silence = denial; two denials stop the run).
Phase 3 memory: runs and steps persist to `agent_runs`/`agent_steps`
(`AgentRunStore`, `run-store.ts`); successful run traces become per-domain
experience notes in `agent_site_notes`, re-injected as advisory hints on
later runs over the same site. History is browsable in the AgentPanel.

The retired one-shot `planner.ts` was removed; its JSON-repair helpers live
on in `json-utils.ts`. Full proposal and phase history:
[AGENT_EVOLUTION.md](AGENT_EVOLUTION.md).

#### 4.3.2 Tools

Tool signatures live in `src/main/services/agent/tools/*`. `click` and
`type` accept an element `ref` (resolved against the `data-ww-ref`
attributes stamped by the serializer, preferred) or a raw CSS selector
(fallback).

---

## 5. Data Flow and Communication

### 5.1 IPC Communication Design

```typescript
// src/shared/ipc-channels.ts

export const IPC_CHANNELS = {
  // Browser
  TAB_CREATE: 'tab:create',
  TAB_CLOSE: 'tab:close',
  TAB_ACTIVATE: 'tab:activate',
  TAB_UPDATE: 'tab:update',           // Main → Renderer notification
  NAVIGATE: 'browser:navigate',
  NAVIGATION_STATE: 'browser:nav-state',

  // AI
  AI_CHAT_SEND: 'ai:chat:send',
  AI_CHAT_STREAM: 'ai:chat:stream',   // Main → Renderer streaming push
  AI_SUMMARIZE: 'ai:summarize',
  AI_TRANSLATE: 'ai:translate',

  // Ollama
  OLLAMA_STATUS: 'ollama:status',
  OLLAMA_LIST_MODELS: 'ollama:list-models',
  OLLAMA_SET_MODEL: 'ollama:set-model',

  // Agent
  AGENT_EXECUTE: 'agent:execute',
  AGENT_STEP_UPDATE: 'agent:step',    // Main → Renderer step updates

  // Bookmarks/history
  BOOKMARK_ADD: 'bookmark:add',
  BOOKMARK_LIST: 'bookmark:list',
  HISTORY_ADD: 'history:add',
  HISTORY_SEARCH: 'history:search',
} as const;
```

### 5.2 Typical Data Flow — AI Chat

```
User enters "What is this page about?"
         │
         ▼
┌─────────────────┐
│  Renderer (React)│   ChatPanel.onSend()
│  ai-store.dispatch│──► window.api.ai.chatSend(msg, tabId)
└─────────────────┘
         │ IPC: ai:chat:send
         ▼
┌─────────────────┐
│  Preload        │   ipcRenderer.invoke('ai:chat:send', ...)
└─────────────────┘
         │
         ▼
┌─────────────────┐
│  Main Process   │
│  ai.ipc.ts      │──► contextExtractor.extractFromWebview(tabId)
│                 │──► promptBuilder.build('chat', pageContext, userMsg)
│                 │──► ollamaClient.chat(model, messages, onChunk)
└─────────────────┘
         │ IPC: ai:chat:stream (multiple times)
         ▼
┌─────────────────┐
│  Preload        │   ipcRenderer.on('ai:chat:stream', callback)
└─────────────────┘
         │
         ▼
┌─────────────────┐
│  Renderer       │   ai-store.appendChunk(delta)
│  ChatPanel      │──► StreamingText component renders incrementally
└─────────────────┘
```

### 5.3 State Management

Zustand manages UI state within the renderer:

```typescript
// src/renderer/store/ai-store.ts

interface AIState {
  conversations: Map<string, Conversation>;  // tabId → conversation
  isStreaming: boolean;
  currentModel: string;
  ollamaStatus: 'online' | 'offline' | 'checking';

  send: (tabId: string, message: string) => Promise<void>;
  appendChunk: (tabId: string, chunk: string) => void;
  setOllamaStatus: (status: string) => void;
}
```

Persistent data (bookmarks, history, settings) lives in SQLite / electron-store in the main process and is synced to the renderer via IPC.

---

## 6. Ollama Integration

### 6.1 Connection Management

```typescript
// src/main/services/ai/ollama-client.ts

class OllamaClient {
  private baseUrl: string;
  private reconnectTimer: NodeJS.Timer | null = null;

  // Called at startup
  async initialize(config: OllamaConfig): Promise<void> {
    this.baseUrl = config.baseUrl;
    await this.checkConnection();
    this.startHealthPolling();  // check every 30s
  }

  private async checkConnection(): Promise<boolean> {
    try {
      const resp = await fetch(`${this.baseUrl}/api/tags`);
      return resp.ok;
    } catch {
      return false;
    }
  }

  private startHealthPolling(): void {
    this.reconnectTimer = setInterval(async () => {
      const healthy = await this.checkConnection();
      this.notifyStatus(healthy ? 'online' : 'offline');
    }, 30_000);
  }
}
```

### 6.2 Recommended Models

| Use case | Model | Params | Notes |
|------|----------|--------|------|
| General chat | llama3.2 | 3B | Lightweight, fast |
| High-quality chat | qwen2.5 | 7B | Mid-size, good quality |
| Summary/translation | gemma2 | 2B | Focused on text tasks |
| Agent planning | mistral | 7B | Strong reasoning |

The MVP defaults to `llama3.2`; users can switch on their own.

### 6.3 Error Handling

| Scenario | Handling |
|------|----------|
| Ollama not running | UI shows onboarding guidance along with the startup command |
| Model not downloaded | Show a download progress bar and invoke `ollama pull` |
| Request timeout | Prompt a retry and show the timeout reason |
| Insufficient GPU memory | Suggest a smaller model or a shorter context length |
| Interrupted response | Keep the completed portion and mark it as incomplete |

---

## 7. UI/UX Design

### 7.1 Main Window Layout

```
┌──────────────────────────────────────────────────────────────────┐
│ ◉ ◉ ◉  WiseWander                                      ─ □ ×   │
├──────────────────────────────────────────────────────────────────┤
│ ← → 🔄  https://example.com                         ☆ ⬇ ☰    │
├──────────────────────────────────────────────────────────────────┤
│ 📄 Page 1  📄 Page 2  📄 Page 3  ✕                      [+]   │
├──────────────────────────────────────────────┬───────────────────┤
│                                              │  AI Assistant     │
│                                              │                   │
│                                              │  📄 Summary       │
│           Page Content                       │  💬 Chat          │
│           (WebView)                          │  🌐 Translate     │
│                                              │                   │
│                                              │  ┌─────────────┐  │
│                                              │  │ User message │  │
│                                              │  └─────────────┘  │
│                                              │  ┌─────────────┐  │
│                                              │  │ AI response  │  │
│                                              │  │ (streaming)  │  │
│                                              │  └─────────────┘  │
│                                              │                   │
│                                              │  [Type message..] │
└──────────────────────────────────────────────┴───────────────────┘
```

### 7.2 Sidebar Design

- **Position**: right side, resizable by dragging (default 380px)
- **Toggle**: Cmd+Shift+S or the icon in the address bar
- **Tabs**: Summary / Chat / Translate, swipeable
- **Status bar**: shows the current model name and the Ollama connection status

### 7.3 Command Palette (Cmd+K)

```
┌─────────────────────────────────────┐
│ 🔍 Type a command or question...   │
├─────────────────────────────────────┤
│ 📄 Summarize this page              │
│ 🌐 Translate selection              │
│ 🤖 Fill form on this page           │
│ 🔍 Research: [your topic]           │
│ ⚙️ Settings                         │
│ 📑 Bookmarks                        │
│ 📋 History                          │
└─────────────────────────────────────┘
```

### 7.4 Design Guidelines

- **Typography**: SF Pro (macOS native); SF Mono for code
- **Corner radius**: 8px (buttons/cards), 12px (panels/windows)
- **Shadows**: native macOS window effects
- **Animation**: sidebar slides in/out over 200ms ease-in-out; messages render character by character
- **Colors**:
  - Light: white background + gray hierarchy + blue accent
  - Dark: dark-gray background + light-gray hierarchy + blue accent
  - AI-related elements use a purple accent

---

## 8. Data Storage

### 8.1 SQLite (better-sqlite3)

Used for structured data:

```sql
-- Bookmarks
CREATE TABLE bookmarks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  favicon_url TEXT,
  parent_id TEXT,           -- folder hierarchy
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (parent_id) REFERENCES bookmarks(id)
);

-- History
CREATE TABLE history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT NOT NULL,
  title TEXT,
  visit_count INTEGER DEFAULT 1,
  last_visit_time INTEGER NOT NULL
);

-- AI conversation records
-- Chat session persistence (design placeholder, not implemented yet: sessions live only in the renderer's ai-store)
-- CREATE TABLE conversations ( ... );
-- CREATE TABLE messages ( ... );

-- Downloads
CREATE TABLE downloads (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  filename TEXT NOT NULL,
  save_path TEXT NOT NULL,
  state TEXT NOT NULL,      -- 'downloading' | 'completed' | 'cancelled' | 'error'
  total_bytes INTEGER,
  received_bytes INTEGER,
  started_at INTEGER NOT NULL,
  completed_at INTEGER
);
```

**Database location**: `~/Library/Application Support/WiseWander/data.db`

### 8.2 electron-store

Used for key-value configuration data:

```typescript
// Default configuration
const DEFAULT_CONFIG = {
  ollama: {
    baseUrl: 'http://localhost:11434',
    defaultModel: 'llama3.2',
  },
  browser: {
    defaultSearchEngine: 'https://www.google.com/search?q=',
    homePage: 'https://www.google.com',
    downloadPath: '~/Downloads',
  },
  privacy: {
    blockAds: true,
    blockTrackers: true,
    fingerprintProtection: false,
  },
  appearance: {
    theme: 'system',     // 'light' | 'dark' | 'system'
    sidebarWidth: 380,
    showBookmarkBar: true,
  },
  shortcuts: {
    toggleSidebar: 'CommandOrControl+Shift+S',
    commandPalette: 'CommandOrControl+K',
    newTab: 'CommandOrControl+T',
  },
};
```

**Config file location**: `~/Library/Application Support/WiseWander/config.json`

---

## 9. Phased Implementation Roadmap

### Phase 1: Foundation (Week 1-2)

**Goal**: get an Electron + React skeleton running

- [ ] Project scaffolding (electron-vite + React + TypeScript)
- [ ] Main window creation, menu bar
- [ ] WebView container implementation
- [ ] IPC communication foundation
- [ ] Preload security bridge
- [ ] Basic UI layout (TabBar + AddressBar + WebView)

### Phase 2: Browser Core (Week 2-3)

**Goal**: usable core browser features

- [ ] Tab management (create/close/switch/restore)
- [ ] Address bar navigation + autocomplete
- [ ] Bookmark CRUD + bookmark bar
- [ ] History + search
- [ ] Download management
- [ ] Forward/back/reload
- [ ] SQLite data storage layer
- [ ] Keyboard shortcut bindings

### Phase 3: AI Sidebar (Week 3-4)

**Goal**: AI chat capability goes live

- [ ] Ollama client implementation
- [ ] Connection detection + status display
- [ ] Page context extraction
- [ ] Prompt template system
- [ ] Streaming response handling
- [ ] Sidebar UI (ChatPanel)
- [ ] One-click summarization
- [ ] Selection translation
- [ ] Model selection UI

### Phase 4: AI Automation (Week 5-8)

**Goal**: agent capability goes live

- [ ] Tool system framework
- [ ] Built-in tools implementation (navigate, click, type, extract)
- [ ] Task planner (LLM step decomposition)
- [ ] Execution engine
- [ ] Page observer (DOM mutation watching)
- [ ] Agent control panel UI
- [ ] Automatic form filling
- [ ] Bulk data collection

### Phase 5: Research Assistant (Week 9-12)

**Goal**: multi-tab collaborative research

- [ ] Multi-tab information aggregation
- [ ] Information comparison engine
- [ ] Report generation (Markdown output)
- [ ] Source traceability
- [ ] Research session persistence
- [ ] Research assistant panel UI

### Phase 6: Privacy and Polish (Week 13-16)

**Goal**: privacy protection + product polish

- [ ] Private browsing mode
- [ ] Ad/tracker blocking
- [ ] Privacy dashboard
- [ ] Fingerprint protection
- [ ] Command palette (Cmd+K)
- [ ] Theme system
- [ ] Workspace save/restore

### Phase 7: Release Preparation (Week 17-20)

**Goal**: v1.0 release

- [ ] Full testing and bug fixes
- [ ] Performance optimization
- [ ] macOS code signing and notarization
- [ ] Auto-update mechanism
- [ ] User documentation
- [ ] Chrome extension compatibility layer (optional)
- [ ] Cloud model API fallback (optional)

---

## 10. Implementation Revision Log (2026-09-15 Comprehensive Fixes)

Compared with the 1.0.0 design, the key code-vs-doc differences after this consistency pass:

### 10.1 Fixed Defects

| Category | Details |
|------|------|
| Abortability | The AI chat Stop button changed from "only resetting local state" to true abortion with an `AbortSignal` threaded through router→adapter→client→fetch; agents gained `agent:cancel(taskId)` (the channel previously had no handler and could not cancel) |
| Session attribution | `agent:step` events carry `tabId`, fixing the bug where switching tabs mid-execution recorded steps into the wrong session |
| Data integrity | `will-download` is wired to `DownloadService` (download records previously never reached the database); the `download:progress/done` channels are now in `IPC_CHANNELS`; DownloadBar went from an empty shell to a real download list (progress bar/cancel/clear) |
| Page monitoring | `monitored_pages` gained a `last_content_snapshot` column so AI change summaries are based on real old/new snapshots (previously the hash was passed to the LLM as the "old content"); the `page_changes` snapshot column is now written properly |
| Semantic bookmarks | Fixed `embedding-service.ts` importing a nonexistent `OLLAMA_BASE_URL` (the entire semantic search path was broken) |
| Privacy | `privacy:stats` now reports real ContentFilter category statistics; `privacy:filters:set` takes effect immediately; fingerprint protection is hooked into `web-contents-created` (previously an entire class of dead code); privacy mode `privacy:mode:toggle` now genuinely enforces local-only routing (`ModelRouter.setLocalOnly`) |
| Settings persistence | Theme/bookmark-bar toggles unified under the `appearance.*` keys (previously the top-level `theme` was read while `appearance.theme` was written, so settings were lost on restart); all PrivacyConfig toggles persist and take effect immediately |
| AI routing | The `ollama.baseUrl` config now takes effect (applied to the shared client in `buildAdapters`); chat failures invalidate the health cache and fail over (previously the same offline provider was hit repeatedly within 30s); the Anthropic health check became an offline validation (previously every probe was a billable request) |
| Agent | The planner's model is now read lazily (previously frozen at startup); removed the debug leftover that wrote to `/tmp` on every plan |
| Engineering | The `typecheck` script went from a no-op to dual-tsconfig checks (surfacing and fixing 8 pre-existing main-process and 45 renderer type errors); installed ESLint 9 with a new flat config (the lint script previously referenced a nonexistent binary); cleaned up all lint errors |
| Structure | The AI singleton moved to `services/ai/router-instance.ts`, eliminating the service→ipc circular dependency; deleted dead code: `Executor`, `StreamHandler` (+test), `context-extractor`, `Modal.tsx`, the `conversations/messages` tables, unused constants, and the `rehype-raw` dependency; tab restore/reorder is handled by the renderer's recently-closed stack (BR-006) and the main process no longer implements it redundantly |

### 10.2 Known Deviations from the Design Document (Intentional)

- Chat session persistence (conversations/messages tables) remains a design placeholder, not implemented
- The half-finished `capability:multi-tab:stream` streaming API was removed; multi-tab analysis is a single one-shot request
- The Anthropic health check is an offline validation (a configured key counts as online); failures are covered by real-request failover
- Agent planning always uses a direct local Ollama connection (privacy-first) and does not participate in cloud fallback routing
- The build pipeline converts `require()` in source code to `createRequire`, but ESM `import` is still recommended
- The sessionStorage used for `tab-store` persistence may be restored from disk across app instances in Electron (Chromium session directory), so "last session's tabs" can reappear late after a fresh launch; the app's session-restore branch depends on this behavior, and the E2E suite added timing tolerance to tab counts after the empty state

### 10.3 Dead Code Cleanup (Second Full Audit, 2026-09-15)

Cleanup was guided by the principle "every IPC channel must have a real sender and receiver":

| Category | Details |
|------|------|
| Dead IPC endpoints | Removed the four `browser:navigate*` channels and `browser:page-context` (navigation is performed by the renderer calling webview methods directly, and history is recorded via `historyAdd`); removed `tab:restore`/`tab:reorder` (the renderer's recently-closed stack already covers this, and TabManager is now pure metadata); removed the legacy `cloud:config:*` trio (first-run migration logic remains inside the router, and the orphaned `setCloudConfig`/`testCloudConnection` methods were removed along with it); removed `research:report` (`research:execute` already returns the report synchronously) |
| Unused constants | `SIDEBAR_DEFAULT_WIDTH` deleted; `OPENAI_COMPATIBLE_DEFAULT_URL` is now actually referenced by openai-compatible-client |
| Type cleanup | `WebviewContextParams` dropped the no-longer-transmitted `frameType`/`pageEncoding` fields |
| Dependencies | Uninstalled the unreferenced `@faker-js/faker`, `msw`, `@testing-library/react`, `@testing-library/jest-dom` (kept in TEST.md §2.1 as planned-selection notes) |
| Engineering | Installed `electron-builder` to fix `postinstall` (it previously referenced a nonexistent binary; better-sqlite3 is now automatically rebuilt against the Electron ABI after `npm install`) |
| Directories | Deleted 16 empty directories left over from planning (`tests/setup/`, `tests/fixtures/*/`, etc.) plus the `playwright-report/` and `test-results/` build artifacts |
