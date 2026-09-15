import type { ToolParameter } from '../../../../shared/types'
import type { AgentTool } from '../tool-registry'

export interface ClickResult {
  clicked: boolean
  selector: string
}

export interface ClickContext {
  webContents: {
    executeJavaScript: (code: string) => Promise<unknown>
  }
}

const parameters: ToolParameter[] = [
  {
    name: 'selector',
    type: 'string',
    description: 'CSS selector of the element to click',
    required: true,
  },
  {
    name: 'timeout',
    type: 'number',
    description:
      'Maximum time in milliseconds to wait for the element to appear (default 5000)',
    required: false,
  },
]

export const clickTool: AgentTool = {
  name: 'click',
  description:
    'Clicks an element on the page identified by a CSS selector. Waits for the element to appear before clicking.',
  parameters,

  async execute(
    params: Record<string, unknown>,
    context: unknown
  ): Promise<ClickResult> {
    const { selector, timeout } = params
    if (typeof selector !== 'string' || !selector) {
      throw new Error('A valid "selector" string parameter is required.')
    }
    const timeoutMs =
      typeof timeout === 'number' && timeout > 0 ? timeout : 5000

    const clickContext = context as ClickContext
    if (!clickContext?.webContents?.executeJavaScript) {
      throw new Error(
        'Context with webContents.executeJavaScript is required to use the click tool.'
      )
    }

    const result = await clickContext.webContents.executeJavaScript(`
      (async () => {
        const selector = ${JSON.stringify(selector)};
        const timeout = ${timeoutMs};

        const waitForElement = (sel, ms) => {
          return new Promise((resolve) => {
            const existing = document.querySelector(sel);
            if (existing) {
              resolve(existing);
              return;
            }

            const observer = new MutationObserver((_, obs) => {
              const el = document.querySelector(sel);
              if (el) {
                obs.disconnect();
                resolve(el);
              }
            });

            observer.observe(document.body, {
              childList: true,
              subtree: true,
            });

            setTimeout(() => {
              observer.disconnect();
              resolve(null);
            }, ms);
          });
        };

        const element = await waitForElement(selector, timeout);
        if (!element) {
          return { clicked: false, selector, error: 'Element not found within timeout.' };
        }

        element.scrollIntoView({ behavior: 'instant', block: 'center' });

        const eventOptions = {
          bubbles: true,
          cancelable: true,
          view: window,
        };

        element.dispatchEvent(new MouseEvent('mouseover', eventOptions));
        element.dispatchEvent(new MouseEvent('mousedown', eventOptions));
        element.dispatchEvent(new MouseEvent('mouseup', eventOptions));
        element.dispatchEvent(new MouseEvent('click', eventOptions));

        if (typeof element.click === 'function') {
          element.click();
        }

        return { clicked: true, selector };
      })()
    `)

    return result as ClickResult
  },
}
