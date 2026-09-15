import { describe, it, expect } from 'vitest'
import { formatPageState, type PageState } from '../../../../../src/main/services/agent/page-state'

function makeState(overrides: Partial<PageState> = {}): PageState {
  return {
    url: 'https://example.com/search?q=ww',
    title: 'Example Search',
    scrollY: 120,
    scrollHeight: 2400,
    viewportHeight: 800,
    text: 'Search results page body text.',
    elements: [
      { ref: 'e1', tag: 'a', role: 'link', text: 'Sign in' },
      { ref: 'e2', tag: 'input', role: 'textbox', text: 'Search', inputType: 'search', value: 'ww' },
      { ref: 'e3', tag: 'button', role: 'button', text: 'Submit' },
    ],
    ...overrides,
  }
}

describe('formatPageState', () => {
  it('renders header, elements, and text excerpt', () => {
    const out = formatPageState(makeState())
    expect(out).toContain('URL: https://example.com/search?q=ww')
    expect(out).toContain('Title: Example Search')
    expect(out).toContain('Scroll: 120/2400 (viewport 800)')
    expect(out).toContain('[e1] link "Sign in"')
    expect(out).toContain('[e2] textbox "Search" (type=search) (value="ww")')
    expect(out).toContain('[e3] button "Submit"')
    expect(out).toContain('Page text excerpt:')
  })

  it('reports when no interactive elements exist', () => {
    const out = formatPageState(makeState({ elements: [] }))
    expect(out).toContain('Interactive elements: none detected')
  })

  it('shrinks the text excerpt to respect the total budget', () => {
    const long = 'x'.repeat(20_000)
    const out = formatPageState(makeState({ text: long }), { maxTotalChars: 2_000 })
    expect(out.length).toBeLessThanOrEqual(2_100) // small slack for the final join
    expect(out).toContain('[e1] link "Sign in"') // elements survive, text shrinks first
  })

  it('drops trailing elements as a last resort', () => {
    const elements = Array.from({ length: 200 }, (_, i) => ({
      ref: `e${i + 1}`,
      tag: 'a',
      role: 'link',
      text: `item ${i} ${'y'.repeat(40)}`,
    }))
    const out = formatPageState(makeState({ elements, text: '' }), { maxTotalChars: 1_500 })
    expect(out.length).toBeLessThanOrEqual(1_600)
    expect(out).toContain('[e1]') // first element kept
  })

  it('caps the raw text excerpt at maxTextChars when budget allows', () => {
    const out = formatPageState(makeState({ text: 'z'.repeat(9_000) }), { maxTextChars: 1_000 })
    expect(out).not.toContain('z'.repeat(1_001))
  })
})
