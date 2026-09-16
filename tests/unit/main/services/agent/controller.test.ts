import { describe, it, expect } from 'vitest'
import { AgentController, type ControllerEvent, type ControllerToolContext } from '../../../../../src/main/services/agent/controller'
import { ToolRegistry, type AgentTool } from '../../../../../src/main/services/agent/tool-registry'
import type { PageState } from '../../../../../src/main/services/agent/page-state'

function fakePageState(): PageState {
  return {
    url: 'https://example.com',
    title: 'Example',
    scrollY: 0,
    scrollHeight: 900,
    viewportHeight: 800,
    text: 'Example body text',
    elements: [
      { ref: 'e1', tag: 'a', role: 'link', text: 'Sign in' },
      { ref: 'e2', tag: 'button', role: 'button', text: 'Go' },
    ],
  }
}

function makeContext(): { context: ControllerToolContext; clicks: string[] } {
  const clicks: string[] = []
  const context: ControllerToolContext = {
    webContents: {
      loadURL: async () => {},
      getURL: () => 'https://example.com',
      getTitle: () => 'Example',
      executeJavaScript: async () => fakePageState(),
    },
  }
  return { context, clicks }
}

function scriptedRegistry(script: Array<Record<string, unknown>>): {
  registry: ToolRegistry
  calls: Array<{ tool: string; params: Record<string, unknown> }>
} {
  const registry = new ToolRegistry()
  const calls: Array<{ tool: string; params: Record<string, unknown> }> = []

  const navigate: AgentTool = {
    name: 'navigate',
    description: 'navigate',
    parameters: [{ name: 'url', type: 'string', description: '', required: true }],
    execute: async (params) => {
      calls.push({ tool: 'navigate', params })
      return { navigated: true, url: params.url }
    },
  }
  const click: AgentTool = {
    name: 'click',
    description: 'click',
    parameters: [{ name: 'ref', type: 'string', description: '', required: true }],
    execute: async (params) => {
      calls.push({ tool: 'click', params })
      clicks.push(String(params.ref))
      if (script.clickThrows) throw new Error('Element not found within timeout.')
      return { clicked: true, ref: params.ref }
    },
  } as unknown as AgentTool
  registry.register(navigate)
  registry.register(click)
  return { registry, calls }
}

/** A scripted fake LLM: returns pre-recorded replies, one per call.
 *  Verify calls (system contains 'QA verifier') use verifierReplies. */
function fakeRouter(replies: string[], verifierReplies: string[] = []): {
  chatSync: (m: unknown[]) => Promise<string>
  calls: number
  verifyCalls: number
} {
  let calls = 0
  let verifyCalls = 0
  return {
    get calls() {
      return calls
    },
    get verifyCalls() {
      return verifyCalls
    },
    chatSync: async (messages: unknown[]) => {
      const system = (messages[0] as { content: string }).content
      if (system.includes('QA verifier')) {
        const reply = verifierReplies[Math.min(verifyCalls, verifierReplies.length - 1)]
        verifyCalls += 1
        return reply
      }
      const reply = replies[Math.min(calls, replies.length - 1)]
      calls += 1
      return reply
    },
  }
}

async function runController(opts: {
  replies: string[]
  budgets?: { maxIterations?: number; maxWallMs?: number }
  abort?: boolean
  script?: { clickThrows?: boolean }
}): Promise<{
  result: ReturnType<AgentController['run']> extends Promise<infer R> ? R : never
  events: ControllerEvent[]
  calls: Array<{ tool: string; params: Record<string, unknown> }>
}> {
  const { context } = makeContext()
  const events: ControllerEvent[] = []
  const { registry, calls } = scriptedRegistry(opts.script ?? {})
  const page = fakePageState()
  if (opts.pageUrl) page.url = opts.pageUrl
  const controller = new AgentController({
    goal: 'test goal',
    registry,
    router: fakeRouter(opts.replies, opts.verifierReplies ?? []),
    executeJs: async () => page,
    toolContext: context,
    emit: (e) => events.push(e),
    signal: (() => {
      const ac = new AbortController()
      if (opts.abort) ac.abort()
      return ac.signal
    })(),
    budgets: opts.budgets,
    confirm: opts.confirm,
    onAsk: opts.onAsk,
    onOpenTab: opts.onOpenTab,
  })
  const result = await controller.run()
  return { result, events, calls }
}

