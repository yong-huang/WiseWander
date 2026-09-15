import {
  AGENT_PAGE_MAX_ELEMENTS,
  AGENT_PAGE_TEXT_CHARS,
  AGENT_PAGE_BUDGET_CHARS,
} from '../../../shared/constants'

/**
 * Page perception for the agent loop (docs/AGENT_EVOLUTION.md §5.1).
 *
 * Runs an injected script inside the guest page that:
 *  1. clears stale `data-ww-ref` attributes,
 *  2. collects visible interactive elements in DOM order,
 *  3. stamps each with a stable `data-ww-ref="eN"` id (click/type resolve
 *     against these instead of fragile CSS selectors),
 *  4. returns a plain-JSON snapshot which we format into a compact
 *     text view for the model.
 */

export interface PageStateElement {
  ref: string
  tag: string
  role: string
  text: string
  inputType?: string
  value?: string
}

export interface PageState {
  url: string
  title: string
  scrollY: number
  scrollHeight: number
  viewportHeight: number
  text: string
  elements: PageStateElement[]
}

export interface PageStateBudget {
  maxElements?: number
  maxTextChars?: number
  maxTotalChars?: number
}

/** Selector for elements the agent is allowed to interact with. */
const INTERACTIVE_SELECTOR = [
  'a[href]',
  'button',
  'input',
  'select',
  'textarea',
  '[role="button"]',
  '[role="link"]',
  '[role="textbox"]',
  '[role="checkbox"]',
  '[role="combobox"]',
  '[onclick]',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

/** Injected into the page; must be fully self-contained (no closures). */
const COLLECT_SCRIPT_FN = `
function __wwCollectPageState(maxElements, maxTextChars) {
  const REF_ATTR = 'data-ww-ref';
  document.querySelectorAll('[' + REF_ATTR + ']').forEach((el) => el.removeAttribute(REF_ATTR));

  function isVisible(el) {
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    const style = window.getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) === 0) return false;
    return true;
  }

  function elementText(el) {
    const explicit =
      el.getAttribute('aria-label') ||
      (el.tagName === 'INPUT' && el.type !== 'checkbox' && el.type !== 'radio' ? el.placeholder : null) ||
      el.getAttribute('title') ||
      el.value;
    let text = (explicit || el.innerText || el.textContent || '').replace(/\\s+/g, ' ').trim();
    if (!text && el.tagName === 'INPUT') text = el.type === 'checkbox' || el.type === 'radio' ? String(el.checked) : '';
    return text.slice(0, 80);
  }

  function roleOf(el) {
    const explicit = el.getAttribute('role');
    if (explicit) return explicit;
    const tag = el.tagName.toLowerCase();
    if (tag === 'a') return 'link';
    if (tag === 'button') return 'button';
    if (tag === 'input') return el.type === 'checkbox' ? 'checkbox' : el.type === 'radio' ? 'radio' : 'textbox';
    if (tag === 'textarea') return 'textbox';
    if (tag === 'select') return 'combobox';
    return tag;
  }

  const candidates = Array.from(document.querySelectorAll(${JSON.stringify(INTERACTIVE_SELECTOR)}));
  const kept = [];
  const seen = new Set();
  for (const el of candidates) {
    if (kept.length >= maxElements) break;
    if (!isVisible(el)) continue;
    // skip nested duplicates whose ancestor is already collected
    let ancestorCollected = false;
    for (let p = el.parentElement; p; p = p.parentElement) {
      if (seen.has(p)) { ancestorCollected = true; break }
    }
    if (ancestorCollected) continue;

    const ref = 'e' + (kept.length + 1);
    el.setAttribute(REF_ATTR, ref);
    seen.add(el);

    const item = { ref, tag: el.tagName.toLowerCase(), role: roleOf(el), text: elementText(el) };
    if (el.tagName === 'INPUT' && el.type && el.type !== 'text') item.inputType = el.type;
    if (el.value !== undefined && String(el.value).length > 0 && String(el.value).length <= 60) item.value = String(el.value).slice(0, 60);
    kept.push(item);
  }

  return {
    url: location.href,
    title: document.title,
    scrollY: Math.round(window.scrollY),
    scrollHeight: Math.round(document.documentElement.scrollHeight),
    viewportHeight: window.innerHeight,
    text: (document.body ? document.body.innerText : '').replace(/\\n{3,}/g, '\\n\\n').slice(0, maxTextChars),
    elements: kept,
  };
}
`

export async function serializePageState(
  executeJs: (code: string) => Promise<unknown>,
  budget: PageStateBudget = {}
): Promise<PageState> {
  const maxElements = budget.maxElements ?? AGENT_PAGE_MAX_ELEMENTS
  const maxTextChars = budget.maxTextChars ?? AGENT_PAGE_TEXT_CHARS
  const script = `(${COLLECT_SCRIPT_FN})(${maxElements}, ${maxTextChars})`
  const raw = (await executeJs(script)) as PageState
  if (!raw || typeof raw.url !== 'string') {
    throw new Error('PageState collection failed: invalid payload from the page')
  }
  return raw
}

/**
 * Render the PageState as the compact text view given to the model.
 * Pure function — unit-testable. Enforces the total character budget:
 * the page-text excerpt shrinks first, then trailing elements.
 */
export function formatPageState(state: PageState, budget: PageStateBudget = {}): string {
  const maxTotalChars = budget.maxTotalChars ?? AGENT_PAGE_BUDGET_CHARS
  const maxTextChars = budget.maxTextChars ?? AGENT_PAGE_TEXT_CHARS

  const header =
    `URL: ${state.url}\n` +
    `Title: ${state.title}\n` +
    `Scroll: ${state.scrollY}/${state.scrollHeight} (viewport ${state.viewportHeight})\n`

  const elementLines = state.elements.map((el) => {
    const bits = [`[${el.ref}]`, el.role, `"${el.text}"`]
    if (el.inputType) bits.push(`(type=${el.inputType})`)
    if (el.value) bits.push(`(value="${el.value}")`)
    return bits.join(' ')
  })

  let textExcerpt = state.text.slice(0, maxTextChars)

  // Enforce the total budget: shrink the text excerpt, then drop trailing elements.
  let total = header.length + elementLines.join('\n').length + textExcerpt.length
  if (total > maxTotalChars) {
    const overflow = total - maxTotalChars
    textExcerpt = textExcerpt.slice(0, Math.max(0, textExcerpt.length - overflow))
    total = header.length + elementLines.join('\n').length + textExcerpt.length
  }
  while (total > maxTotalChars && elementLines.length > 0) {
    const removed = elementLines.pop() as string
    total -= removed.length + 1
  }

  const parts = [header]
  if (elementLines.length > 0) {
    parts.push('Interactive elements:\n' + elementLines.join('\n'))
  } else {
    parts.push('Interactive elements: none detected')
  }
  if (textExcerpt.trim()) {
    parts.push('Page text excerpt:\n' + textExcerpt)
  }
  return parts.join('\n')
}
