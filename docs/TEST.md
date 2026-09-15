# WiseWander — Test Documentation

> Version: 1.1.0
> Updated: 2026-09-15
> Status: Active

---

## 1. Testing Strategy

### 1.1 Test Pyramid

```
          ┌──────────┐
          │   E2E    │        Few — cover key user flows
          │  Tests   │        Playwright
         ┌┴──────────┴┐
         │ Integration │      Moderate — cover module interactions
         │    Tests    │      Vitest + Electron
        ┌┴─────────────┴┐
        │   Unit Tests   │    Many — cover core logic
        │                │    Vitest
        └────────────────┘
```

### 1.2 Test Layer Definitions

| Layer | Scope | Tools | Target Coverage | Frequency |
|------|------|------|-----------|----------|
| Unit tests | Pure functions, service classes, utility methods | Vitest | ≥ 80% | Every commit |
| Integration tests | IPC communication, database, Ollama integration | Vitest + electron-vitest | ≥ 60% of core paths | Every PR |
| E2E tests | Complete user flows | Playwright | 100% of critical paths | Daily / pre-release |

### 1.3 Testing Principles

1. **Mock boundaries, test logic**: Mock external dependencies (Ollama API, file system) and focus on testing internal logic
2. **Don't test the framework**: Do not test framework behavior such as React rendering or Electron startup
3. **Repeatable**: All tests run standalone on any dev machine, without depending on external service state
4. **Fast feedback**: Unit tests < 10s, integration tests < 60s, E2E tests < 5min

---

## 2. Testing Toolchain

### 2.1 Tool Selection

| Tool | Version | Purpose |
|------|------|------|
| Vitest | 3.x | Unit + integration test runner |
| @electron-vitest | latest | Integration tests in the Electron environment |
| Playwright | 1.50+ | E2E tests (browser automation) |
| @testing-library/react | latest | React component testing utilities (planned; not yet adopted) |
| msw | latest | HTTP mocking for the Ollama API (planned; not yet adopted — Ollama mocking is handled by hand-written stubs) |
| faker | latest | Test data generation (planned; not yet adopted) |

### 2.2 Configuration Files

```typescript
// vitest.config.ts — unit tests
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'src/main/services/**/*.test.ts',
      'src/shared/**/*.test.ts',
      'src/renderer/store/**/*.test.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/main/services/**', 'src/shared/**'],
      exclude: ['**/*.test.ts', '**/*.d.ts'],
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80,
      },
    },
  },
});
```

```typescript
// vitest.config.react.ts — React component tests
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup/react-setup.ts'],
    include: ['src/renderer/components/**/*.test.tsx'],
  },
});
```

```typescript
// playwright.config.ts — E2E tests
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  retries: 1,
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'main',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
```

### 2.3 Test Directory Structure

