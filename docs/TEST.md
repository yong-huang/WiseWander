# WiseWander — 测试文档

> 版本: 1.1.0
> 更新日期: 2026-09-15
> 状态: Active

---

## 1. 测试策略

### 1.1 测试金字塔

```
          ┌──────────┐
          │   E2E    │        少量，覆盖关键用户流程
          │  Tests   │        Playwright
         ┌┴──────────┴┐
         │ Integration │      中等数量，覆盖模块交互
         │    Tests    │      Vitest + Electron
        ┌┴─────────────┴┐
        │   Unit Tests   │    大量，覆盖核心逻辑
        │                │    Vitest
        └────────────────┘
```

### 1.2 测试分层定义

| 层级 | 范围 | 工具 | 目标覆盖率 | 运行频率 |
|------|------|------|-----------|----------|
| 单元测试 | 纯函数、服务类、工具方法 | Vitest | ≥ 80% | 每次提交 |
| 集成测试 | IPC 通信、数据库、Ollama 对接 | Vitest + electron-vitest | ≥ 60% 核心路径 | 每次 PR |
| E2E 测试 | 完整用户流程 | Playwright | 关键路径 100% | 每日 / 发布前 |

### 1.3 测试原则

1. **Mock 边界，测试逻辑**：对外部依赖（Ollama API、文件系统）使用 Mock，重点测试内部逻辑
2. **不测框架**：不测试 React 渲染、Electron 启动等框架行为
3. **可重复**：所有测试可在任何开发机器上独立运行，不依赖外部服务状态
4. **快速反馈**：单元测试 < 10s，集成测试 < 60s，E2E 测试 < 5min

---

## 2. 测试工具链

### 2.1 工具选型

| 工具 | 版本 | 用途 |
|------|------|------|
| Vitest | 3.x | 单元测试 + 集成测试运行器 |
| @electron-vitest | 最新 | Electron 环境下的集成测试 |
| Playwright | 1.50+ | E2E 测试（浏览器自动化） |
| @testing-library/react | 最新 | React 组件测试工具 |
| msw | 最新 | HTTP Mock（模拟 Ollama API） |
| faker | 最新 | 测试数据生成 |

### 2.2 配置文件

```typescript
// vitest.config.ts — 单元测试
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
// vitest.config.react.ts — React 组件测试
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
// playwright.config.ts — E2E 测试
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

### 2.3 测试目录结构

```
tests/
├── setup/
│   ├── react-setup.ts              # React 测试环境配置
│   ├── electron-setup.ts           # Electron 测试环境配置
│   └── ollama-mock.ts              # Ollama API Mock
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
│   │   ├── browser-ipc.test.ts      # 浏览器 IPC 集成
│   │   ├── ai-ipc.test.ts           # AI IPC 集成
│   │   └── agent-ipc.test.ts        # Agent IPC 集成
│   ├── ollama/
│   │   ├── connection.test.ts       # Ollama 连接与重连
│   │   ├── streaming.test.ts        # 流式响应端到端
│   │   └── model-management.test.ts # 模型管理
│   └── database/
│       ├── migrations.test.ts       # 数据库迁移
│       └── crud.test.ts             # 数据 CRUD 操作
│
├── e2e/
│   ├── browser/
│   │   ├── tab-management.spec.ts   # 标签管理 E2E
│   │   ├── navigation.spec.ts       # 导航 E2E
│   │   ├── bookmarks.spec.ts        # 书签 E2E
│   │   └── downloads.spec.ts        # 下载 E2E
│   ├── ai/
│   │   ├── chat.spec.ts             # AI 对话 E2E
│   │   ├── summary.spec.ts          # 摘要 E2E
│   │   └── translate.spec.ts        # 翻译 E2E
│   ├── agent/
│   │   └── automation.spec.ts       # 自动化操作 E2E
│   └── privacy/
│       └── privacy-mode.spec.ts     # 隐私模式 E2E
│
└── fixtures/
    ├── mock-pages/                   # 测试用 HTML 页面
    │   ├── simple.html
    │   ├── long-article.html
    │   ├── form.html
    │   └── multi-lang.html
    ├── mock-responses/               # Ollama Mock 响应
    │   ├── chat-stream.ndjson
    │   ├── summary-response.ndjson
    │   └── models-list.json
    └── test-data/
        ├── bookmarks.json
        └── history.json
