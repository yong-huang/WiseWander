# WiseWander — Agent Evolution Plan

> Version: 1.0.0 (draft for review)
> Updated: 2026-09-15
> Status: Phases 1–3 core implemented (2026-09-15); 3.4 (vision) deferred
>
> Phase 2 deviations from this plan: confirmation timeout (120s silence) is
> treated as denial, never consent; two consecutive denials stop the run;
> risky-click detection uses a functional keyword list (EN + CN commerce
> verbs) plus off-domain link hosts; self-check continues the loop at most
> twice before accepting the report.
>
> Phase 3 deviations: 3.2 (thought streaming) was already delivered in
> Phase 1; 3.4 (vision) is deferred — it requires multimodal message support
> in the Ollama/Cloud clients (base64 image parts) and is tracked as future
> work; a qwen3-vl model is available locally when picked up.
>
> Phase 2 deviations from this plan: confirmation timeout (120s silence) is
> treated as denial, never consent; two consecutive denials stop the run;
> risky-click detection uses a functional keyword list (EN + CN commerce
> verbs) plus off-domain link hosts; self-check continues the loop at most
> twice before accepting the report.
>
> Phase 1 deviations from this plan: (a) structured output uses the JSON-repair
> path only — native Ollama tool calling is deferred to Phase 2; (b) the
> architecture-map sublabels were dropped for legibility, see the diagrams.
> Scope: evolve the Agent from "LLM-planned workflow" to a closed-loop, page-grounded agent

Related documents: [PRD](PRD.md) (§3.4 AI Automation) · [DESIGN](DESIGN.md) (§4.3 Agent Engine) · [Test Strategy](TEST.md) (§4.4)

---

## 1. Background & Problem Statement

The current Agent (see DESIGN.md §4.3) works like this:

1. `Planner` converts a natural-language task into a one-shot JSON array of tool steps
2. `agent.ipc.ts` executes the steps sequentially, substituting `<previous_result>` placeholders
3. Progress streams to the renderer via `agent:step`; `agent:cancel` aborts mid-run

This is a **workflow**, not an agent, in the standard sense (LLM orchestrated through predefined code paths vs. an LLM dynamically directing its own process). The defining gap is the **absence of a feedback loop**: the plan is produced before the agent ever looks at the page, and step outputs never influence subsequent decisions beyond static placeholder substitution.

### Typical failure scenario

> Task: "Search wise-wander on GitHub and open the first result."
>
> The planner blindly generates `navigate(github.com/search?q=…) → click("some guessed selector")`. The real results page uses selectors the planner has never seen, so the click fails — and the task simply fails. A real agent would look at the page, re-identify the first result link, and click it.

## 2. Goals & Non-Goals

### Goals

- G1: Closed-loop execution — observe → reason → act, repeated until the goal is met or a budget is exhausted
- G2: Page grounding — every decision is made with a compact, structured view of the current page state
- G3: Structured tool calling — strict JSON tool calls with validation and re-prompt on failure
- G4: Bounded autonomy — hard budgets (steps/time/tokens) plus confirmation gates for risky actions
- G5: Keep what works — streaming progress, per-tab isolation, cancellation, and the tool registry are reused

### Non-Goals

- Multi-agent collaboration
- Model fine-tuning or training
- Cloud-only execution paths (local-first stays the default; cloud remains a routed fallback via ModelRouter)
- Unattended/background task execution (tasks remain user-initiated)

## 3. As-Is Inventory (what exists and gets reused)

