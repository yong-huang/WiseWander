import type { ToolParameter } from '../../../../shared/types'
import type { AgentTool } from '../tool-registry'

export interface NavigationResult {
  url: string
  title: string
  status: 'success' | 'error'
  error?: string
}

export interface NavigationContext {
  webContents: {
    loadURL: (url: string) => Promise<void>
    getURL: () => string
    getTitle: () => string
  }
}

const parameters: ToolParameter[] = [
  {
    name: 'url',
    type: 'string',
    description: 'The URL to navigate to',
    required: true,
  },
]

export const navigateTool: AgentTool = {
  name: 'navigate',
  description:
    'Navigates the browser webview to a specified URL. Returns the final URL, page title, and navigation status. Throws on failure so the agent knows navigation did not succeed.',
  parameters,

  async execute(
    params: Record<string, unknown>,
    context: unknown
  ): Promise<NavigationResult> {
    const { url } = params
    if (typeof url !== 'string' || !url) {
      throw new Error('A valid "url" string parameter is required.')
    }

    const navContext = context as NavigationContext
    if (!navContext?.webContents?.loadURL) {
      throw new Error(
        'Navigation context with webContents is required to use the navigate tool.'
      )
    }

    // Navigate with a timeout
    const NAV_TIMEOUT = 15_000
    try {
      await Promise.race([
        navContext.webContents.loadURL(url),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Navigation timed out after ${NAV_TIMEOUT / 1000}s`)), NAV_TIMEOUT)
        ),
      ])

      const finalUrl = navContext.webContents.getURL()
      const title = navContext.webContents.getTitle()

      // Check if we actually ended up somewhere useful
      if (!title && finalUrl === 'about:blank') {
        throw new Error(`Navigation to ${url} resulted in blank page.`)
      }

      return {
        url: finalUrl,
        title,
        status: 'success',
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      throw new Error(`Failed to navigate to ${url}: ${msg}`)
    }
  },
}