describe('AgentController', () => {
  it('completes when the model returns done, emitting thought events', async () => {
    const { result, events } = await runController({
      replies: ['{"thought":"already there","action":"done","report":"The page is already open."}'],
    })
    expect(result.status).toBe('completed')
    expect(result.report).toBe('The page is already open.')
    expect(result.iterations).toBe(1)
    expect(events.some((e) => e.type === 'thought' && e.text === 'already there')).toBe(true)
  })

  it('executes tool actions in order and records steps', async () => {
    const { result, calls } = await runController({
      replies: [
        '{"thought":"navigate first","action":"navigate","params":{"url":"https://example.com"}}',
        '{"thought":"click the link","action":"click","params":{"ref":"e1"}}',
        '{"thought":"finished","action":"done","report":"opened the link"}',
      ],
    })
    expect(result.status).toBe('completed')
    expect(result.steps).toHaveLength(2)
    expect(result.steps[0].tool).toBe('navigate')
    expect(result.steps[0].status).toBe('done')
    expect(calls.find((c) => c.tool === 'click')?.params).toEqual({ ref: 'e1' })
    expect(result.promptChars).toBeGreaterThan(0)
  })

  it('survives a failing tool: error becomes an observation, run continues', async () => {
    const { result } = await runController({
      replies: [
        '{"thought":"try clicking","action":"click","params":{"ref":"e1"}}',
        '{"thought":"click failed, giving up honestly","action":"done","report":"Blocked: the link could not be clicked."}',
      ],
      script: { clickThrows: true },
    })
    expect(result.status).toBe('completed')
    expect(result.report).toContain('Blocked')
    expect(result.steps[0].status).toBe('error')
  })

  it('re-prompts on unparseable output up to the limit, then fails honestly', async () => {
    const { result } = await runController({
      replies: ['this is not json at all', 'still not json'],
      budgets: { maxIterations: 5 },
    })
    expect(result.status).toBe('failed')
    expect(result.report).toContain('unparseable')
  })

  it('stops at the iteration budget with a partial report', async () => {
    const { result } = await runController({
      replies: ['{"thought":"keep going","action":"navigate","params":{"url":"https://example.com/1"}}'],
      budgets: { maxIterations: 3 },
    })
    expect(result.status).toBe('budget_exhausted')
    expect(result.iterations).toBe(3)
    expect(result.report).toContain('budget')
  })

  it('rejects unknown tools and re-prompts', async () => {
    const { result } = await runController({
      replies: [
        '{"thought":"hmm","action":"teleport","params":{}}',
        '{"thought":"navigate instead","action":"navigate","params":{"url":"https://example.com"}}',
        '{"thought":"done now","action":"done","report":"navigated"}',
      ],
    })
    expect(result.status).toBe('completed')
    expect(result.steps[0].tool).toBe('navigate')
  })

  it('returns aborted immediately when the signal is pre-aborted', async () => {
    const { result } = await runController({
      replies: ['{"action":"done"}'],
      abort: true,
    })
    expect(result.status).toBe('aborted')
    expect(result.report).toContain('Cancelled')
  })

  // ── Phase 3: site experience hints ──

  async function runControllerWithCapture(opts: {
    replies: string[]
    onMessages: (messages: unknown[]) => void
    siteHints?: string[]
  }): Promise<{ status: string; report: string }> {
    const { context } = makeContext()
    const router = {
      chatSync: async (messages: unknown[]) => {
        opts.onMessages(messages)
        return opts.replies[Math.min(0, opts.replies.length - 1)]
      },
    }
    const controller = new AgentController({
      goal: 'test goal',
      registry: scriptedRegistry({}).registry,
      router,
      executeJs: async () => fakePageState(),
      toolContext: context,
      emit: () => {},
      signal: new AbortController().signal,
      siteHints: opts.siteHints,
    })
    const result = await controller.run()
    return { status: result.status, report: result.report }
  }

  // ── Phase 2: identical-failure guard ──

  it('blocks the exact same failing action after two failures', async () => {
    const { result, calls } = await runController({
      replies: [
        '{"thought":"click","action":"click","params":{"ref":"e1"}}',
        '{"thought":"try again","action":"click","params":{"ref":"e1"}}',
        '{"thought":"try same again","action":"click","params":{"ref":"e1"}}',
        '{"thought":"done instead","action":"done","report":"gave up after failures"}',
      ],
      script: { clickThrows: true },
    })
    expect(result.status).toBe('completed')
    // two real executions, third identical attempt was blocked before dispatch
    expect(calls.filter((c) => c.tool === 'click')).toHaveLength(2)
    expect(result.steps).toHaveLength(2)
  })

  it('resets the failure guard after a different action succeeds', async () => {
    const { result, calls } = await runController({
      replies: [
        '{"thought":"click","action":"click","params":{"ref":"e1"}}',
        '{"thought":"navigate away","action":"navigate","params":{"url":"https://example.com/x"}}',
        '{"thought":"click again","action":"click","params":{"ref":"e1"}}',
        '{"thought":"done","action":"done","report":"ok"}',
      ],
      script: { clickThrows: true },
    })
    expect(result.status).toBe('completed')
    // both clicks were dispatched: the navigate in between reset the guard
    expect(calls.filter((c) => c.tool === 'click')).toHaveLength(2)
  })

  // ── Phase 2: goal self-check ──

  it('rejects a done report when the self-check judges the goal unmet', async () => {
    const { result } = await runController({
      replies: [
        '{"thought":"claiming done","action":"done","report":"I did the thing"}',
        '{"thought":"self-check pushed back, navigating","action":"navigate","params":{"url":"https://example.com/goal"}}',
        '{"thought":"now actually done","action":"done","report":"Goal achieved for real."}',
      ],
      verifierReplies: ['{"achieved": false, "reason": "the goal page was never opened"}', '{"achieved": true, "reason": "goal page reached"}'],
    })
    expect(result.status).toBe('completed')
    expect(result.report).toBe('Goal achieved for real.')
    expect(result.steps.some((s) => s.tool === 'navigate')).toBe(true)
  })

  it('caps self-check continuations and then accepts the report', async () => {
    const { result } = await runController({
      replies: ['{"thought":"done","action":"done","report":"I think so"}'],
      verifierReplies: ['{"achieved": false, "reason": "nope"}'],
      budgets: { maxIterations: 5 },
    })
    expect(result.status).toBe('completed')
    expect(result.report).toBe('I think so')
  })

  // ── Phase 2: confirmation gates ──

  it('gates off-domain navigation and executes it when approved', async () => {
    const approvals: string[] = []
    const { result, calls } = await runController({
      replies: [
        '{"thought":"go external","action":"navigate","params":{"url":"https://other-site.com/page"}}',
        '{"thought":"done","action":"done","report":"navigated off-domain"}',
      ],
      pageUrl: 'https://example.com/start',
      confirm: async (message) => {
        approvals.push(message)
        return true
      },
    })
    expect(approvals).toHaveLength(1)
    expect(approvals[0]).toContain('other-site.com')
    expect(calls.some((c) => c.tool === 'navigate')).toBe(true)
    expect(result.status).toBe('completed')
  })

  it('treats denial as an observation and continues', async () => {
    const { result, calls } = await runController({
      replies: [
        '{"thought":"go external","action":"navigate","params":{"url":"https://other-site.com/page"}}',
        '{"thought":"finish instead","action":"done","report":"stopped after denial"}',
      ],
      pageUrl: 'https://example.com/start',
      confirm: async () => false,
    })
    expect(calls.some((c) => c.tool === 'navigate')).toBe(false)
    expect(result.status).toBe('completed')
    expect(result.report).toContain('denial')
  })

  it('gates risky-looking clicks (same-domain navigation is free)', async () => {
    const approvals: string[] = []
    const { result } = await runController({
      replies: [
        '{"thought":"click checkout","action":"click","params":{"ref":"e2"}}',
        '{"thought":"finish","action":"done","report":"clicked"}',
      ],
      confirm: async (message) => {
        approvals.push(message)
        return true
      },
    })
    // e2 is "Go" (not risky, same domain) → no gate fired
    expect(approvals).toHaveLength(0)
    expect(result.status).toBe('completed')
  })

  // ── Phase 2: budget events ──

  it('emits budget events with remaining steps', async () => {
    const { events } = await runController({
      replies: [
        '{"thought":"navigate","action":"navigate","params":{"url":"https://example.com/a"}}',
        '{"thought":"done","action":"done","report":"ok"}',
      ],
      budgets: { maxIterations: 5 },
    })
    const budgets = events.filter((e) => e.type === 'budget') as Array<{ type: 'budget'; remainingSteps: number }>
    expect(budgets.length).toBe(1)
    expect(budgets[0].remainingSteps).toBe(4)
  })

  // ── Phase 3: site experience hints ──

  it('injects site hints into the first prompt', async () => {
    let capturedUserPrompt = ''
    const { status, report } = await runControllerWithCapture({
      replies: ['{"thought":"done","action":"done","report":"ok"}'],
      onMessages: (messages) => {
        if (capturedUserPrompt === '') capturedUserPrompt = (messages[1] as { content: string }).content
      },
      siteHints: ['search results live under [e2]'],
    })
    expect(status).toBe('completed')
    expect(report).toBe('ok')
    expect(capturedUserPrompt).toContain('search results live under [e2]')
  })

  it('omits the hints section when there are none', async () => {
    let capturedUserPrompt = ''
    await runControllerWithCapture({
      replies: ['{"action":"done"}'],
      onMessages: (messages) => {
        if (capturedUserPrompt === '') capturedUserPrompt = (messages[1] as { content: string }).content
      },
    })
    expect(capturedUserPrompt).not.toContain('Hints from previous runs')
  })

  // ── Phase 4: ask_user / open_tab (browser-first steering) ──

  it('asks the user, feeds the answer back, and continues', async () => {
    const asked: string[] = []
    const { result } = await runController({
      replies: [
        '{"thought":"ambiguous","action":"ask_user","params":{"question":"Videos or written docs?"}}',
        '{"thought":"user said videos, search","action":"navigate","params":{"url":"https://example.com/videos"}}',
        '{"thought":"done","action":"done","report":"found video resources"}',
      ],
      onAsk: async (question) => {
        asked.push(question)
        return 'videos please'
      },
    })
    expect(asked).toEqual(['Videos or written docs?'])
    expect(result.status).toBe('completed')
    expect(result.report).toBe('found video resources')
  })

  it('caps clarifying questions and forces the model to proceed', async () => {
    const answers: string[] = []
    const { result } = await runController({
      replies: [
        '{"action":"ask_user","params":{"question":"q1"}}',
        '{"action":"ask_user","params":{"question":"q2"}}',
        '{"action":"ask_user","params":{"question":"q3"}}',
        '{"action":"ask_user","params":{"question":"q4"}}',
        '{"action":"done","report":"proceeded with judgment"}',
      ],
      onAsk: async (q) => {
        answers.push(q)
        return 'ans'
      },
    })
    expect(answers).toHaveLength(3) // capped at 3
    expect(result.status).toBe('completed')
    expect(result.report).toBe('proceeded with judgment')
  })

  it('opens pages in new tabs via open_tab', async () => {
    const opened: string[] = []
    const { result } = await runController({
      replies: [
        '{"thought":"open the tutorial","action":"open_tab","params":{"url":"https://docs.python.org/zh-cn/"}}',
        '{"thought":"open one more","action":"open_tab","params":{"url":"https://www.runoob.com/python/"}}',
        '{"thought":"done","action":"done","report":"Opened 2 python resources in tabs"}',
      ],
      pageUrl: 'https://www.bing.com/search?q=python',
      onOpenTab: async (url) => {
        opened.push(url)
      },
    })
    expect(opened).toEqual(['https://docs.python.org/zh-cn/', 'https://www.runoob.com/python/'])
    expect(result.status).toBe('completed')
    expect(result.report).toContain('Opened 2 python resources')
  })

  it('gates cross-domain open_tab on user denial', async () => {
    const denied: string[] = []
    const { result } = await runController({
      replies: [
        '{"action":"open_tab","params":{"url":"https://external-site.org/x"}}',
        '{"thought":"finish","action":"done","report":"stopped after denial"}',
      ],
      pageUrl: 'https://www.bing.com/search?q=x',
      confirm: async (message) => {
        denied.push(message)
        return false
      },
    })
    expect(denied).toHaveLength(1)
    expect(denied[0]).toContain('external-site.org')
    expect(result.status).toBe('completed')
  })
})
