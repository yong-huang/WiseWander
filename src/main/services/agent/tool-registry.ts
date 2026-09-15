import type { ToolParameter } from '../../../shared/types'

export interface AgentTool {
  name: string
  description: string
  parameters: ToolParameter[]
  execute: (params: Record<string, unknown>, context: unknown) => Promise<unknown>
}

export class ToolRegistry {
  private tools = new Map<string, AgentTool>()

  register(tool: AgentTool): void {
    this.tools.set(tool.name, tool)
  }

  get(name: string): AgentTool | undefined {
    return this.tools.get(name)
  }

  list(): AgentTool[] {
    return Array.from(this.tools.values())
  }
}
