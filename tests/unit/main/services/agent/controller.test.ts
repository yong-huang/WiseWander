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

/** A scripted fake LLM: returns pre-recorded replies, one per call. */
function fakeRouter(replies: string[]): { chatSync: (m: unknown[]) => Promise<string>; calls: number } {
  let calls = 0
  return {
    get calls() {
      return calls
    },
    chatSync: async () => {
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
  const controller = new AgentController({
    goal: 'test goal',
    registry,
    router: fakeRouter(opts.replies),
    executeJs: async () => fakePageState(),
    toolContext: context,
    emit: (e) => events.push(e),
    signal: (() => {
      const ac = new AbortController()
      if (opts.abort) ac.abort()
      return ac.signal
    })(),
    budgets: opts.budgets,
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
})
