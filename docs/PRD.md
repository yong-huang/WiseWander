# WiseWander — Product Requirements Document

> Version: 1.1.0
> Updated: 2026-09-15
> Status: Active — the v0.1.0 MVP has shipped, with some P1/P2 items delivered ahead of plan (see implementation status at the end)

---

## 1. Product Vision

**WiseWander** is an AI-native browser that embeds AI deeply into every layer of the browsing experience. Unlike "plugin-style AI" in traditional browsers, WiseWander treats a local large language model (via Ollama) as a first-class citizen at the architecture level, giving users native intelligent conversation, automated operations, deep research, and privacy protection while browsing.

### Core Positioning

- **AI-native**: AI is not an add-on — it is the browser's core interaction model
- **Local-first**: local models via Ollama take priority, protecting user privacy
- **macOS-first**: optimized for macOS, with Windows/Linux to follow

---

## 2. User Personas

### 2.1 Primary — Knowledge Workers

| Attribute | Description |
|------|------|
| Occupation | Researchers, analysts, developers, content creators |
| Age | 25-45 |
| Scenario | Frequent long-form reading, collecting information across many sources, summarizing and comparing |
| Pain points | Information overload, repetitive chores, privacy concerns |
| Expectations | The browser "understands" content and proactively assists |

### 2.2 Secondary — Efficiency Enthusiasts

| Attribute | Description |
|------|------|
| Occupation | Students, freelancers, entrepreneurs |
| Scenario | Auto-filling forms, batch searching, quick summaries |
| Pain points | Repetitive web operations are time-consuming |
| Expectations | Direct the browser with natural language |

### 2.3 Tertiary — Privacy-Sensitive Users

| Attribute | Description |
|------|------|
| Traits | Data-security conscious, refuse cloud AI services |
| Scenario | Sensitive documents, confidential browsing |
| Pain points | Mainstream browsers upload data to the cloud for AI features |
| Expectations | AI runs entirely locally with zero data leakage |

---

## 3. Functional Requirements

### Priority Definitions

- **P0**: MVP must-have — the product does not stand without it
- **P1**: Core differentiators, required for version 1.0
- **P2**: Enhancements, for later iterations

---

### 3.1 P0 — Browser Fundamentals

#### 3.1.1 Tab Management

| ID | Feature | Description |
|----|----|------|
| BR-001 | New/close tabs | Via shortcuts and buttons |
| BR-002 | Tab switching | Click to switch; shortcuts Cmd+1~9 |
| BR-003 | Tab drag reorder | Drag to adjust tab order |
| BR-004 | Tab preview | Hover shows page thumbnail |
| BR-005 | Tab groups | Named, collapsible groups |
| BR-006 | Tab restore | Restore closed tabs from history (Cmd+Shift+T) |

#### 3.1.2 Navigation

| ID | Feature | Description |
|----|----|------|
| BR-007 | Address bar | Unified search/URL input with autocomplete |
| BR-008 | Back/forward | Standard browser navigation |
| BR-009 | Refresh/force refresh | Cmd+R / Cmd+Shift+R |
| BR-010 | Page load state | Address bar shows load progress |

#### 3.1.3 Bookmarks

| ID | Feature | Description |
|----|----|------|
| BR-011 | Add/remove bookmarks | Cmd+D quick bookmark |
| BR-012 | Bookmarks bar | Shown below the address bar |
| BR-013 | Bookmark manager | Search, edit, folder organization |
| BR-014 | Bookmark sync | Import/export HTML bookmark files |

#### 3.1.4 History

| ID | Feature | Description |
|----|----|------|
| BR-015 | Browsing history | Visit records on a timeline |
| BR-016 | History search | Keyword search over history |
| BR-017 | Clear history | Clear by time range |

#### 3.1.5 Downloads

| ID | Feature | Description |
|----|----|------|
| BR-018 | Download files | Show download progress and status |
| BR-019 | Download manager | View, open, delete download items |
| BR-020 | Download location | Customizable download directory |

---

### 3.2 P0 — AI Sidebar

#### 3.2.1 Page Conversation

| ID | Feature | Description |
|----|----|------|
| AI-001 | Smart conversation | Multi-turn conversation grounded in the current page |
| AI-002 | Context awareness | Auto-extracts page text, structure, metadata as context |
| AI-003 | Source citations | Answers cite source paragraphs; click to jump |
| AI-004 | Multimodal understanding | Recognize images and tables on the page |

#### 3.2.2 Page Summaries