```
tests/
├── setup/
│   ├── react-setup.ts              # React test environment setup
│   ├── electron-setup.ts           # Electron test environment setup
│   └── ollama-mock.ts              # Ollama API mock
│
├── unit/
│   ├── main/
│   │   ├── services/
│   │   │   ├── browser/
│   │   │   │   ├── tab-manager.test.ts
│   │   │   │   ├── bookmark-service.test.ts
│   │   │   │   ├── history-service.test.ts
│   │   │   │   └── download-service.test.ts
│   │   │   ├── ai/
│   │   │   │   ├── ollama-client.test.ts
│   │   │   │   ├── model-manager.test.ts
│   │   │   │   ├── prompt-builder.test.ts
│   │   │   │   └── context-extractor.test.ts
│   │   │   ├── agent/
│   │   │   │   ├── planner.test.ts
│   │   │   │   ├── executor.test.ts
│   │   │   │   └── tools/
│   │   │   │       ├── navigate.test.ts
│   │   │   │       ├── click.test.ts
│   │   │   │       ├── type.test.ts
│   │   │   │       └── extract.test.ts
│   │   │   └── privacy/
│   │   │       ├── content-filter.test.ts
│   │   │       └── tracker-detector.test.ts
│   │   └── store/
│   │       ├── bookmarks.db.test.ts
│   │       └── history.db.test.ts
│   │
│   └── renderer/
│       ├── store/
│       │   ├── ai-store.test.ts
│       │   ├── tab-store.test.ts
│       │   └── settings-store.test.ts
│       ├── hooks/
│       │   ├── useAI.test.ts
│       │   └── useTabs.test.ts
│       └── components/
│           ├── ai/
│           │   ├── ChatPanel.test.tsx
│           │   └── SummaryPanel.test.tsx
│           └── browser/
│               ├── TabBar.test.tsx
│               └── AddressBar.test.tsx
│
├── integration/
│   ├── ipc/
│   │   ├── browser-ipc.test.ts      # Browser IPC integration
│   │   ├── ai-ipc.test.ts           # AI IPC integration
│   │   └── agent-ipc.test.ts        # Agent IPC integration
│   ├── ollama/
│   │   ├── connection.test.ts       # Ollama connection and reconnect
│   │   ├── streaming.test.ts        # Streaming responses end-to-end
│   │   └── model-management.test.ts # Model management
│   └── database/
│       ├── migrations.test.ts       # Database migrations
│       └── crud.test.ts             # Data CRUD operations
│
├── e2e/
│   ├── browser/
│   │   ├── tab-management.spec.ts   # Tab management E2E
│   │   ├── navigation.spec.ts       # Navigation E2E
│   │   ├── bookmarks.spec.ts        # Bookmarks E2E
│   │   └── downloads.spec.ts        # Downloads E2E
│   ├── ai/
│   │   ├── chat.spec.ts             # AI chat E2E
│   │   ├── summary.spec.ts          # Summarization E2E
│   │   └── translate.spec.ts        # Translation E2E
│   ├── agent/
│   │   └── automation.spec.ts       # Automation operations E2E
│   └── privacy/
│       └── privacy-mode.spec.ts     # Privacy mode E2E
│
└── fixtures/
    ├── mock-pages/                   # HTML pages for testing
    │   ├── simple.html
    │   ├── long-article.html
    │   ├── form.html
    │   └── multi-lang.html
    ├── mock-responses/               # Ollama mock responses
    │   ├── chat-stream.ndjson
    │   ├── summary-response.ndjson
    │   └── models-list.json
    └── test-data/
        ├── bookmarks.json
        └── history.json
```

---

## 3. Coverage Requirements

### 3.1 Core Module Coverage Standards

| Module | Statement Coverage | Branch Coverage | Priority |
|------|----------|----------|--------|
| `services/ai/ollama-client` | ≥ 90% | ≥ 85% | P0 |
| `services/ai/prompt-builder` | ≥ 90% | ≥ 90% | P0 |
| `services/ai/stream-handler` | ≥ 85% | ≥ 80% | P0 |
| `services/browser/tab-manager` | ≥ 85% | ≥ 80% | P0 |
| `services/agent/planner` | ≥ 80% | ≥ 75% | P1 |
| `services/agent/executor` | ≥ 85% | ≥ 80% | P1 |
| `services/agent/tools/*` | ≥ 85% | ≥ 80% | P1 |
| `services/privacy/*` | ≥ 80% | ≥ 75% | P1 |
| `store/*` (database) | ≥ 85% | ≥ 80% | P0 |
| `ipc/*` | ≥ 70% | ≥ 65% | P0 |

### 3.2 Excluded from Coverage

- Type definition files (`*.d.ts`)
- Test files themselves
- Configuration files
- UI style files
- Thin wrappers around third-party libraries

---

## 4. Key Test Scenarios

### 4.1 Browser Core Feature Tests

#### 4.1.1 Tab Management (TabManager)

```typescript
// tests/unit/main/services/browser/tab-manager.test.ts

describe('TabManager', () => {
  it('should create a new tab with unique ID');
  it('should create tab with default URL when no URL provided');
  it('should close a tab and remove from tabs map');
  it('should not close the last tab (keep at least one)');
  it('should activate a tab and update activeTabId');
  it('should reorder tabs correctly');
  it('should track tab status changes (loading → loaded → error)');
  it('should emit TAB_UPDATE event on state change');
  it('should restore recently closed tab');
  it('should limit recently closed list to 20 items');
});
```