| Component | Location | Reuse |
|---|---|---|
| Tool registry (`AgentTool { name, description, parameters, execute }`) | `src/main/services/agent/tool-registry.ts` | ✅ unchanged |
| 7 tools (navigate/click/type/extract/scroll/wait/ai_process) | `src/main/services/agent/tools/*` | ✅ reused; signatures extended (see §6.3) |
| Streaming progress channel `agent:step` (tabId-tagged) | `agent.ipc.ts` → renderer `agent-store` | ✅ reused; new event kinds added |
| Cancellation (`agent:cancel(taskId)` → AbortController) | `agent.ipc.ts` | ✅ reused; checks move into the loop |
| Tool context (`webContents.fromId` → loadURL/executeJavaScript) | `agent.ipc.ts` | ✅ reused |
| Robust LLM-JSON parsing (fence stripping, bracket slicing) | `planner.ts` | ✅ extracted into a shared helper |
| Renderer execution log UI (ExecutionLog / TaskList) | `src/renderer/components/agent/*` | ✅ extended for new event kinds |
| Renderer inline chat tools (`[TOOL: …]` markers) | `src/renderer/utils/browser-tools.ts` | ⚠️ kept for chat; later unified with the same JSON protocol |

## 4. Gap Analysis

| # | Agent capability | Current state | Gap |
|---|---|---|---|
| 1 | Feedback loop | Plan is fixed before execution; outputs never feed back | **Critical** — the loop itself (ReAct) |
| 2 | Environment perception | Planner sees only the task text; no page state at decision time | **Critical** — page-state serializer |
| 3 | Structured tool calls | Free-text JSON; model/version dependent | High — schema validation + re-prompt |
| 4 | Error recovery | Failure marks the step and moves on | High — error-as-observation + bounded retry |
| 5 | Goal verification | Plan completion = task completion | Medium — self-check against the goal |
| 6 | Budgets & guards | Cancellation only | Medium — step/time/token budgets, confirmation gates |
| 7 | Memory | Tasks fully isolated | Low/Medium — run persistence, site-level experience |

## 5. Target Architecture

```
AgentController (main process, iterative loop)
  loop (while not done && budget remains):
    1. Assemble context: goal + run history + last observation + current PageState
    2. Ask ModelRouter for the next action (structured JSON)
    3. Validate the action (tool exists, schema ok) → invalid: re-prompt (≤2)
    4. Execute via ToolRegistry against the guest webContents
    5. Build Observation (tool result/error + fresh PageState summary)
    6. Emit agent:step events (thought / action / observation)
  end
  Final self-check (goal met?) → optional extra iterations → report
```

### 5.1 New components

| Component | Location (planned) | Responsibility |
|---|---|---|
| `AgentController` | `src/main/services/agent/controller.ts` | The iterative loop; replaces the one-shot planner as the brain. Owns budgets, retries, and termination |
| `PageStateSerializer` | `src/main/services/agent/page-state.ts` | Compact, LLM-oriented view of the page: URL, title, scroll position, and interactive elements as `[ref] role "text"` lines. Refs are stable IDs (`data-ww-ref` attributes) injected at serialization time |
| `ObservationBuilder` | inside `controller.ts` (initially) | Normalizes tool results/errors into observation text with size budgeting |
| `AgentRunStore` (Phase 3) | `src/main/services/agent/run-store.ts` | Persists runs/steps to SQLite (`agent_runs`, `agent_steps` tables) |

### 5.2 Interaction with existing pieces

- **ModelRouter**: the controller calls `chatSync`/`chat` per iteration. Local-only by default (privacy mode already forces this); cloud failover applies as configured. Prompt size is budgeted (see §6.4).
- **Cancellation**: the existing AbortController is checked (a) between iterations, (b) before each tool call, and (c) inside long tools where feasible.
- **Streaming**: `agent:step` payload gains new `type` values — `thought` (model reasoning excerpt), `action` (validated tool call), `observation` (trimmed result). `tabId` tagging continues so progress never mis-routes.
- **Renderer**: `ExecutionLog` renders the new event kinds; TaskList/AgentPanel flows stay the same.

## 6. Key Design Decisions

### 6.1 Iterative loop replaces the one-shot planner

The first loop iteration subsumes planning: with the goal plus the initial PageState in context, the model emits the first action. `planner.ts` is retired (its JSON-repair helpers move to `src/main/services/agent/json-utils.ts`).

### 6.2 Element refs instead of CSS selectors