| ID | Feature | Description |
|----|----|------|
| AI-005 | One-click summary | Auto-summarize long articles (key points + key info) |
| AI-006 | Adjustable length | Short / standard / detailed |
| AI-007 | Structured summary | Hierarchical summaries by section/paragraph |
| AI-008 | Summary export | Copy or export summaries as Markdown |

#### 3.2.3 Translation

| ID | Feature | Description |
|----|----|------|
| AI-009 | Full-page translation | Local-model translation of entire pages |
| AI-010 | Selection translation | Translate selected text via right-click |
| AI-011 | Bilingual view | Paragraph-by-paragraph original + translation |
| AI-012 | Language auto-detect | Detect page language automatically |

---

### 3.3 P0 — Ollama Local Model Connection & Configuration

| ID | Feature | Description |
|----|----|------|
| OL-001 | Connection detection | Auto-detect the local Ollama service at startup |
| OL-002 | Model list | Show installed models with sizes |
| OL-003 | Model selection | Choose the default chat model |
| OL-004 | Model download | Pull new models via the Ollama API |
| OL-005 | Connection indicator | UI shows Ollama status (online/offline/error) |
| OL-006 | Endpoint configuration | Custom Ollama address (default localhost:11434) |
| OL-007 | Streaming responses | AI responses stream token by token |

---

### 3.4 P1 — AI Automation

#### 3.4.1 Form Filling

| ID | Feature | Description |
|----|----|------|
| AT-001 | Natural-language form filling | Describe in natural language; AI locates and fills forms |
| AT-002 | Smart field matching | AI maps intent to fields semantically |
| AT-003 | User confirmation | Show results before submitting; execute after confirmation |

#### 3.4.2 Automated Search & Navigation

| ID | Feature | Description |
|----|----|------|
| AT-004 | Smart search | Describe the need; AI builds and runs the query |
| AT-005 | Page navigation | AI clicks page elements to navigate |
| AT-006 | Operation recording & replay | Record user action sequences; replay with one click |

#### 3.4.3 Data Collection

| ID | Feature | Description |
|----|----|------|
| AT-007 | Structured extraction | Extract specified data types (tables, lists) from pages |
| AT-008 | Batch collection | Collect the same data across multiple pages |
| AT-009 | Data export | Export results as JSON / CSV / Markdown |

---

### 3.5 P1 — Research Assistant

| ID | Feature | Description |
|----|----|------|
| RS-001 | Multi-tab coordination | Aggregate and correlate information across tabs |
| RS-002 | Information comparison | Auto-compare sources, highlight differences |
| RS-003 | Report generation | Organize collected information into structured reports |
| RS-004 | Source tracing | Every claim cites its source page and location |
| RS-005 | Knowledge graph | Visualize key concepts and relations of a research topic |
| RS-006 | Research sessions | Save research as sessions to continue later |

---

### 3.6 P1 — Private Browsing Mode

| ID | Feature | Description |
|----|----|------|
| PV-001 | Privacy mode entry | One-click private browsing mode |
| PV-002 | Forced local processing | In privacy mode AI uses only local models |
| PV-003 | No traces | No history/cookies/cache retained after private mode ends |
| PV-004 | Content filtering | Optional ad/tracker blocking |
| PV-005 | Fingerprint protection | Basic browser fingerprint randomization |
| PV-006 | Privacy dashboard | Show tracker counts and types for the current page |

---

### 3.7 P2 — Advanced Features

| ID | Feature | Description |
|----|----|------|
| AD-001 | Global shortcuts | Customizable AI feature shortcuts |
| AD-002 | Theme system | Light / dark / follow system |
| AD-003 | Extension system | Load Chrome extensions (Chromium compatible) |
| AD-004 | Command palette | Cmd+K with fuzzy search over commands and AI actions |
| AD-005 | Workspaces | Save and restore complete tab/window states |
| AD-006 | Multi-language UI | Chinese/English interface |
| AD-007 | Cloud model fallback | Optional OpenAI / Claude APIs as backup models |

---

## 4. Non-Functional Requirements

### 4.1 Performance

| ID | Metric | Target |
|----|------|------|
| NF-001 | Cold start | < 3s (excluding Ollama startup) |
| NF-002 | AI first-token latency | < 500ms (local model, hardware dependent) |
| NF-003 | Memory | < 500MB base browsing, < 1GB with AI enabled (excluding model memory) |
| NF-004 | Page load | On par with native Chromium |
| NF-005 | Sidebar response | Open/close animation < 200ms |

