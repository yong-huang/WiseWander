/**
 * Pure TypeScript HTML → Markdown converter.
 * Uses the renderer process DOMParser to parse HTML, then recursively
 * walks the DOM tree to produce clean Markdown output.
 */

/**
 * Convert an HTML string to Markdown.
 */
export function htmlToMarkdown(html: string): string {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const body = doc.body
  if (!body) return ''
  return trimMarkdown(convertNode(body))
}

// ── Node conversion ──

function convertNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return escapeMd((node.textContent || '').replace(/\s+/g, ' '))
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return ''

  const el = node as HTMLElement
  const tag = el.tagName.toLowerCase()
  const children = convertChildren(el)

  switch (tag) {
    case 'h1': return `\n\n# ${children.trim()}\n\n`
    case 'h2': return `\n\n## ${children.trim()}\n\n`
    case 'h3': return `\n\n### ${children.trim()}\n\n`
    case 'h4': return `\n\n#### ${children.trim()}\n\n`
    case 'h5': return `\n\n##### ${children.trim()}\n\n`
    case 'h6': return `\n\n###### ${children.trim()}\n\n`

    case 'p': return `\n\n${children.trim()}\n\n`

    case 'strong':
    case 'b': return `**${children}**`

    case 'em':
    case 'i': return `*${children}*`

    case 'del':
    case 's': return `~~${children}~~`

    case 'a': {
      const href = el.getAttribute('href') || ''
      const text = children.trim()
      if (!text) return ''
      return `[${text}](${href})`
    }

    case 'img': {
      const src = el.getAttribute('src') || ''
      const alt = el.getAttribute('alt') || ''
      return `![${alt}](${src})`
    }

    case 'ul': return `\n\n${convertListItems(el, false)}\n`
    case 'ol': return `\n\n${convertListItems(el, true)}\n`

    case 'li': {
      // Standalone <li> (shouldn't happen, but handle gracefully)
      return `- ${children.trim()}\n`
    }

    case 'pre': {
      const codeEl = el.querySelector('code')
      if (codeEl) {
        const lang = extractLang(codeEl)
        const text = codeEl.textContent || ''
        return `\n\n\`\`\`${lang}\n${text}\n\`\`\`\n\n`
      }
      return `\n\n\`\`\`\n${el.textContent || ''}\n\`\`\`\n\n`
    }

    case 'code': {
      // Inline code (block code is handled by <pre>)
      const text = el.textContent || ''
      if (text.includes('\n')) return `\`\`\`\n${text}\n\`\`\``
      return `\`${text}\``
    }

    case 'blockquote': {
      const lines = children.trim().split('\n')
      return `\n\n${lines.map((l: string) => `> ${l}`).join('\n')}\n\n`
    }

    case 'hr': return '\n\n---\n\n'

    case 'br': return '\n'

    case 'table': return `\n\n${convertTable(el)}\n\n`

    case 'figure': {
      const img = el.querySelector('img')
      if (img) return convertNode(img)
      return children
    }

    case 'figcaption': return ''
    case 'sup': return children

    case 'div':
    case 'section':
    case 'article':
    case 'main':
    case 'span':
    case 'time':
    case 'small':
    case 'mark':
    case 'abbr':
    case 'cite':
    case 'address':
      return children

    // Skip these entirely
    case 'script':
    case 'style':
    case 'noscript':
    case 'svg':
    case 'canvas':
    case 'iframe':
    case 'form':
    case 'input':
    case 'button':
    case 'select':
    case 'textarea':
      return ''

    default:
      return children
  }
}

function convertChildren(el: HTMLElement): string {
  let result = ''
  for (const child of Array.from(el.childNodes)) {
    result += convertNode(child)
  }
  return result
}

// ── Lists ──

function convertListItems(listEl: HTMLElement, ordered: boolean): string {
  const items = Array.from(listEl.children).filter(
    (c) => c.tagName.toLowerCase() === 'li'
  )
  let out = ''
  items.forEach((li, i) => {
    const prefix = ordered ? `${i + 1}. ` : '- '
    const text = convertChildren(li as HTMLElement).trim()
    // Handle nested lists
    const nested = li.querySelector('ul, ol')
    if (nested) {
      const nestedMd = convertNode(nested).trim()
      const mainText = text.replace(convertNode(nested).trim(), '').trim()
      out += `${prefix}${mainText}\n`
      // Indent nested items
      const nestedLines = nestedMd.split('\n').filter((l: string) => l.trim())
      nestedLines.forEach((line: string) => {
        out += `  ${line}\n`
      })
    } else {
      out += `${prefix}${text}\n`
    }
  })
  return out
}

// ── Tables ──

function convertTable(tableEl: HTMLElement): string {
  const thead = tableEl.querySelector('thead')
  const tbody = tableEl.querySelector('tbody')
  const rows = Array.from(tableEl.querySelectorAll('tr'))

  if (rows.length === 0) return ''

  let md = ''

  // First row as header
  const headerRow = rows[0]
  const headers = Array.from(headerRow.querySelectorAll('th, td'))
  const headerTexts = headers.map((c) => (c.textContent || '').trim().replace(/\|/g, '\\|'))
  md += `| ${headerTexts.join(' | ')} |\n`
  md += `| ${headerTexts.map(() => '---').join(' | ')} |\n`

  // Data rows
  const dataRows = (thead ? Array.from((tbody || tableEl).querySelectorAll('tr')) : rows.slice(1))
  dataRows.forEach((row) => {
    // Skip if this is the same thead row
    if (row === headerRow) return
    const cells = Array.from(row.querySelectorAll('td, th'))
    const cellTexts = cells.map((c) => (c.textContent || '').trim().replace(/\|/g, '\\|'))
    if (cellTexts.length > 0) {
      md += `| ${cellTexts.join(' | ')} |\n`
    }
  })

  return md
}

// ── Helpers ──

function extractLang(codeEl: Element): string {
  const cls = codeEl.getAttribute('class') || ''
  const match = cls.match(/language-(\w+)/)
  return match ? match[1] : ''
}

function escapeMd(text: string): string {
  // Don't escape inside code blocks — handled separately
  return text
}

function trimMarkdown(md: string): string {
  return md
    .replace(/\n{3,}/g, '\n\n') // Collapse excessive blank lines
    .replace(/^\n+/, '')         // Trim leading newlines
    .replace(/\n+$/, '')         // Trim trailing newlines
}