`click`/`type`/`extract` gain a `ref` parameter resolved against the refs emitted in the last PageState. CSS selectors remain as a fallback parameter. Rationale: refs survive DOM churn better than raw selectors and remove the largest source of blind-planning failures.

### 6.3 Tool signature changes

```ts
interface ToolContext {
  webContents: { loadURL; getURL; getTitle; executeJavaScript }
  lastRefs: Map<string, string>   // ref → resolved CSS path (new)
}
execute(params, context): Promise<unknown>
```

- `click({ ref?, selector? })`, `type({ ref?, selector?, text })`
- `extract` stays schema-based (text/html/attributes/structured)
- `ai_process` unchanged (already routes through ModelRouter)

### 6.4 Context budgeting

Per-iteration prompt budget: goal + last 3 observations (trimmed) + current PageState ≤ 12k chars (tunable constant in `shared/constants.ts`). PageState itself is capped (interactive elements: top 120; text excerpt: 4k chars). Older history is summarized into one line per step.

### 6.5 Structured output strategy (dual-path)

1. Preferred: Ollama native tool calling (`tools` parameter, supported by qwen/llama3.1+ style models)
2. Fallback: JSON-in-text with the existing repair helpers, validated against a JSON schema; on failure re-prompt with the validation error (≤2 attempts)

The controller selects per model capability and records which path was used in the run log.

### 6.6 Safety model

- **Budgets** (hard limits, configurable per run): max 15 iterations, max 3 minutes wall clock, max ~40k tokens total prompt traffic
- **Confirmation gates**: actions matching risky patterns (form submit, buttons labeled buy/pay/delete/remove, any `loadURL` away from the start domain without an allowlist entry) pause the run and emit `agent:step { type:'confirm' }`; the renderer shows an Approve/Cancel dialog (implements PRD AT-003)
- **Prompt-injection defense**: page text is framed as data — the system prompt states that page content must never be interpreted as instructions; PageState lines are prefixed with a data marker; tool calls are validated against the registered tool list regardless of what the page says
- **Domain policy**: per-run start-domain allowlist by default; expansion requires a confirmation gate

## 7. Phased Implementation Plan

### Phase 1 — Closed loop (the qualitative change) — ✅ implemented 2026-09-15

| Task | Files | Acceptance |
|---|---|---|
| 1.1 Extract JSON-repair helpers | `agent/json-utils.ts` (new), unit tests | Fence/bracket repair covered by tests |
| 1.2 `PageStateSerializer` | `agent/page-state.ts` (new), unit tests | Deterministic ref assignment; size cap respected; works on static + JS-heavy pages |
| 1.3 `AgentController` loop | `agent/controller.ts` (new) | Loop terminates on: done-flag, budget, abort. Emits thought/action/observation events |
| 1.4 Rewire `agent.ipc.ts` | `agent.ipc.ts` | Handler delegates to the controller; `agent:execute` payload unchanged (backward compatible) |
| 1.5 Renderer event rendering | `ExecutionLog.tsx`, `agent-store.ts` | Thought/action/observation rendered; old payloads still render |
| 1.6 Retire `planner.ts` + `executor` remnants | delete files, update tests | No dead imports; unit suite green |

**Phase 1 exit criteria (scenarios, run against local Ollama):**
- S1: "Search wise-wander on GitHub and open the first result" succeeds end-to-end (requires observe-then-click)
- S2: Failure recovery — a task whose first click fails is completed via an alternative path
- S3: Early termination — "open example.com" on an already-open example.com tab ends in 1 step with a done report
- S4: Budget exhaustion produces an honest partial report, not a hang

### Phase 2 — Robustness & safety — ✅ implemented 2026-09-15

