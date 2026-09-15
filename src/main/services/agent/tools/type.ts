import type { ToolParameter } from '../../../../shared/types'
import { resolveSelector } from './click'
import type { AgentTool } from '../tool-registry'

export interface TypeResult {
  success: boolean
  selector: string
  text: string
}

export interface TypeContext {
  webContents: {
    executeJavaScript: (code: string) => Promise<unknown>
  }
}

const parameters: ToolParameter[] = [
  {
    name: 'ref',
    type: 'string',
    description:
      'Element ref from the Page State interactive-elements list (preferred). Mutually exclusive with "selector".',
    required: false,
  },
  {
    name: 'selector',
    type: 'string',
    description: 'CSS selector of the input element (fallback when no ref fits)',
    required: false,
  },
  {
    name: 'text',
    type: 'string',
    description: 'The text to type into the element',
    required: true,
  },
  {
    name: 'clear',
    type: 'boolean',
    description:
      'Whether to clear existing content before typing (default true)',
    required: false,
  },
]

export const typeTool: AgentTool = {
  name: 'type',
  description:
    'Types text into an input element, identified by its ref from the Page State (preferred) or a CSS selector. Optionally clears existing content first.',
  parameters,

  async execute(
    params: Record<string, unknown>,
    context: unknown
  ): Promise<TypeResult> {
    const { text, clear } = params
    const selector = resolveSelector(params)
    if (!selector) {
      throw new Error('Either a "ref" (from Page State) or a "selector" (CSS) string is required.')
    }
    if (typeof text !== 'string') {
      throw new Error('A valid "text" string parameter is required.')
    }

    const shouldClear = typeof clear === 'boolean' ? clear : true

    const typeContext = context as TypeContext
    if (!typeContext?.webContents?.executeJavaScript) {
      throw new Error(
        'Context with webContents.executeJavaScript is required to use the type tool.'
      )
    }

    const result = await typeContext.webContents.executeJavaScript(`
      (async () => {
        const selector = ${JSON.stringify(selector)};
        const textValue = ${JSON.stringify(text)};
        const shouldClear = ${shouldClear};

        const element = document.querySelector(selector);
        if (!element) {
          return {
            success: false,
            selector,
            text: textValue,
            error: 'Element not found.',
          };
        }

        if (!(element instanceof HTMLInputElement) && !(element instanceof HTMLTextAreaElement) && !element.isContentEditable) {
          return {
            success: false,
            selector,
            text: textValue,
            error: 'Element is not an input, textarea, or content-editable element.',
          };
        }

        element.focus();
        element.scrollIntoView({ behavior: 'instant', block: 'center' });

        if (shouldClear) {
          if (element.isContentEditable) {
            element.innerHTML = '';
          } else {
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
              window.HTMLInputElement.prototype,
              'value'
            )?.set || Object.getOwnPropertyDescriptor(
              window.HTMLTextAreaElement.prototype,
              'value'
            )?.set;

            if (nativeInputValueSetter) {
              nativeInputValueSetter.call(element, '');
            } else {
              element.value = '';
            }
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }

        if (element.isContentEditable) {
          element.textContent = textValue;
        } else {
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype,
            'value'
          )?.set || Object.getOwnPropertyDescriptor(
            window.HTMLTextAreaElement.prototype,
            'value'
          )?.set;

          if (nativeInputValueSetter) {
            nativeInputValueSetter.call(element, textValue);
          } else {
            element.value = textValue;
          }
        }

        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));

        for (const char of textValue) {
          element.dispatchEvent(
            new KeyboardEvent('keydown', { key: char, bubbles: true })
          );
          element.dispatchEvent(
            new KeyboardEvent('keypress', { key: char, bubbles: true })
          );
          element.dispatchEvent(
            new KeyboardEvent('keyup', { key: char, bubbles: true })
          );
        }

        return { success: true, selector, text: textValue };
      })()
    `)

    return result as TypeResult
  },
}
