/**
 * Known tracker domains used for ad-tech, analytics, fingerprinting,
 * and cross-site user tracking. This is a curated list of common trackers
 * and is not exhaustive.
 */
const KNOWN_TRACKERS: ReadonlySet<string> = new Set([
  // Google
  'google-analytics.com',
  'googletagmanager.com',
  'googlesyndication.com',
  'googleadservices.com',
  'googel.com',

  // Facebook / Meta
  'facebook.net',
  'facebook.com',
  'fbcdn.net',
  'connect.facebook.net',

  // Advertising networks
  'doubleclick.net',
  'adnxs.com',
  'adsrvr.org',
  'amazon-adsystem.com',
  'rubiconproject.com',
  'openx.net',
  'pubmatic.com',
  'indexww.com',
  'casalemedia.com',
  'criteo.com',
  'demdex.net',
  'moatads.com',

  // Analytics & tracking
  'hotjar.com',
  'mixpanel.com',
  'segment.io',
  'segment.com',
  'amplitude.com',
  'fullstory.com',
  'mouseflow.com',
  'crazyegg.com',
  'optimizely.com',

  // Ad verification & measurement
  'quantserve.com',
  'scorecardresearch.com',
  'comscore.com',
  'moat.com',

  // Social widgets & pixels
  'twitter.com/i/',
  'analytics.twitter.com',
  'linkedin.com/li/',
  'sharethis.com',
  'addthis.com',
])

export class TrackerDetector {
  private trackerDomains: Set<string>

  constructor(customTrackers?: string[]) {
    if (customTrackers) {
      this.trackerDomains = new Set([...KNOWN_TRACKERS, ...customTrackers])
    } else {
      this.trackerDomains = new Set(KNOWN_TRACKERS)
    }
  }

  /**
   * Checks whether a domain string is a known tracker.
   * Also checks whether any parent domain is a known tracker
   * (e.g. "static.doubleclick.net" matches "doubleclick.net").
   */
  isTracker(domain: string): boolean {
    const normalizedDomain = domain.toLowerCase().trim()
    if (normalizedDomain === '') {
      return false
    }

    // Direct match
    if (this.trackerDomains.has(normalizedDomain)) {
      return true
    }

    // Check parent domains (e.g. sub.tracker.com => tracker.com)
    const parts = normalizedDomain.split('.')
    for (let i = 1; i < parts.length - 1; i++) {
      const parentDomain = parts.slice(i).join('.')
      if (this.trackerDomains.has(parentDomain)) {
        return true
      }
    }

    return false
  }

  /**
   * Parses a URL and checks whether its hostname refers to a known tracker domain.
   */
  detect(url: string): boolean {
    if (!url || typeof url !== 'string') {
      return false
    }

    try {
      const parsed = new URL(url)
      return this.isTracker(parsed.hostname)
    } catch {
      // URL parsing failed, try a simple host extraction
      const hostMatch = url.match(/^https?:\/\/([^/]+)/)
      if (hostMatch && hostMatch[1]) {
        const hostname = hostMatch[1].split(':')[0] // strip port
        return this.isTracker(hostname)
      }
      return false
    }
  }

  /**
   * Returns the full list of known tracker domain strings.
   */
  getTrackerList(): string[] {
    return Array.from(this.trackerDomains).sort()
  }
}