```

---

## 3. 测试覆盖要求

### 3.1 核心模块覆盖标准

| 模块 | 语句覆盖 | 分支覆盖 | 优先级 |
|------|----------|----------|--------|
| `services/ai/ollama-client` | ≥ 90% | ≥ 85% | P0 |
| `services/ai/prompt-builder` | ≥ 90% | ≥ 90% | P0 |
| `services/ai/stream-handler` | ≥ 85% | ≥ 80% | P0 |
| `services/browser/tab-manager` | ≥ 85% | ≥ 80% | P0 |
| `services/agent/planner` | ≥ 80% | ≥ 75% | P1 |
| `services/agent/executor` | ≥ 85% | ≥ 80% | P1 |
| `services/agent/tools/*` | ≥ 85% | ≥ 80% | P1 |
| `services/privacy/*` | ≥ 80% | ≥ 75% | P1 |
| `store/*` (数据库) | ≥ 85% | ≥ 80% | P0 |
| `ipc/*` | ≥ 70% | ≥ 65% | P0 |

### 3.2 不要求覆盖的部分

- 类型定义文件 (`*.d.ts`)
- 测试文件本身
- 配置文件
- UI 样式文件
- 第三方库封装的薄层

---

## 4. 关键测试场景

### 4.1 浏览器核心功能测试

#### 4.1.1 标签管理 (TabManager)

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

#### 4.1.2 书签服务 (BookmarkService)

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

#### 4.1.3 历史记录服务 (HistoryService)

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

#### 4.1.4 下载管理 (DownloadService)

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

### 4.2 AI 功能测试

#### 4.2.1 Ollama 客户端 (Mock 模型响应)

```typescript
// tests/unit/main/services/ai/ollama-client.test.ts

import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

const ollamaServer = setupServer(
  // Mock /api/tags — 模型列表
  http.get('http://localhost:11434/api/tags', () => {
    return HttpResponse.json({
      models: [
        { name: 'llama3.2', size: 2_000_000_000, modified_at: '2026-01-01' },
        { name: 'qwen2.5', size: 4_700_000_000, modified_at: '2026-02-01' },
      ],
    });
  }),

  // Mock /api/chat — 流式对话
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

#### 4.2.2 Prompt 构建 (PromptBuilder)

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

#### 4.2.3 上下文提取 (ContextExtractor)

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

#### 4.2.4 流式响应处理 (StreamHandler)

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

### 4.3 Ollama 集成测试

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

### 4.4 Agent 自动化测试

#### 4.4.1 规划器 (Planner)

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

#### 4.4.2 执行引擎 (Executor)

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

#### 4.4.4 Agent 端到端场景

```typescript
// tests/e2e/agent/automation.spec.ts

describe('Agent Automation E2E', () => {
  it('should fill a login form via natural language command', async () => {
    // 1. 打开测试登录页面
    // 2. 输入指令 "用 username: test, password: 1234 填写登录表单"
    // 3. 验证表单已填写
    // 4. 用户确认后提交
  });

  it('should search and extract search results', async () => {
    // 1. 输入指令 "搜索 TypeScript 最佳实践并提取前5个结果的标题和链接"
    // 2. Agent 导航到搜索引擎
    // 3. Agent 提取结果
    // 4. 验证提取的数据格式正确
  });

  it('should collect data across multiple pages', async () => {
    // 1. 输入指令 "从以下三个页面提取产品价格"
    // 2. Agent 逐页访问并提取
    // 3. 验证汇总数据完整
  });
});
```

---

### 4.5 性能测试基准

| 指标 | 测试方法 | 基准目标 | 警戒线 |
|------|----------|----------|--------|
| 冷启动时间 | E2E: 启动到首页渲染 | < 3s | > 5s |
| 标签创建 | Perf: createTab() × 100 | < 50ms/个 | > 100ms |
| 100 标签内存 | 启动 100 空白标签后的 RSS | < 500MB | > 800MB |
| AI 首字延迟 | 集成: chat() 到第一个 chunk | < 500ms (本地) | > 2s |
| 摘要生成 | 集成: 2000 字页面摘要完成 | < 10s (本地) | > 30s |
| SQLite 写入 | Perf: INSERT × 1000 | < 100ms | > 500ms |
| SQLite 查询 | Perf: 全文搜索 × 100 | < 50ms | > 200ms |
| 侧边栏切换 | E2E: 点击到动画完成 | < 200ms | > 400ms |
| 页面加载 | 对比 Chrome 加载同一页面 | 差异 < 10% | > 30% |

**性能测试工具**：
- Electron 内置 `process.memoryUsage()` 监控内存
- `performance.now()` 精确计时
- Playwright trace 分析页面加载瀑布图
- `clinic.js` 进行 Node.js 性能分析（按需）

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

### 4.6 安全测试

#### 4.6.1 进程隔离测试

```typescript
describe('Process Isolation', () => {
  it('should not expose Node.js APIs in renderer process', async () => {
    // 在渲染进程中验证以下全局变量不存在
    // - require
    // - process
    // - __dirname
    // - __filename
    // - Buffer (Node.js version)
    // - global
  });

  it('should only expose whitelisted APIs via contextBridge', async () => {
    // 验证 window.api 只包含预定义的方法
  });

  it('should validate all IPC channel names against whitelist', async () => {
    // 确保主进程只响应已注册的 IPC 通道
  });
});
```

#### 4.6.2 IPC 安全测试

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

#### 4.6.3 数据安全测试

```typescript
describe('Data Security', () => {
  it('should encrypt stored tokens and API keys');
  it('should not log AI conversation content to disk');
  it('should clear sensitive data from memory after use');
  it('should validate SQLite inputs to prevent injection');
  it('should set secure CSP headers on renderer');
});
```

#### 4.6.4 隐私模式测试

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

## 5. CI/CD 集成方案

### 5.1 GitHub Actions 工作流

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

### 5.2 npm scripts 定义

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

### 5.3 流水线阶段

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

- **Lint & TypeCheck**：每次推送，~30s
- **Unit Tests + Coverage**：每次推送，~30s
- **Integration Tests**：每次 PR，~60s
- **E2E Tests**：每次 PR + 每日定时，~3min
- **Build & Package**：main 分支合并后，~5min

### 5.4 质量门禁

PR 合并到 main 分支须满足：

- [x] Lint 通过，零 error
- [x] TypeScript 编译通过
- [x] 单元测试全部通过
- [x] 覆盖率不低于阈值（≥ 80% 语句）
- [x] 集成测试全部通过
- [x] E2E 关键路径测试通过
- [x] 无性能基准回归（> 20% 变差需人工审核）

### 5.5 依赖安全

```yaml
# .github/workflows/security.yml

name: Security Audit
on:
  schedule:
    - cron: '0 2 * * 1'  # 每周一 2:00
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

## 6. Mock 策略

### 6.1 Ollama API Mock

使用 `msw` (Mock Service Worker) 模拟 Ollama REST API：

```typescript
// tests/setup/ollama-mock.ts

import { http, HttpResponse, delay } from 'msw';

export const ollamaHandlers = [
  // 健康检查
  http.get('http://localhost:11434/api/tags', async () => {
    return HttpResponse.json({
      models: [
        { name: 'llama3.2:latest', size: 2_014_362_432, modified_at: '2026-03-01' },
        { name: 'qwen2.5:latest', size: 4_680_000_000, modified_at: '2026-03-15' },
      ],
    });
  }),

  // 流式对话
  http.post('http://localhost:11434/api/chat', async ({ request }) => {
    const body = await request.json();
    const lastMsg = body.messages[body.messages.length - 1].content.toLowerCase();

    // 根据用户消息返回不同 Mock 响应
    let response: string;
    if (lastMsg.includes('摘要') || lastMsg.includes('summarize')) {
      response = '本文主要讨论了人工智能在浏览器中的应用...';
    } else if (lastMsg.includes('翻译') || lastMsg.includes('translate')) {
      response = 'This article discusses the application of AI in browsers...';
    } else {
      response = '这是一个 Mock AI 响应。';
    }

    const chunks = response.split('').map((char, i, arr) => ({
      response: char,
      done: i === arr.length - 1,
    }));

    const stream = new ReadableStream({
      async start(controller) {
        for (const chunk of chunks) {
          await delay(10); // 模拟流式延迟
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

  // 模型拉取（模拟进度）
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

在单元测试中 Mock Electron API：

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

### 6.3 数据库 Mock

集成测试使用内存 SQLite：

```typescript
// tests/setup/db-setup.ts

import Database from 'better-sqlite3';

export function createTestDB(): Database.Database {
  const db = new Database(':memory:');
  // 执行迁移
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

## 7. 测试执行命令速查

| 命令 | 用途 |
|------|------|
| `npm test` | 运行单元 + 集成测试 |
| `npm run test:unit` | 仅运行单元测试 |
| `npm run test:unit:watch` | 监听模式运行单元测试 |
| `npm run test:unit:coverage` | 单元测试 + 覆盖率报告 |
| `npm run test:integration` | 运行集成测试 |
| `npm run test:e2e` | 运行 E2E 测试 |
| `npm run test:e2e:ui` | Playwright UI 模式运行 E2E |
| `npm run test:perf` | 运行性能基准测试 |
| `npm run lint` | ESLint 检查 |
| `npm run typecheck` | TypeScript 类型检查 |

---

## 8. 测试现状（2026-09-15 核对）

| 套件 | 命令 | 现状 |
|------|------|------|
| 单元 | `npm run test:unit` | ✅ 67 通过 / 7 文件（覆盖 prompt-builder、tab-manager（含 restore/reorder）、tool-registry、ipc-channels、ai-smart-tab-name、capability-crawl store、web-crawler 16 例） |
| 集成 | `npm run test:integration` | ✅ 45 通过 / 3 文件（capability-crawl、capability-md-export、html-to-markdown；`tests/setup`、`tests/integration/database|ipc|ollama` 仍为空目录，属规划未实现） |
| E2E | `npm run test:e2e` | 19 个 spec；需先 `npm run build` 且本机运行 Ollama（AI 系列真实调用） |
| 类型 | `npm run typecheck` | ✅ 双 tsconfig 真实检查（旧脚本为空操作，已修复） |
| Lint | `npm run lint` | ✅ ESLint 9 flat config，0 错误（此前 eslint 未安装，已补装） |

已删除的测试：`stream-handler.test.ts`（随死代码 StreamHandler 一并移除）。
覆盖率配置仍仅统计 `src/main/services` 与 `src/shared`；渲染进程组件暂无单测（与 §3.2 的豁免一致）。
