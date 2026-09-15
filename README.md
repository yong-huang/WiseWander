# WiseWander

AI Native 浏览器，基于 Electron + Ollama。本地模型优先、云端兜底，AI 能力（双助手、摘要、翻译、自动化 Agent、深度研究、爬虫、整页截图、页面监控、无障碍审计）作为浏览器一等公民，数据全部落在本地。

| 新标签页(浅色) | 新标签页(深色) | AI 侧栏 |
|---|---|---|
| ![新标签页浅色](docs/screenshots/newtab-light.jpg) | ![新标签页深色](docs/screenshots/newtab-dark.jpg) | ![AI 侧栏](docs/screenshots/sidebar-light.jpg) |

> 交互式架构图（支持主题切换 / 关系追踪 / 导出）：
> - [系统架构](docs/diagrams/wisewander-architecture.html)
> - [AI 对话数据流](docs/diagrams/wisewander-chat-dataflow.html)
> - [Agent 执行时序](docs/diagrams/wisewander-agent-sequence.html)

## 技术栈

- **框架**: Electron 33 / electron-vite（ESM）
- **前端**: React 19 + TypeScript + Tailwind CSS 4 + Zustand 5
- **本地 AI**: Ollama（优先），可选 OpenAI / Anthropic / OpenAI 兼容端点兜底
- **数据存储**: better-sqlite3（WAL）+ electron-store
- **测试**: Vitest（单元 / 集成）+ Playwright（E2E）+ ESLint 9

## 功能一览

- **浏览器核心**：多标签（拖拽排序 / 恢复）、地址栏、书签（含 nomic-embed-text 语义搜索）、历史、下载管理（真实进度 + 落库）、工作区
- **AI 侧栏**：浏览器助手（可执行浏览器工具）/ 页面对话 / 摘要（三档长度）/ 翻译 / Stop 按钮真中止（AbortSignal 贯穿到 HTTP 请求）
- **Agent 自动化**：自然语言 → JSON 步骤规划 → 7 个工具（navigate/click/type/extract/scroll/wait/ai_process）驱动页面，支持真取消
- **AI 能力集**：网页爬虫、整页截图（滚动拼接）、数据提取、多标签分析、CSS 智能编辑、无障碍审计、Markdown 导出、页面监控（AI 变更摘要）
- **研究 & 推荐**：研究报告 / 研究工作台 / 兴趣画像推荐 / 阅读队列（AI 摘要）
- **隐私**：广告 / 追踪器拦截（分类统计）、指纹防护、隐私模式（强制仅本地 AI）
- **DevTools**：Console / Network / Elements / Storage / AI 调试面板

## 开发

```bash
npm install
npm run dev
```

## 构建

```bash
npm run build
```

## 测试

```bash
npm run test:unit        # 单元测试
npm run test:integration # 集成测试
npm run test:e2e         # E2E 测试（需先 build 并运行本地 Ollama）
npm run typecheck        # 类型检查（node + web 两个 tsconfig）
npm run lint             # ESLint
```

## 文档

- [产品需求 PRD](docs/PRD.md)
- [技术设计 DESIGN](docs/DESIGN.md)
- [测试策略 TEST](docs/TEST.md)
- [CLAUDE.md](CLAUDE.md) — 代码库导读（架构、约定、陷阱）
