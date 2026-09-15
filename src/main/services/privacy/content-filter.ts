import type { Session } from 'electron'
import { TrackerDetector } from './tracker-detector'

export interface FilterStats {
  blocked: number
  lastBlockedUrl: string | null
}

export interface TotalFilterStats {
  requestsBlocked: number
  adsBlocked: number
  trackersBlocked: number
}

export interface EnabledCategories {
  ads: boolean
  trackers: boolean
  annoyances: boolean
}

interface FilterRule {
  /** URL substring or regex pattern to match */
  pattern: string
  /** Whether the pattern is a regex (default: false, treated as substring) */
  isRegex: boolean
  /** Resource types to block (empty means all types) */
  resourceTypes: string[]
  /** Category label */
  category: 'ad' | 'tracker' | 'annoyance'
}

const BUILT_IN_RULES: FilterRule[] = [
  // Common ad patterns
  { pattern: '/ads/', isRegex: false, resourceTypes: [], category: 'ad' },
  { pattern: '/ad.js', isRegex: false, resourceTypes: [], category: 'ad' },
  { pattern: '/ads.js', isRegex: false, resourceTypes: [], category: 'ad' },
  { pattern: '/advert', isRegex: false, resourceTypes: [], category: 'ad' },
  { pattern: '/banner', isRegex: false, resourceTypes: [], category: 'ad' },
  { pattern: 'doubleclick.net', isRegex: false, resourceTypes: [], category: 'ad' },
  { pattern: 'googlesyndication.com', isRegex: false, resourceTypes: [], category: 'ad' },
  { pattern: 'googleadservices.com', isRegex: false, resourceTypes: [], category: 'ad' },
  { pattern: 'googleads.g.doubleclick.net', isRegex: false, resourceTypes: [], category: 'ad' },
  { pattern: 'adnxs.com', isRegex: false, resourceTypes: [], category: 'ad' },
  { pattern: 'adsrvr.org', isRegex: false, resourceTypes: [], category: 'ad' },
  { pattern: 'taboola.com', isRegex: false, resourceTypes: [], category: 'ad' },
  { pattern: 'outbrain.com', isRegex: false, resourceTypes: [], category: 'ad' },
  { pattern: 'popads.net', isRegex: false, resourceTypes: [], category: 'ad' },
  { pattern: 'adroll.com', isRegex: false, resourceTypes: [], category: 'ad' },
  { pattern: 'criteo.com', isRegex: false, resourceTypes: [], category: 'ad' },
  { pattern: 'moatads.com', isRegex: false, resourceTypes: [], category: 'ad' },
  { pattern: 'amazon-adsystem.com', isRegex: false, resourceTypes: [], category: 'ad' },

  // Tracker patterns
  { pattern: 'google-analytics.com', isRegex: false, resourceTypes: [], category: 'tracker' },
  { pattern: 'googletagmanager.com', isRegex: false, resourceTypes: [], category: 'tracker' },
  { pattern: 'facebook.net/en_US/fbevents', isRegex: false, resourceTypes: [], category: 'tracker' },
  { pattern: 'connect.facebook.net', isRegex: false, resourceTypes: [], category: 'tracker' },
  { pattern: 'analytics.twitter.com', isRegex: false, resourceTypes: [], category: 'tracker' },
  { pattern: 'hotjar.com', isRegex: false, resourceTypes: [], category: 'tracker' },
  { pattern: 'mixpanel.com', isRegex: false, resourceTypes: [], category: 'tracker' },
  { pattern: 'segment.io', isRegex: false, resourceTypes: [], category: 'tracker' },
  { pattern: 'segment.com/v1', isRegex: false, resourceTypes: [], category: 'tracker' },
  { pattern: 'amplitude.com', isRegex: false, resourceTypes: [], category: 'tracker' },
  { pattern: 'fullstory.com', isRegex: false, resourceTypes: [], category: 'tracker' },
  { pattern: 'mouseflow.com', isRegex: false, resourceTypes: [], category: 'tracker' },
  { pattern: 'crazyegg.com', isRegex: false, resourceTypes: [], category: 'tracker' },
  { pattern: 'quantserve.com', isRegex: false, resourceTypes: [], category: 'tracker' },
  { pattern: 'scorecardresearch.com', isRegex: false, resourceTypes: [], category: 'tracker' },

  // Annoyance patterns
  { pattern: 'notification-pixel', isRegex: false, resourceTypes: [], category: 'annoyance' },
  { pattern: '/push-notification', isRegex: false, resourceTypes: [], category: 'annoyance' },
  {
    pattern: '(\\.|\\/)(popunder|popup|overlay|interstitial)\\.(js|html)',
    isRegex: true,
    resourceTypes: [],
    category: 'annoyance',
  },
]

