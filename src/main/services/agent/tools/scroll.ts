import type { ToolParameter } from '../../../../shared/types'
import type { AgentTool } from '../tool-registry'

export interface ScrollResult {
  scrolled: boolean
  direction: string
  amount: number
  scrollPosition: { x: number; y: number }
}

export interface ScrollContext {
  webContents: {
    executeJavaScript: (code: string) => Promise<unknown>
  }
}

const parameters: ToolParameter[] = [
  {
    name: 'direction',
    type: 'string',
    description:
      'Direction to scroll: "up", "down", "left", or "right"',
    required: true,
  },
  {
    name: 'amount',
    type: 'number',
    description:
      'Distance in pixels to scroll (default 500). For "top" or "bottom" directions this is ignored.',
    required: false,
  },
]

export const scrollTool: AgentTool = {
  name: 'scroll',
  description:
    'Scrolls the page in a specified direction (up, down, left, right) by a given number of pixels.',
  parameters,

  async execute(
    params: Record<string, unknown>,
    context: unknown
  ): Promise<ScrollResult> {
    const { direction, amount } = params

    if (typeof direction !== 'string' || !direction) {
      throw new Error('A valid "direction" string parameter is required.')
    }

    const validDirections = ['up', 'down', 'left', 'right']
    const normalizedDirection = direction.toLowerCase().trim()
    if (!validDirections.includes(normalizedDirection)) {
      throw new Error(
        `Invalid direction "${direction}". Must be one of: ${validDirections.join(', ')}.`
      )
    }

    const scrollAmount = typeof amount === 'number' && amount > 0 ? amount : 500

    const scrollContext = context as ScrollContext
    if (!scrollContext?.webContents?.executeJavaScript) {
      throw new Error(
        'Context with webContents.executeJavaScript is required to use the scroll tool.'
      )
    }

    const result = await scrollContext.webContents.executeJavaScript(`
      (() => {
        const direction = ${JSON.stringify(normalizedDirection)};
        const amount = ${scrollAmount};

        switch (direction) {
          case 'down':
            window.scrollBy(0, amount);
            break;
          case 'up':
            window.scrollBy(0, -amount);
            break;
          case 'right':
            window.scrollBy(amount, 0);
            break;
          case 'left':
            window.scrollBy(-amount, 0);
            break;
        }

        return {
          scrolled: true,
          direction,
          amount,
          scrollPosition: {
            x: window.scrollX,
            y: window.scrollY,
          },
        };
      })()
    `)

    return result as ScrollResult
  },
}
