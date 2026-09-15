import type { ChatMessage, A11yIssue, A11yAuditResult, A11ySeverity } from '../../../shared/types'
import type { ModelRouter } from '../ai/router'

interface RuleCheck {
  rule: string
  severity: A11ySeverity
  selector: string
  description: string
  suggestion: string
  check: (html: string) => boolean
}

const RULES: RuleCheck[] = [
  {
    rule: 'img-alt-missing',
    severity: 'critical',
    selector: 'img',
    description: 'Images must have alt text',
    suggestion: 'Add a descriptive alt attribute: <img alt="description of image">',
    check: (html) => /<img(?![^>]*\balt\s*=)/i.test(html),
  },
  {
    rule: 'img-alt-empty',
    severity: 'warning',
    selector: 'img[alt=""]',
    description: 'Image has empty alt text',
    suggestion: 'Provide meaningful alt text, or use alt="" only for decorative images',
    check: (html) => /<img[^>]*\balt\s*=\s*["']\s*["'][^>]*>/i.test(html),
  },
  {
    rule: 'label-missing',
    severity: 'critical',
    selector: 'input, select, textarea',
    description: 'Form inputs should have associated labels',
    suggestion: 'Add a <label> element with a matching for/id, or use aria-label',
    check: (html) => /<(input|select|textarea)[^>]*>/i.test(html) && !/<label/i.test(html),
  },
  {
    rule: 'lang-attr-missing',
    severity: 'critical',
    selector: 'html',
    description: 'HTML document must have a lang attribute',
    suggestion: 'Add lang attribute: <html lang="en">',
    check: (html) => !/<html[^>]*\blang\s*=/i.test(html),
  },
  {
    rule: 'empty-links',
    severity: 'warning',
    selector: 'a',
    description: 'Links should not be empty',
    suggestion: 'Add text content or an aria-label to the link',
    check: (html) => /<a[^>]*>\s*<\/a>/i.test(html),
  },
  {
    rule: 'empty-buttons',
    severity: 'warning',
    selector: 'button',
    description: 'Buttons should not be empty',
    suggestion: 'Add text content or an aria-label to the button',
    check: (html) => /<button[^>]*>\s*<\/button>/i.test(html),
  },
  {
    rule: 'heading-skip',
    severity: 'warning',
    selector: 'h1, h2, h3, h4, h5, h6',
    description: 'Heading levels should not be skipped',
    suggestion: 'Use headings in logical order (h1 > h2 > h3)',
    check: (html) => {
      const headings = html.match(/<h([1-6])\b/gi)
      if (!headings || headings.length < 2) return false
      const levels = headings.map((h) => parseInt(h.replace(/<h/i, '')))
      for (let i = 1; i < levels.length; i++) {
        if (levels[i] - levels[i - 1] > 1) return true
      }
      return false
    },
  },
  {
    rule: 'title-missing',
    severity: 'critical',
    selector: 'title',
    description: 'Document must have a <title> element',
    suggestion: 'Add a <title> element inside <head>',
    check: (html) => !/<title\b/i.test(html),
  },
  {
    rule: 'meta-viewport-missing',
    severity: 'info',
    selector: 'meta[name="viewport"]',
    description: 'Page should have a viewport meta tag for mobile responsiveness',
    suggestion: 'Add: <meta name="viewport" content="width=device-width, initial-scale=1.0">',
    check: (html) => !/<meta[^>]*\bname\s*=\s*["']viewport["']/i.test(html),
  },
  {
    rule: 'aria-hidden-focusable',
    severity: 'critical',
    selector: '[aria-hidden="true"]',
    description: 'Element with aria-hidden should not be focusable',
    suggestion: 'Remove tabindex or aria-hidden from this element',
    check: (html) => /aria-hidden\s*=\s*["']true["'][^>]*tabindex/i.test(html) ||
      /tabindex[^>]*aria-hidden\s*=\s*["']true["']/i.test(html),
  },
]

const AI_SYSTEM_PROMPT = `You are an accessibility audit expert. Analyze the provided HTML and identify accessibility issues that may not be caught by simple regex rules.

Focus on:
- Semantic HTML usage (using proper elements instead of divs)
- ARIA roles and attributes (misuse, missing, redundant)
- Color contrast issues (if CSS is provided)
- Keyboard navigation issues
- Screen reader compatibility
- Focus management

Return a JSON array of issue objects. Each object has:
- "rule": string identifier (e.g., "semantic-heading", "aria-role-misuse")
- "severity": "critical" | "warning" | "info"
- "selector": CSS selector for the problematic element
- "description": what the issue is
- "suggestion": how to fix it

Return ONLY the JSON array, no markdown or explanation.`

export class AccessibilityAuditor {
  private router: ModelRouter

  constructor(router: ModelRouter) {
    this.router = router
  }

  async audit(html: string): Promise<A11yAuditResult> {
    // Phase 1: Rule-based checks
    const ruleIssues: A11yIssue[] = []
    for (const rule of RULES) {
      if (rule.check(html)) {
        ruleIssues.push({
          severity: rule.severity,
          rule: rule.rule,
          selector: rule.selector,
          description: rule.description,
          suggestion: rule.suggestion,
        })
      }
    }

    // Phase 2: AI analysis
    let aiIssues: A11yIssue[] = []
    try {
      const messages: ChatMessage[] = [
        { role: 'system', content: AI_SYSTEM_PROMPT },
        { role: 'user', content: html.slice(0, 50_000) },
      ]
      const rawText = await this.router.chatSync(messages)
      const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      aiIssues = JSON.parse(cleaned) as A11yIssue[]
    } catch {
      // AI analysis failed, continue with rule-based results only
    }

    // Merge and deduplicate
    const allIssues = [...ruleIssues, ...aiIssues]
    const seen = new Set<string>()
    const issues = allIssues.filter((issue) => {
      const key = `${issue.rule}:${issue.selector}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    // Calculate score: start at 100, deduct based on severity
    let score = 100
    for (const issue of issues) {
      if (issue.severity === 'critical') score -= 10
      else if (issue.severity === 'warning') score -= 5
      else score -= 1
    }
    score = Math.max(0, score)

    const summary = `Found ${issues.length} accessibility issues: ${issues.filter((i) => i.severity === 'critical').length} critical, ${issues.filter((i) => i.severity === 'warning').length} warnings, ${issues.filter((i) => i.severity === 'info').length} info.`

    return { score, issues, summary }
  }
}
