import { describe, it, expect } from 'vitest'
import { htmlToMarkdown } from '../../src/renderer/services/html-to-markdown'

describe('htmlToMarkdown', () => {
  it('converts headings h1–h6', () => {
    expect(htmlToMarkdown('<h1>Title</h1>')).toBe('# Title')
    expect(htmlToMarkdown('<h2>Subtitle</h2>')).toBe('## Subtitle')
    expect(htmlToMarkdown('<h3>Section</h3>')).toBe('### Section')
    expect(htmlToMarkdown('<h4>Deep</h4>')).toBe('#### Deep')
    expect(htmlToMarkdown('<h5>Deeper</h5>')).toBe('##### Deeper')
    expect(htmlToMarkdown('<h6>Deepest</h6>')).toBe('###### Deepest')
  })

  it('converts paragraphs', () => {
    const md = htmlToMarkdown('<p>Hello world</p>')
    expect(md).toBe('Hello world')
  })

  it('converts bold and italic', () => {
    expect(htmlToMarkdown('<strong>bold</strong>')).toBe('**bold**')
    expect(htmlToMarkdown('<b>bold</b>')).toBe('**bold**')
    expect(htmlToMarkdown('<em>italic</em>')).toBe('*italic*')
    expect(htmlToMarkdown('<i>italic</i>')).toBe('*italic*')
  })

  it('converts strikethrough', () => {
    expect(htmlToMarkdown('<del>deleted</del>')).toBe('~~deleted~~')
    expect(htmlToMarkdown('<s>struck</s>')).toBe('~~struck~~')
  })

  it('converts links', () => {
    const md = htmlToMarkdown('<a href="https://example.com">click here</a>')
    expect(md).toBe('[click here](https://example.com)')
  })

  it('converts images', () => {
    const md = htmlToMarkdown('<img src="photo.jpg" alt="A photo">')
    expect(md).toBe('![A photo](photo.jpg)')
  })

  it('converts unordered lists', () => {
    const md = htmlToMarkdown('<ul><li>one</li><li>two</li><li>three</li></ul>')
    expect(md).toContain('- one')
    expect(md).toContain('- two')
    expect(md).toContain('- three')
  })

  it('converts ordered lists', () => {
    const md = htmlToMarkdown('<ol><li>first</li><li>second</li><li>third</li></ol>')
    expect(md).toContain('1. first')
    expect(md).toContain('2. second')
    expect(md).toContain('3. third')
  })

  it('converts inline code', () => {
    const md = htmlToMarkdown('<code>const x = 1</code>')
    expect(md).toBe('`const x = 1`')
  })

  it('converts code blocks with language', () => {
    const md = htmlToMarkdown('<pre><code class="language-typescript">const x: number = 1</code></pre>')
    expect(md).toContain('```typescript')
    expect(md).toContain('const x: number = 1')
    expect(md).toContain('```')
  })

  it('converts code blocks without language', () => {
    const md = htmlToMarkdown('<pre><code>plain code</code></pre>')
    expect(md).toContain('```\nplain code\n```')
  })

  it('converts blockquotes', () => {
    const md = htmlToMarkdown('<blockquote>To be or not to be</blockquote>')
    expect(md).toContain('> To be or not to be')
  })

  it('converts horizontal rules', () => {
    const md = htmlToMarkdown('<hr>')
    expect(md).toBe('---')
  })

  it('converts tables', () => {
    const html = `
      <table>
        <thead><tr><th>Name</th><th>Age</th></tr></thead>
        <tbody>
          <tr><td>Alice</td><td>30</td></tr>
          <tr><td>Bob</td><td>25</td></tr>
        </tbody>
      </table>
    `
    const md = htmlToMarkdown(html)
    expect(md).toContain('| Name | Age |')
    expect(md).toContain('| --- | --- |')
    expect(md).toContain('| Alice | 30 |')
    expect(md).toContain('| Bob | 25 |')
  })

  it('handles nested inline elements', () => {
    const md = htmlToMarkdown('<p>This is <strong>bold <em>and italic</em></strong> text</p>')
    expect(md).toContain('**bold *and italic***')
  })

  it('skips script and style tags', () => {
    const md = htmlToMarkdown('<p>Hello</p><script>alert("xss")</script><style>body{}</style>')
    expect(md).not.toContain('alert')
    expect(md).not.toContain('body{}')
    expect(md).toContain('Hello')
  })

  it('skips noscript, iframe, svg, canvas', () => {
    const md = htmlToMarkdown('<p>Content</p><noscript>no</noscript><iframe src="x"></iframe><svg></svg><canvas></canvas>')
    expect(md).not.toContain('noscript')
    expect(md).not.toContain('iframe')
    expect(md).toContain('Content')
  })

  it('handles empty input', () => {
    expect(htmlToMarkdown('')).toBe('')
  })

  it('handles plain text', () => {
    const md = htmlToMarkdown('Just some text')
    expect(md).toContain('Just some text')
  })

  it('converts figure with img (extracts image)', () => {
    const md = htmlToMarkdown('<figure><img src="pic.jpg" alt="Photo"><figcaption>Caption</figcaption></figure>')
    expect(md).toContain('![Photo](pic.jpg)')
  })

  it('collapses excessive blank lines', () => {
    const md = htmlToMarkdown('<h1>A</h1><p>B</p><h2>C</h2>')
    expect(md).not.toMatch(/\n{3,}/)
  })

  it('handles links with no text', () => {
    const md = htmlToMarkdown('<a href="https://example.com"></a>')
    expect(md).not.toContain('example.com')
  })

  it('converts a full article HTML to markdown', () => {
    const html = `
      <h1>Breaking News</h1>
      <p>This is an <strong>important</strong> article by <a href="/author">Jane</a>.</p>
      <ul>
        <li>Point one</li>
        <li>Point two</li>
      </ul>
      <blockquote>A wise quote</blockquote>
      <p>End of article.</p>
    `
    const md = htmlToMarkdown(html)
    expect(md).toContain('# Breaking News')
    expect(md).toContain('**important**')
    expect(md).toContain('[Jane](/author)')
    expect(md).toContain('- Point one')
    expect(md).toContain('> A wise quote')
    expect(md).toContain('End of article.')
  })
})