#### 4.1.2 Bookmark Service (BookmarkService)

```typescript
describe('BookmarkService', () => {
  it('should add a bookmark and persist to SQLite');
  it('should delete a bookmark by ID');
  it('should create folder and nest bookmarks');
  it('should list bookmarks in tree structure');
  it('should search bookmarks by title or URL');
  it('should update bookmark title/URL');
  it('should handle duplicate URLs gracefully');
  it('should import bookmarks from HTML file');
  it('should export bookmarks to HTML file');
});
```

#### 4.1.3 History Service (HistoryService)

```typescript
describe('HistoryService', () => {
  it('should record a page visit');
  it('should increment visit_count on revisit');
  it('should search history by keyword');
  it('should list history sorted by recency');
  it('should clear history older than specified date');
  it('should clear all history');
  it('should paginate history results');
});
```

#### 4.1.4 Download Management (DownloadService)

```typescript
describe('DownloadService', () => {
  it('should start a download and track progress');
  it('should update download state on completion');
  it('should handle download cancellation');
  it('should persist download record to SQLite');
  it('should resume interrupted downloads if possible');
  it('should respect custom download directory setting');
});
```

---

### 4.2 AI Feature Tests

#### 4.2.1 Ollama Client (Mocked Model Responses)

```typescript
// tests/unit/main/services/ai/ollama-client.test.ts

import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

const ollamaServer = setupServer(
  // Mock /api/tags — model list
  http.get('http://localhost:11434/api/tags', () => {
    return HttpResponse.json({
      models: [
        { name: 'llama3.2', size: 2_000_000_000, modified_at: '2026-01-01' },
        { name: 'qwen2.5', size: 4_700_000_000, modified_at: '2026-02-01' },
      ],
    });
  }),

  // Mock /api/chat — streaming chat
  http.post('http://localhost:11434/api/chat', async () => {
    const chunks = [
      { response: 'Hello', done: false },
      { response: ' world', done: false },
      { response: '!', done: false },
      { response: '', done: true },
    ];
    const stream = new ReadableStream({
      start(controller) {
        chunks.forEach(chunk => {
          controller.enqueue(new TextEncoder().encode(JSON.stringify(chunk) + '\n'));
        });
        controller.close();
      },
    });
    return new HttpResponse(stream, {
      headers: { 'Content-Type': 'application/x-ndjson' },
    });
  }),
);

describe('OllamaClient', () => {
  beforeAll(() => ollamaServer.listen());
  afterAll(() => ollamaServer.close());
  afterEach(() => ollamaServer.resetHandlers());

  describe('healthCheck', () => {
    it('should return online status when Ollama is running');
    it('should return offline status when connection refused');
    it('should list available models on health check');
  });

  describe('listModels', () => {
    it('should return parsed model list');
    it('should include model size and modification date');
    it('should handle empty model list');
  });

  describe('chat', () => {
    it('should stream chat responses chunk by chunk');
    it('should accumulate full response text');
    it('should send correct message format to API');
    it('should handle empty response gracefully');
    it('should timeout on long-running requests');
    it('should retry on transient connection errors (max 3)');
  });

  describe('generate', () => {
    it('should stream generate responses');
    it('should include system prompt when provided');
  });
});
```

#### 4.2.2 Prompt Building (PromptBuilder)

```typescript
describe('PromptBuilder', () => {
  it('should build chat prompt with page context');
  it('should truncate long page content to fit context window');
  it('should include page metadata (title, URL)');
  it('should build summary prompt with configurable length');
  it('should build translation prompt with target language');
  it('should handle pages with minimal content');
  it('should handle empty page context gracefully');
});
```

#### 4.2.3 Context Extraction (ContextExtractor)

```typescript
describe('ContextExtractor', () => {
  it('should extract main text content from page');
  it('should extract heading structure');
  it('should extract links with text and href');
  it('should extract table data as structured arrays');
  it('should extract metadata from meta tags');
  it('should detect page language');
  it('should strip navigation/footer noise from content');
  it('should handle pages with dynamic content (SPA)');
});
```

