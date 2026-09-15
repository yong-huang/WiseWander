import type { ToolRegistry } from '../tool-registry'
import { navigateTool } from './navigate'
import { clickTool } from './click'
import { typeTool } from './type'
import { extractTool } from './extract'
import { scrollTool } from './scroll'
import { waitTool } from './wait'

export { navigateTool } from './navigate'
export { clickTool } from './click'
export { typeTool } from './type'
export { extractTool } from './extract'
export { scrollTool } from './scroll'
export { waitTool } from './wait'

/**
 * Registers all built-in agent tools into the given tool registry.
 */
export function registerBuiltinTools(registry: ToolRegistry): void {
  registry.register(navigateTool)
  registry.register(clickTool)
  registry.register(typeTool)
  registry.register(extractTool)
  registry.register(scrollTool)
  registry.register(waitTool)
}
