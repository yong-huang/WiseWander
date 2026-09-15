import { describe, it, expect } from 'vitest'
import { ToolRegistry } from '../../../../../src/main/services/agent/tool-registry'
import type { ToolParameter } from '../../../../../src/shared/types'

const mockTool = {
  name: 'test-tool',
  description: 'A test tool',
  parameters: [
    { name: 'input', type: 'string' as const, description: 'Test input', required: true },
  ],
  execute: async (params: Record<string, unknown>) => `executed with ${params.input}`,
}

describe('ToolRegistry', () => {
  it('should register and retrieve a tool', () => {
    const registry = new ToolRegistry()
    registry.register(mockTool)
    const tool = registry.get('test-tool')
    expect(tool).toBeDefined()
    expect(tool?.name).toBe('test-tool')
  })

  it('should return undefined for unknown tool', () => {
    const registry = new ToolRegistry()
    expect(registry.get('nonexistent')).toBeUndefined()
  })

  it('should list all registered tools', () => {
    const registry = new ToolRegistry()
    registry.register(mockTool)
    registry.register({ ...mockTool, name: 'tool-2' })
    expect(registry.list()).toHaveLength(2)
  })

  it('should execute a registered tool', async () => {
    const registry = new ToolRegistry()
    registry.register(mockTool)
    const tool = registry.get('test-tool')!
    const result = await tool.execute({ input: 'test-value' })
    expect(result).toBe('executed with test-value')
  })
})
