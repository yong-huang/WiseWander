import type { ToolParameter } from '../../../../shared/types'
import type { AgentTool } from '../tool-registry'

export interface WaitResult {
  found: boolean
  selector: string
  waitTime: number
}

export interface WaitContext {
  webContents: {
    executeJavaScript: (code: string) => Promise<unknown>
  }
}

const parameters: ToolParameter[] = [
  {
    name: 'selector',
    type: 'string',
    description: 'CSS selector of the element to wait for',
    required: true,
  },
  {
    name: 'timeout',
    type: 'number',
    description:
      'Maximum time in milliseconds to wait for the element (default 10000)',
    required: false,
  },
]

export const waitTool: AgentTool = {
  name: 'wait',
  description:
    'Waits for an element matching the given CSS selector to appear in the DOM. Polls periodically until the element is found or the timeout is reached.',
  parameters,

  async execute(
    params: Record<string, unknown>,
    context: unknown
  ): Promise<WaitResult> {
    const { selector, timeout } = params

    if (typeof selector !== 'string' || !selector) {
      throw new Error('A valid "selector" string parameter is required.')
    }

    const timeoutMs =
      typeof timeout === 'number' && timeout > 0 ? timeout : 10000

    const waitContext = context as WaitContext
    if (!waitContext?.webContents?.executeJavaScript) {
      throw new Error(
        'Context with webContents.executeJavaScript is required to use the wait tool.'
      )
    }

    const result = await waitContext.webContents.executeJavaScript(`
      (async () => {
        const selector = ${JSON.stringify(selector)};
        const timeout = ${timeoutMs};
        const pollInterval = 100;
        const startTime = Date.now();

        const poll = () => {
          return new Promise((resolve) => {
            const check = () => {
              const el = document.querySelector(selector);
              if (el) {
                resolve({ found: true, elapsed: Date.now() - startTime });
                return;
              }

              const elapsed = Date.now() - startTime;
              if (elapsed >= timeout) {
                resolve({ found: false, elapsed });
                return;
              }

              setTimeout(check, pollInterval);
            };
            check();
          });
        };

        // Also observe DOM mutations for faster detection
        const waitForMutation = () => {
          return new Promise((resolve) => {
            const observer = new MutationObserver(() => {
              const el = document.querySelector(selector);
              if (el) {
                observer.disconnect();
                resolve({ found: true, elapsed: Date.now() - startTime });
              }
            });

            observer.observe(document.body, {
              childList: true,
              subtree: true,
            });

            setTimeout(() => {
              observer.disconnect();
              resolve(null);
            }, timeout);
          });
        };

        // Race polling against mutation observation
        const mutationResult = await waitForMutation();
        if (mutationResult && mutationResult.found) {
          return {
            found: true,
            selector,
            waitTime: mutationResult.elapsed,
          };
        }

        // Fallback to polling result
        const pollResult = await poll();
        return {
          found: pollResult.found,
          selector,
          waitTime: pollResult.elapsed,
        };
      })()
    `)

    return result as WaitResult
  },
}