#### 4.2.4 Streaming Response Handling (StreamHandler)

```typescript
describe('StreamHandler', () => {
  it('should parse NDJSON lines correctly');
  it('should accumulate buffer across multiple chunks');
  it('should detect stream completion (done: true)');
  it('should handle malformed JSON in stream');
  it('should reset buffer between requests');
  it('should pipe stream to IPC correctly');
});
```

---

### 4.3 Ollama Integration Tests

```typescript
// tests/integration/ollama/connection.test.ts

describe('Ollama Integration', () => {
  it('should detect Ollama running on default port');
  it('should detect Ollama running on custom port');
  it('should report offline when Ollama is not running');
  it('should reconnect when Ollama restarts');
  it('should notify UI of status changes via IPC');
});

// tests/integration/ollama/streaming.test.ts

describe('Ollama Streaming', () => {
  it('should stream response from Ollama to renderer via IPC');
  it('should handle stream interruption gracefully');
  it('should maintain message history across conversation turns');
  it('should cancel ongoing stream on new request');
});

// tests/integration/ollama/model-management.test.ts

describe('Model Management', () => {
  it('should list installed models');
  it('should switch active model');
  it('should reject invalid model names');
  it('should persist model selection across restarts');
});
```

---

### 4.4 Agent Automation Tests

#### 4.4.1 Planner

```typescript
describe('Planner', () => {
  it('should decompose "search for X" into navigate + extract steps');
  it('should decompose "fill form" into navigate + type steps');
  it('should decompose "compare prices" into multi-step plan');
  it('should handle ambiguous tasks with clarification request');
  it('should validate generated plan against available tools');
  it('should reject plans that use unknown tools');
});
```

#### 4.4.2 Execution Engine (Executor)

```typescript
describe('Executor', () => {
  it('should execute steps in order');
  it('should pass output of step N as context to step N+1');
  it('should stop execution on step error');
  it('should notify UI of each step status change');
  it('should collect and return all step results');
  it('should support step timeout');
});
```

#### 4.4.3 Agent Tools

```typescript
describe('Navigate Tool', () => {
  it('should navigate webview to specified URL');
  it('should wait for page load before returning');
  it('should handle navigation failure (404, DNS error)');
});

describe('Click Tool', () => {
  it('should click element matching CSS selector');
  it('should wait for element to appear before clicking');
  it('should throw if element not found within timeout');
});

describe('Type Tool', () => {
  it('should type text into input matching selector');
  it('should clear existing text before typing');
  it('should handle special characters');
});

describe('Extract Tool', () => {
  it('should extract text content by selector');
  it('should extract structured data using schema');
  it('should extract data from tables');
  it('should return empty array when no matches found');
});
```

#### 4.4.4 Agent End-to-End Scenarios

```typescript
// tests/e2e/agent/automation.spec.ts

describe('Agent Automation E2E', () => {
  it('should fill a login form via natural language command', async () => {
    // 1. Open the test login page
    // 2. Enter the command "fill in the login form with username: test, password: 1234"
    // 3. Verify the form has been filled
    // 4. Submit after user confirmation
  });

  it('should search and extract search results', async () => {
    // 1. Enter the command "search for TypeScript best practices and extract the titles and links of the top 5 results"
    // 2. Agent navigates to a search engine
    // 3. Agent extracts the results
    // 4. Verify the extracted data is well-formed
  });

  it('should collect data across multiple pages', async () => {
    // 1. Enter the command "extract product prices from the following three pages"
    // 2. Agent visits each page and extracts data
    // 3. Verify the aggregated data is complete
  });
});
```

---

### 4.5 Performance Test Benchmarks