| Task | Acceptance |
|---|---|
| 2.1 Error-as-observation + bounded retries (≤2 per tool) | S2 becomes a unit-testable behavior, not luck — implemented as an identical-failure guard: the exact same action is blocked after 2 failures, and a different action resets the guard |
| 2.2 Goal self-check pass before reporting done | Model-verified completion; mismatch triggers extra bounded iteration |
| 2.3 Confirmation gates (+ PRD AT-003) | Risky action pauses; Approve/Cancel dialog; denial aborts cleanly |
| 2.4 Domain allowlist + policy plumbing | Off-domain navigation requires confirmation |
| 2.5 Budgets surfaced in UI | Remaining steps/time visible in AgentPanel (budget strip; controller emits a budget event per iteration) |

### Phase 3 — Memory & experience — ✅ core implemented 2026-09-15 (3.4 vision deferred)

| Task | Acceptance |
|---|---|
| 3.1 `agent_runs` / `agent_steps` SQLite tables + `AgentRunStore` | Runs survive restart; viewable history in AgentPanel |
| 3.2 Thought streaming polish | ✅ delivered in Phase 1 (live thought/observation notes in ExecutionLog) |
| 3.3 Site-experience notes (what selectors/flows worked) | ✅ Stored per domain (`agent_site_notes`, top-5 kept, hit-reinforced); successful run traces saved and injected as advisory hints in the first prompt |
| 3.4 (Optional) Vision: viewport screenshot as observation | Deferred — requires multimodal message support in the model clients; a qwen3-vl model is available locally for when it is picked up |

## 8. Testing Plan

- **Unit**: JSON repair; PageState ref assignment and caps; controller loop with a scripted fake LLM (decisions pre-recorded) — covers done/error/budget/abort paths without a model
- **Integration** (jsdom, fake `window.api`): renderer rendering of new event kinds; confirmation-gate dialog flow
- **E2E** (real Ollama): scenarios S1–S4 above, plus regression of existing `agent.spec.ts` and `tool-split.spec.ts` (chat inline tools must keep working)
- **Manual**: prompt-injection probes (a page containing instruction-like text must not steer the agent)

## 9. Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Small local models are weak at multi-step reasoning | Flaky runs, wrong tools chosen | Structured prompts + explicit action schema; small step granularity; budget caps; model-agnostic design (bigger local models or cloud failover help) |
| Prompt injection from web pages | Agent performs unintended actions | §6.6 data/instruction framing; tool allowlist; confirmation gates; domain policy |
| Context overflow on heavy pages | Truncated perception → bad decisions | PageState caps, ref-list prioritization (visible/interactive first), observation trimming |
| Infinite loops | Cost, bad UX | Hard iteration/time/token budgets (Phase 1, non-negotiable) |
| Latency (LLM round-trip per step) | Slow runs vs. one-shot plan | Show live thoughts (perceived speed); consider batching trivial steps later |

## 10. Milestones

| Milestone | Content | Sizing |
|---|---|---|
| M1 | Phase 1 (loop + perception + structured calls + budgets) | Core: controller ~300 lines, page-state ~200, prompt/parsing ~150, renderer ~150; plus tests |
| M2 | Phase 2 (recovery, self-check, gates, policies) | Smaller; mostly controller branches + one dialog |
| M3 | Phase 3 (memory, streaming polish, optional vision) | Additive; DB schema + store + UI history |

## 11. Documentation Impact (after implementation)

- DESIGN.md §4.3 gets rewritten to describe the controller architecture (this plan stays as the historical proposal)
- PRD.md §7: AT-001/002/004/005 move to ✅ after M1; AT-003 after M2
- TEST.md §4.4: scenario list updated with S1–S4
- New archify diagram: agent sequence re-generated to show the loop

---

## Decision Log

| # | Decision | Rationale |
|---|---|---|
| D1 | Loop lives in the main process | webContents access, DB, budgets all live there; renderer keeps inline chat tools |
| D2 | Element refs over selectors | Robustness against DOM churn; selectors kept as fallback |
| D3 | Dual-path structured output | Native Ollama tools where supported; JSON repair as fallback covers every model |
| D4 | Local-only for agent reasoning by default | Privacy stance (PRD PV-002); cloud via explicit configuration only |
| D5 | Hard budgets in Phase 1 | Autonomy without limits is a safety and cost bug, not a feature |