### 4.2 Security

| ID | Metric | Description |
|----|------|------|
| NF-006 | Process isolation | Sandboxed renderer; no direct Node.js access |
| NF-007 | IPC security | All IPC traffic validated and filtered |
| NF-008 | Content security policy | Strict CSP to prevent XSS |
| NF-009 | Auto update | Secure HTTPS auto-update |
| NF-010 | Data encryption | Local passwords/tokens encrypted at rest |

### 4.3 Privacy

| ID | Metric | Description |
|----|------|------|
| NF-011 | Local by default | AI inference runs locally by default |
| NF-012 | Data minimization | Only necessary page context is collected for AI |
| NF-013 | Transparency | Clearly communicate what data is sent to models |
| NF-014 | User control | Users can disable AI features and clear AI history anytime |

### 4.4 Reliability

| ID | Metric | Description |
|----|------|------|
| NF-015 | Crash isolation | One crashed tab does not affect other tabs or the browser |
| NF-016 | Data durability | Bookmarks/settings/sessions stored reliably |
| NF-017 | Graceful degradation | Core browsing unaffected when Ollama is unavailable |

---

## 5. MVP Scope

### MVP Includes (v0.1.0)

1. **Browser fundamentals**
   - Tab management (new/close/switch/restore)
   - Address bar navigation
   - Back/forward/refresh
   - Bookmarks (add/remove/bookmarks bar)
   - History
   - Basic download management

2. **AI sidebar**
   - Page conversation (grounded in page content)
   - One-click summaries
   - Selection translation

3. **Ollama integration**
   - Auto-detect local Ollama
   - Model selection
   - Streaming responses

### MVP Excludes

- AI automation (P1)
- Research assistant (P1)
- Private browsing mode (P1)
- Tab groups, tab previews (P0, may be deferred)
- Extension system, command palette (P2)
- Cloud model fallback (P2)

### MVP Success Criteria

- Users can browse normally (on par with basic Chrome experience)
- Users can converse with sidebar AI grounded in the current page
- Ollama connection is stable with working streaming responses
- Smooth on macOS with no crashes

---

## 6. Release Plan

| Version | Scope | Timeline |
|------|------|----------|
| v0.1.0 (MVP) | Browser basics + AI sidebar + Ollama | Weeks 1-4 |
| v0.2.0 | AI automation | Weeks 5-8 |
| v0.3.0 | Research assistant | Weeks 9-12 |
| v0.4.0 | Private browsing | Weeks 13-16 |
| v1.0.0 | All P2 features + stability polish | Weeks 17-20 |

---

## 7. Implementation Status (verified 2026-09-15)

| Scope | Status |
|------|------|
| P0 browser basics (tabs/navigation/bookmarks/history) | ✅ Done (BR-005 tab groups and BR-004 tab previews not built; BR-013 bookmark manager partial — search exists, no folder UI; BR-014 sync not built) |
| P0 downloads (BR-018~020) | ✅ Done: real download progress, cancel, persisted records (wired up in this round of fixes) |
| P0 AI sidebar (AI-001~008) | ✅ Page conversation / summaries / translate shipped; AI-003 source citations, AI-004 multimodal, AI-007 structured summaries, AI-010 full-page translation not built |
| P0 Ollama integration (OL-001~007) | ✅ All done; model pulls show live progress |
| P1 AI automation (AT-001~009) | ⚠️ Partial: agent planning/execution/cancellation shipped; AT-006 operation recording and AT-003 confirmation flow not built |
| P1 research assistant (RS-001~006) | ⚠️ Partial: report generation / multi-tab sources / research workbench shipped; RS-005 knowledge graph not built |
| P1 privacy mode (PV-001~006) | ⚠️ Mostly: content filtering (per-category stats), fingerprint protection, privacy mode (forced local AI) shipped; PV-003 private partition and PV-006 dashboard partial (session stats exist) |
| P2 advanced | ⚠️ Partial: command palette AD-004, workspaces AD-005, themes AD-002, cloud model fallback AD-007 (multi-provider priority routing) shipped; extensions AD-003 and multi-language UI AD-006 not built |
| Beyond PRD | AI capability suite (10 tools: crawler / full-page screenshot / data extraction / multi-tab analysis / CSS editor / accessibility audit / markdown export / page monitoring / template export / design analysis), custom DevTools, reading queue, semantic bookmark search, dual-assistant tool system |

> Note: the package version remains 0.1.0 (package.json); actual completion sits between the planned v0.3 and v0.4.