| Metric | Test Method | Benchmark Target | Warning Threshold |
|------|----------|----------|--------|
| Cold start time | E2E: launch to homepage render | < 3s | > 5s |
| Tab creation | Perf: createTab() × 100 | < 50ms per tab | > 100ms |
| Memory with 100 tabs | RSS after launching 100 blank tabs | < 500MB | > 800MB |
| AI first-token latency | Integration: chat() to first chunk | < 500ms (local) | > 2s |
| Summary generation | Integration: summarize a 2000-character page | < 10s (local) | > 30s |
| SQLite writes | Perf: INSERT × 1000 | < 100ms | > 500ms |
| SQLite queries | Perf: full-text search × 100 | < 50ms | > 200ms |
| Sidebar toggle | E2E: click to animation complete | < 200ms | > 400ms |
| Page load | Compare against Chrome loading the same page | delta < 10% | > 30% |

**Performance testing tools**:
- Electron's built-in `process.memoryUsage()` for memory monitoring
- `performance.now()` for precise timing
- Playwright trace for analyzing page-load waterfalls
- `clinic.js` for Node.js profiling (as needed)

```typescript
// tests/unit/perf/tab-creation.perf.test.ts

describe('Tab Creation Performance', () => {
  it('should create 100 tabs under 5 seconds', async () => {
    const tabManager = new TabManager();
    const start = performance.now();

    for (let i = 0; i < 100; i++) {
      tabManager.createTab('about:blank');
    }

    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(5000);
    expect(tabManager.getAllTabs()).toHaveLength(100);
  });
});
```

---

### 4.6 Security Tests

#### 4.6.1 Process Isolation Tests

```typescript
describe('Process Isolation', () => {
  it('should not expose Node.js APIs in renderer process', async () => {
    // Verify that the following globals do not exist in the renderer process
    // - require
    // - process
    // - __dirname
    // - __filename
    // - Buffer (Node.js version)
    // - global
  });

  it('should only expose whitelisted APIs via contextBridge', async () => {
    // Verify that window.api only contains the predefined methods
  });

  it('should validate all IPC channel names against whitelist', async () => {
    // Ensure the main process only responds to registered IPC channels
  });
});
```

#### 4.6.2 IPC Security Tests

```typescript
describe('IPC Security', () => {
  it('should reject IPC messages with invalid channel names');
  it('should sanitize URL input in navigate IPC');
  it('should validate tab ID format in tab operations');
  it('should rate-limit AI chat requests per tab');
  it('should reject excessively long messages');
  it('should strip HTML from user input before sending to Ollama');
});
```

#### 4.6.3 Data Security Tests

```typescript
describe('Data Security', () => {
  it('should encrypt stored tokens and API keys');
  it('should not log AI conversation content to disk');
  it('should clear sensitive data from memory after use');
  it('should validate SQLite inputs to prevent injection');
  it('should set secure CSP headers on renderer');
});
```

#### 4.6.4 Privacy Mode Tests

```typescript
describe('Privacy Mode', () => {
  it('should not save history in privacy mode');
  it('should not save cookies in privacy mode');
  it('should clear all session data when privacy mode exits');
  it('should block AI requests to external APIs in privacy mode');
  it('should only use local Ollama in privacy mode');
  it('should report tracker blocking statistics');
  it('should not persist AI conversation in privacy mode');
});
```

---

## 5. CI/CD Integration

### 5.1 GitHub Actions Workflow

```yaml
# .github/workflows/test.yml

name: Test

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  unit-tests:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - run: npm ci
      - run: npm run test:unit -- --coverage
      - uses: codecov/codecov-action@v4
        with:
          files: ./coverage/lcov.info

  integration-tests:
    runs-on: macos-latest
    needs: unit-tests
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - run: npm ci
      - run: npm run test:integration

  e2e-tests:
    runs-on: macos-latest
    needs: integration-tests
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - run: npm ci
      - run: npm run build
      - run: npm run test:e2e

      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: e2e-traces
          path: test-results/

  lint-and-typecheck:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
```

### 5.2 npm Scripts

```json
{
  "scripts": {
    "test": "npm run test:unit && npm run test:integration",
    "test:unit": "vitest run",
    "test:unit:watch": "vitest",
    "test:unit:coverage": "vitest run --coverage",
    "test:integration": "vitest run --config vitest.config.integration.ts",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:perf": "vitest run --config vitest.config.perf.ts",
    "lint": "eslint src/",
    "typecheck": "tsc --noEmit"
  }
}
```

