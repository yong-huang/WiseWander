# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

WiseWander is an AI-native desktop browser built with Electron + React 19. It routes chat through a priority-ordered provider list (local Ollama first, cloud fallback), and exposes AI capabilities (dual assistants, summarize, translate, automation agents, research, web crawling, screenshots, page monitoring, accessibility audits, design analysis) as first-class browser features. All user data stays local (SQLite + electron-store).

## Commands

```bash
npm run dev                    # Start dev server (electron-vite)
npm run build                  # Production build
npm run lint                   # ESLint 9 (flat config in eslint.config.js)
npm run typecheck              # tsc --noEmit for BOTH tsconfig.node.json and tsconfig.web.json

npm run test:unit              # Unit tests (vitest, node env)
npm run test:unit:watch        # Unit tests in watch mode
npm run test:unit:coverage     # Unit tests with v8 coverage
npm run test:integration       # Integration tests (vitest, jsdom env)
npm run test:e2e               # E2E tests (Playwright, needs a prior `npm run build` and local Ollama)

# Run a single test file
npx vitest run tests/unit/main/services/ai/prompt-builder.test.ts
npx vitest run --config vitest.config.integration.ts tests/integration/html-to-markdown.test.ts
```

Note: `typecheck` runs both project configs explicitly. The root `tsconfig.json` has `files: []` with `references`, so a bare `tsc --noEmit` checks nothing.

## Architecture

Interactive diagrams (generated with archify, open in a browser):

- `docs/diagrams/wisewander-architecture.html` — system architecture (processes, IPC, services, storage)
- `docs/diagrams/wisewander-chat-dataflow.html` — AI chat streaming data flow incl. the Stop/abort path
- `docs/diagrams/wisewander-agent-sequence.html` — agent task execution sequence incl. cancellation

### Electron Process Model

- **Main process** (`src/main/`): IPC handlers, services, SQLite, Ollama/cloud AI communication
- **Preload** (`src/preload/index.ts`): context bridge exposing `window.api` as typed IPC wrapper
- **Renderer** (`src/renderer/`): React 19 UI with Zustand stores and Tailwind CSS 4

**Pages live in renderer-side `<webview>` tags** (`webviewTag: true`, `partition="persist:wisewander"`), not in WebContentsView. Consequences:

- The main-process `TabManager` (`src/main/services/browser/tab-manager.ts`) only tracks metadata. Tab restore/reorder are implemented renderer-side (`tab-store` keeps a recently-closed stack); there are no main-process IPC endpoints for them.
- Navigation/back/forward/reload are driven by the renderer calling webview methods directly; there are no IPC endpoints for them (history recording happens via `historyAdd` in the renderer's URL-update handler).
- Agent tools reach the page through `webContents.fromId(webContentsId)` + `loadURL`/`executeJavaScript` — a second, main-process path that coexists with renderer-side webview calls.

### Data Flow

```
Renderer (React)  →  window.api.* (preload)  →  ipcMain.handle (main)  →  Services
Renderer (React)  ←  ipcRenderer.on          ←  webContents.send       ←  Services (streaming)
```

All channels are constants in `src/shared/ipc-channels.ts` (~90 channels). Streaming events: `ai:chat:stream`, `agent:step`, `capability:crawl:progress`, `capability:screenshot:progress`, `ollama:pull:progress`, `download:progress`, `download:done`, `recommendation:stream`, `monitor:change-detected`, `context-menu:action`, `main:reload-active-tab`, `main:open-settings`.

### AI Provider Routing (`src/main/services/ai/`)

- `router.ts` — `ModelRouter` reads the `providers` key from electron-store: `ProvidersConfig { priority: string[]; providers: Record<id, AIProviderConfig> }`. Per request it walks the priority list and uses the **first provider whose health check is online** (status cache TTL 30s). If a real chat call fails, that provider's cache entry is invalidated and the next provider is tried.
- `provider.ts` — adapter factory; four adapter types: `ollama`, `openai-compatible`, `openai`, `anthropic`. Anthropic health checks are offline (configured key ⇒ online) because any real probe is a billed request.
- All chat paths accept an optional `AbortSignal`; `ai:chat:stop` aborts the in-flight HTTP request per tab (`activeStreams` map in `ai.ipc.ts`). This is what the Stop button calls — it is a real abort, not a UI-only flag.
- `router-instance.ts` — process-wide singletons (`ollamaClient`, `cloudClient`, `modelRouter`). Services import from here; importing the router from `ipc/` would create a services → ipc cycle.
- `router.initialize()` migrates legacy config (`ollama.*`, `cloud` keys) into `providers` on first run. `ollama.baseUrl` is applied to the shared `OllamaClient` inside `buildAdapters()`.
- `setLocalOnly(true)` (privacy mode toggle, `privacy:mode:toggle`) skips every non-ollama provider.

### Dual Assistant Design

- **Browser Assistant** (conversation id `__assistant__`) can call browser tools; **Page Chat** (per-tab conversations) may only use page tools. Tool calls arrive as `[TOOL: name({...})]` markers in the assistant reply and are parsed/executed **in the renderer** (`src/renderer/utils/browser-tools.ts`).
- The **Agent engine** (`src/main/services/agent/`) is separate: `Planner` produces a one-shot JSON step plan (no ReAct loop), `agent.ipc.ts` executes steps sequentially, resolving `<previous_result>` placeholders. Execution supports real cancellation (`agent:cancel(taskId)` → `AbortController`, checked between steps) and every `agent:step` event carries `tabId` so progress lands in the correct per-tab session.

### Main Process Organization

- **IPC handlers** (`src/main/ipc/`): one file per domain — `browser.ipc.ts`, `ai.ipc.ts`, `agent.ipc.ts`, `research.ipc.ts`, `capability.ipc.ts`, `monitor.ipc.ts`, `recommendation.ipc.ts`, `workspace.ipc.ts`, `context-menu.ipc.ts`. All registered in `src/main/ipc/index.ts`.
- **Services** (`src/main/services/`):
  - `ai/` — router, provider adapters, ollama/openai-compatible/cloud clients, model-manager, prompt-builder
  - `agent/` — planner, tool-registry, `tools/` (navigate, click, type, extract, scroll, wait, ai_process)
  - `browser/` — tab-manager, history, bookmark (+ semantic search), download-service, `download-controller.ts` (wires `will-download` to the DB and streams `download:*` events), workspace, embedding-service, reading-list-service
  - `capability/` — design-analyzer, web-crawler, screenshot (scroll-and-stitch full-page capture), data-extractor, multi-tab-analyzer, css-editor, accessibility-auditor, page-monitor (keeps a content snapshot per page for real AI diffs)
  - `privacy/` — content-filter (category-based blocking + stats, singleton in `filter-instance.ts`), tracker-detector, fingerprint (injected into webview guests on `did-start-navigation` when `privacy.fingerprintProtection` is set; script is idempotent per page)
  - `research/`, `recommendation/`, `context-menu/`
- **Store** (`src/main/store/`): `config.ts` (electron-store `config.json`; keys: `ollama`, `browser`, `privacy`, `appearance`, `shortcuts`, plus runtime `providers`; the legacy `cloud` key is only read by first-run migration), `database.ts` (better-sqlite3 `data.db`, WAL; tables: bookmarks(+embedding), history, downloads, reading_list, interest_profiles, recommendation_cache, monitored_pages(+last_content_snapshot), page_changes, research_projects/sources/notes)

### Renderer Organization

- **Stores** (`src/renderer/store/`): `tab-store` (persisted to sessionStorage), `ai-store` (per-tab conversations + streaming + `stopStreaming`), `agent-store` (per-tab sessions keyed by tabId), `capability-store`, `devtools-store`, `recommendation-store`, `settings-store` (reads/writes `appearance.*` keys).
- **Components** (`src/renderer/components/`): by feature — `browser/`, `ai/`, `agent/`, `capability/`, `devtools/`, `research/`, `recommendation/`, `reading/`, `settings/`, `common/`.

### Shared Code (`src/shared/`)

- `types.ts` — all TypeScript interfaces (`AIProviderConfig` is a discriminated union on `type`)
- `ipc-channels.ts` — channel string constants (only put channels here that actually have a sender and receiver)
- `constants.ts` — Ollama URL, default model, context limits, `MAX_RECENTLY_CLOSED`, `NEW_TAB_URL` (`wisewander://newtab`), `BROWSER_ASSISTANT_ID`

### Build System

electron-vite with three build targets (main, preload, renderer), output in `out/`. ESM throughout (`"type": "module"`; the build converts stray `require()` calls via `createRequire`, but prefer real `import`s).

### Testing

- **Unit** (`vitest.config.ts`): node env — `src/main/services/**/*.test.ts`, `src/shared/**/*.test.ts`, `tests/unit/`
- **Integration** (`vitest.config.integration.ts`): jsdom, mock `window.api` — `tests/integration/`
- **E2E** (`playwright.config.ts`): launches the built app via `_electron.launch`; AI specs need a running local Ollama. `tests/e2e/global-setup.ts` builds if `out/main/index.js` is missing.
- Coverage config only counts `src/main/services` and `src/shared`.

### Ollama Integration Note

The main process sets `OLLAMA_LLM_LIBRARY=cpu` by default as a workaround for Metal GPU crashes on certain macOS versions. Override via environment variable.

## Conventions & Gotchas

- Add IPC channels in three places: `shared/ipc-channels.ts`, `main/ipc/*.ts`, `preload/index.ts`. The unit test `tests/unit/shared/ipc-channels.test.ts` enforces unique names.
- Don't import main-process singletons from `ipc/` inside `services/` — import from `services/ai/router-instance.ts` etc. to avoid cycles.
- Theme/settings persistence lives under nested keys (`appearance.theme`, `appearance.showBookmarkBar`, ...). `settings-store` and `SettingsPage` both write the same nested keys; keep them in sync.
- `npm run lint` uses the ESLint 9 flat config; unused vars must be prefixed with `_`.
- `postinstall` runs `electron-builder install-app-deps` to rebuild better-sqlite3 for the Electron ABI — don't remove it, and re-run it if native modules fail to load.
- Dead IPC endpoints are removed rather than stubbed: every channel in `shared/ipc-channels.ts` should have a real sender and receiver.
