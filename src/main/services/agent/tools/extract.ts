import type { ToolParameter } from '../../../../shared/types'
import type { AgentTool } from '../tool-registry'

export interface ExtractResult {
  selector: string
  data: unknown
}

export interface ExtractContext {
  webContents: {
    executeJavaScript: (code: string) => Promise<unknown>
  }
}

const parameters: ToolParameter[] = [
  {
    name: 'selector',
    type: 'string',
    description: 'CSS selector matching the elements to extract data from',
    required: true,
  },
  {
    name: 'schema',
    type: 'string',
    description:
      'Optional extraction schema: "text" (default) returns text content, "html" returns innerHTML, "attributes" returns attribute maps, "structured" returns a structured object with text, href, src, etc.',
    required: false,
  },
]

export const extractTool: AgentTool = {
  name: 'extract',
  description:
    'Extracts data from page elements matching a CSS selector. Supports multiple extraction schemas: text, html, attributes, and structured.',
  parameters,

  async execute(
    params: Record<string, unknown>,
    context: unknown
  ): Promise<ExtractResult> {
    const { selector, schema } = params

    if (typeof selector !== 'string' || !selector) {
      throw new Error('A valid "selector" string parameter is required.')
    }

    const schemaType =
      typeof schema === 'string' ? schema.toLowerCase().trim() : 'text'

    const extractContext = context as ExtractContext
    if (!extractContext?.webContents?.executeJavaScript) {
      throw new Error(
        'Context with webContents.executeJavaScript is required to use the extract tool.'
      )
    }

    const result = await extractContext.webContents.executeJavaScript(`
      (() => {
        const selector = ${JSON.stringify(selector)};
        const schema = ${JSON.stringify(schemaType)};
        const elements = document.querySelectorAll(selector);

        if (elements.length === 0) {
          return { selector, data: null, error: 'No elements found matching selector.' };
        }

        const extractFromElement = (el) => {
          switch (schema) {
            case 'html':
              return el.innerHTML;

            case 'attributes': {
              const attrs = {};
              for (const attr of Array.from(el.attributes)) {
                attrs[attr.name] = attr.value;
              }
              return attrs;
            }

            case 'structured':
              return {
                tagName: el.tagName.toLowerCase(),
                text: el.textContent?.trim() || '',
                innerHTML: el.innerHTML,
                href: el.getAttribute('href') || undefined,
                src: el.getAttribute('src') || undefined,
                alt: el.getAttribute('alt') || undefined,
                title: el.getAttribute('title') || undefined,
                value: el.value || undefined,
                id: el.id || undefined,
                className: el.className || undefined,
                attributes: (() => {
                  const attrs = {};
                  for (const attr of Array.from(el.attributes)) {
                    attrs[attr.name] = attr.value;
                  }
                  return attrs;
                })(),
              };

            case 'text':
            default:
              return el.textContent?.trim() || '';
          }
        };

        const items = Array.from(elements).map(extractFromElement);
        const data = items.length === 1 ? items[0] : items;

        return { selector, data };
      })()
    `)

    return result as ExtractResult
  },
}