### 5.3 Pipeline Stages

```
┌─────────────┐     ┌──────────────────┐     ┌────────────┐     ┌──────────┐
│  Lint &      │────►│  Unit Tests      │────►│ Integration│────►│  E2E     │
│  TypeCheck   │     │  + Coverage      │     │ Tests      │     │  Tests   │
└─────────────┘     └──────────────────┘     └────────────┘     └──────────┘
                                                     │
                                                     ▼
                                              ┌────────────┐
                                              │  Build &   │
                                              │  Package   │
                                              └────────────┘
```

- **Lint & TypeCheck**: every push, ~30s
- **Unit Tests + Coverage**: every push, ~30s
- **Integration Tests**: every PR, ~60s
- **E2E Tests**: every PR + daily schedule, ~3min
- **Build & Package**: after merge to main, ~5min

### 5.4 Quality Gates

A PR may be merged into main only if:

- [x] Lint passes with zero errors
- [x] TypeScript compiles
- [x] All unit tests pass
- [x] Coverage meets thresholds (≥ 80% statements)
- [x] All integration tests pass
- [x] E2E critical-path tests pass
- [x] No performance benchmark regression (degradation > 20% requires manual review)

### 5.5 Dependency Security

```yaml
# .github/workflows/security.yml

name: Security Audit
on:
  schedule:
    - cron: '0 2 * * 1'  # Every Monday at 2:00
  push:
    paths: ['package-lock.json']

jobs:
  audit:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm audit --audit-level=high
      - run: npx license-checker --failOn 'GPL-3.0'
```

---

## 6. Mocking Strategy

### 6.1 Ollama API Mock

Use `msw` (Mock Service Worker) to mock the Ollama REST API:

```typescript
// tests/setup/ollama-mock.ts

import { http, HttpResponse, delay } from 'msw';

export const ollamaHandlers = [
  // Health check
  http.get('http://localhost:11434/api/tags', async () => {
    return HttpResponse.json({
      models: [
        { name: 'llama3.2:latest', size: 2_014_362_432, modified_at: '2026-03-01' },
        { name: 'qwen2.5:latest', size: 4_680_000_000, modified_at: '2026-03-15' },
      ],
    });
  }),

  // Streaming chat
  http.post('http://localhost:11434/api/chat', async ({ request }) => {
    const body = await request.json();
    const lastMsg = body.messages[body.messages.length - 1].content.toLowerCase();

    // Return different mock responses depending on the user message
    let response: string;
    if (lastMsg.includes('summarize') || lastMsg.includes('summary')) {
      response = 'This article mainly discusses the application of AI in browsers...';
    } else if (lastMsg.includes('translate') || lastMsg.includes('translation')) {
      response = 'This article discusses the application of AI in browsers...';
    } else {
      response = 'This is a mock AI response.';
    }

    const chunks = response.split('').map((char, i, arr) => ({
      response: char,
      done: i === arr.length - 1,
    }));

    const stream = new ReadableStream({
      async start(controller) {
        for (const chunk of chunks) {
          await delay(10); // Simulate streaming latency
          controller.enqueue(
            new TextEncoder().encode(JSON.stringify(chunk) + '\n')
          );
        }
        controller.close();
      },
    });

    return new HttpResponse(stream, {
      headers: { 'Content-Type': 'application/x-ndjson' },
    });
  }),

  // Model pull (simulated progress)
  http.post('http://localhost:11434/api/pull', async () => {
    const statuses = [
      { status: 'pulling manifest' },
      { status: 'downloading', completed: 50, total: 100 },
      { status: 'downloading', completed: 100, total: 100 },
      { status: 'success' },
    ];

    const stream = new ReadableStream({
      async start(controller) {
        for (const status of statuses) {
          await delay(100);
          controller.enqueue(
            new TextEncoder().encode(JSON.stringify(status) + '\n')
          );
        }
        controller.close();
      },
    });

    return new HttpResponse(stream, {
      headers: { 'Content-Type': 'application/x-ndjson' },
    });
  }),
];
```