export class ContentFilter {
  private rules: FilterRule[] = []
  private stats = new Map<number, { blocked: number; lastBlockedUrl: string | null; ads: number; trackers: number }>()
  private trackerDetector: TrackerDetector
  private installedSessions = new WeakSet<Session>()
  private enabled: EnabledCategories = { ads: true, trackers: true, annoyances: true }

  constructor() {
    this.trackerDetector = new TrackerDetector()
    this.loadRules()
  }

  /**
   * Installs the content filter on a given Electron session.
   * Intercepts web requests and blocks those matching filter rules or tracker domains.
   * The listener is cheap when all categories are disabled (single flag check).
   */
  installSessionFilter(session: Session): void {
    if (this.installedSessions.has(session)) {
      return
    }

    session.webRequest.onBeforeRequest((details, callback) => {
      const matchedCategory = this.findMatchingCategory(details.url)

      if (matchedCategory) {
        const tabId = details.id
        const current = this.stats.get(tabId)
        if (current) {
          current.blocked += 1
          if (matchedCategory === 'ad') current.ads += 1
          if (matchedCategory === 'tracker') current.trackers += 1
          current.lastBlockedUrl = details.url
        } else {
          this.stats.set(tabId, {
            blocked: 1,
            lastBlockedUrl: details.url,
            ads: matchedCategory === 'ad' ? 1 : 0,
            trackers: matchedCategory === 'tracker' ? 1 : 0,
          })
        }

        callback({ cancel: true })
      } else {
        callback({})
      }
    })

    this.installedSessions.add(session)
  }

  /**
   * Enable/disable blocking per category (bound to user settings).
   */
  setCategoriesEnabled(enabled: EnabledCategories): void {
    this.enabled = enabled
  }

  getCategoriesEnabled(): EnabledCategories {
    return { ...this.enabled }
  }

  /**
   * Loads built-in filter rules into memory.
   */
  loadRules(): void {
    this.rules = [...BUILT_IN_RULES]
  }

  /**
   * Returns the number of blocked requests for a given tab/request ID.
   */
  getStats(tabId: number): FilterStats {
    const entry = this.stats.get(tabId)
    return {
      blocked: entry?.blocked ?? 0,
      lastBlockedUrl: entry?.lastBlockedUrl ?? null,
    }
  }

  /**
   * Aggregated blocked-request counts across all tabs, for the privacy dashboard.
   */
  getTotalStats(): TotalFilterStats {
    let requestsBlocked = 0
    let adsBlocked = 0
    let trackersBlocked = 0
    for (const entry of this.stats.values()) {
      requestsBlocked += entry.blocked
      adsBlocked += entry.ads
      trackersBlocked += entry.trackers
    }
    return { requestsBlocked, adsBlocked, trackersBlocked }
  }

  /**
   * Clears all accumulated filter statistics.
   */
  reset(): void {
    this.stats.clear()
  }

  /**
   * Returns the category of the first matching rule for a URL,
   * or null when the request is allowed (or its category is disabled).
   */
  private findMatchingCategory(url: string): FilterRule['category'] | null {
    // Check tracker domains first
    if (this.enabled.trackers && this.trackerDetector.detect(url)) {
      return 'tracker'
    }

    // Check against filter rules
    for (const rule of this.rules) {
      if (!this.isCategoryEnabled(rule.category)) continue

      let matched = false
      if (rule.isRegex) {
        try {
          const regex = new RegExp(rule.pattern, 'i')
          matched = regex.test(url)
        } catch {
          // Invalid regex, skip
        }
      } else {
        matched = url.toLowerCase().includes(rule.pattern.toLowerCase())
      }

      if (matched) return rule.category
    }

    return null
  }

  private isCategoryEnabled(category: FilterRule['category']): boolean {
    if (category === 'ad') return this.enabled.ads
    if (category === 'tracker') return this.enabled.trackers
    return this.enabled.annoyances
  }
}
