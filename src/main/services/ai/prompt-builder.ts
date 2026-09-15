import type { PageContext } from '../../../shared/types'
import { MAX_CONTEXT_CHARS, SUMMARY_CONTEXT_CHARS } from '../../../shared/constants'

export interface PromptTemplate {
  id: string
  name: string
  system: string
  buildUser: (context: PageContext, message: string) => string
}

export const TEMPLATES: Record<string, PromptTemplate> = {
  chat: {
    id: 'chat',
    name: 'Page Chat',
    system: `You are an intelligent assistant. The user is browsing a web page. Answer questions based on the page content.
Rules:
- Base answers on the page content, do not fabricate information
- Cite original text with location markers when quoting
- If the page content is insufficient to answer, state this honestly`,
    buildUser: (ctx, msg) =>
      `Page title: ${ctx.title}\nPage URL: ${ctx.url}\n\nPage content:\n${ctx.textContent.slice(0, MAX_CONTEXT_CHARS)}\n\nUser question: ${msg}`,
  },
  summary: {
    id: 'summary',
    name: 'Page Summary',
    system: 'You are a content summarization expert. Generate a concise summary of the following web page content.',
    buildUser: (ctx, _msg) =>
      `Please generate a summary of the following content:\n\n${ctx.textContent.slice(0, SUMMARY_CONTEXT_CHARS)}`,
  },
  translate: {
    id: 'translate',
    name: 'Translate',
    system:
      'You are a professional translator. Translate the user-provided text into the target language. Output only the translation result, no explanations.',
    buildUser: (_ctx, msg) => msg,
  },
}

export function buildPrompt(
  templateId: string,
  context: PageContext,
  message: string
): { system: string; user: string } {
  const template = TEMPLATES[templateId]
  if (!template) throw new Error(`Unknown prompt template: ${templateId}`)
  return {
    system: template.system,
    user: template.buildUser(context, message),
  }
}