### 6.2 Electron API Mock

Mock the Electron API in unit tests:

```typescript
// tests/setup/electron-mock.ts

const mockWebContents = {
  send: vi.fn(),
  executeJavaScript: vi.fn(),
  capturePage: vi.fn(),
  on: vi.fn(),
  loadURL: vi.fn(),
};

export const mockBrowserWindow = {
  webContents: mockWebContents,
  loadURL: vi.fn(),
  loadFile: vi.fn(),
  show: vi.fn(),
  close: vi.fn(),
  on: vi.fn(),
};

vi.mock('electron', () => ({
  BrowserWindow: vi.fn(() => mockBrowserWindow),
  ipcMain: {
    handle: vi.fn(),
    on: vi.fn(),
  },
  session: {
    defaultSession: {
      webRequest: {
        onBeforeRequest: vi.fn(),
      },
    },
  },
  app: {
    getPath: vi.fn(() => '/tmp/test-appdata'),
    on: vi.fn(),
  },
}));
```

### 6.3 Database Mock

Integration tests use in-memory SQLite:

```typescript
// tests/setup/db-setup.ts

import Database from 'better-sqlite3';

export function createTestDB(): Database.Database {
  const db = new Database(':memory:');
  // Run migrations
  db.exec(`
    CREATE TABLE bookmarks (...);
    CREATE TABLE history (...);
    CREATE TABLE conversations (...);
    CREATE TABLE messages (...);
    CREATE TABLE downloads (...);
  `);
  return db;
}
```

---

## 7. Test Command Quick Reference

| Command | Purpose |
|------|------|
| `npm test` | Run unit + integration tests |
| `npm run test:unit` | Run unit tests only |
| `npm run test:unit:watch` | Run unit tests in watch mode |
| `npm run test:unit:coverage` | Unit tests + coverage report |
| `npm run test:integration` | Run integration tests |
| `npm run test:e2e` | Run E2E tests |
| `npm run test:e2e:ui` | Run E2E tests in Playwright UI mode |
| `npm run test:perf` | Run performance benchmarks |
| `npm run lint` | ESLint check |
| `npm run typecheck` | TypeScript type check |

---

## 8. Test Status (verified 2026-09-15)

| Suite | Command | Status |
|------|------|------|
| Unit | `npm run test:unit` | ✅ 85 passing / 10 files (covering prompt-builder, tab-manager, tool-registry, ipc-channels, ai-smart-tab-name, capability-crawl store, web-crawler with 16 cases, plus the agent loop suite (json-utils, page-state, controller with a scripted fake LLM — 19 cases)) |
| Integration | `npm run test:integration` | ✅ 45 passing / 3 files (capability-crawl, capability-md-export, html-to-markdown) |
| E2E | `npm run test:e2e` | 19 specs; requires `npm run build` first and a locally running Ollama (AI suites make real calls) |
| Types | `npm run typecheck` | ✅ Real checks against both tsconfigs (the old script was a no-op; fixed) |
| Lint | `npm run lint` | ✅ ESLint 9 flat config, 0 errors (eslint was previously not installed; now added) |

Removed test: `stream-handler.test.ts` (removed along with the dead StreamHandler code).
The coverage config still only counts `src/main/services` and `src/shared`; renderer components have no unit tests yet (consistent with the §3.2 exemptions).

### 8.1 2026-09-15 Second Cleanup

- Removed dependencies with no callers: `@faker-js/faker`, `msw`, `@testing-library/react`, `@testing-library/jest-dom` (kept in §2.1 as planned-selection notes)
- Cleaned up 16 empty directories left over from planning (`tests/setup/`, `tests/fixtures/*/`, `tests/e2e/{ai,agent,browser,privacy}/`, etc.)
- Installed `electron-builder` and fixed `postinstall` (the script previously referenced a non-existent binary; after `npm install`, better-sqlite3 is now correctly rebuilt against the Electron ABI)
- Removed dead IPC endpoints and preload methods with no callers (the four navigation endpoints, `tab:restore/reorder`, legacy `cloud:config:*`, `research:report`); see DESIGN.md §10.3
