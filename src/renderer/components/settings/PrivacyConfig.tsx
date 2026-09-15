import { useState, useEffect } from 'react'

interface PrivacySettings {
  blockAds: boolean
  blockTrackers: boolean
  fingerprintProtection: boolean
}

interface PrivacyStats {
  trackersBlocked: number
  adsBlocked: number
  requestsSaved: number
}

export function PrivacyConfig(): React.ReactElement {
  const [settings, setSettings] = useState<PrivacySettings>({
    blockAds: true,
    blockTrackers: true,
    fingerprintProtection: false,
  })
  const [privacyMode, setPrivacyMode] = useState(false)
  const [stats, setStats] = useState<PrivacyStats>({ trackersBlocked: 0, adsBlocked: 0, requestsSaved: 0 })

  // Load persisted privacy settings + current privacy mode
  useEffect(() => {
    window.api
      .settingsGet()
      .then((raw: Record<string, unknown>) => {
        const privacy = raw?.privacy as Record<string, unknown> | undefined
        if (privacy) {
          setSettings({
            blockAds: (privacy.blockAds as boolean) ?? true,
            blockTrackers: (privacy.blockTrackers as boolean) ?? true,
            fingerprintProtection: (privacy.fingerprintProtection as boolean) ?? false,
          })
        }
      })
      .catch(() => {})
  }, [])

  // Poll live filter stats while the panel is open
  useEffect(() => {
    let cancelled = false
    const load = (): void => {
      window.api
        .privacyStats()
        .then((s: unknown) => {
          if (!cancelled) setStats(s as PrivacyStats)
        })
        .catch(() => {})
    }
    load()
    const timer = setInterval(load, 3000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [])

  const toggle = (key: keyof PrivacySettings): void => {
    setSettings((prev) => {
      const next = { ...prev, [key]: !prev[key] }
      if (key === 'blockAds' || key === 'blockTrackers') {
        // Persist and apply immediately (no restart needed)
        window.api
          .privacyFiltersSet({ blockAds: next.blockAds, blockTrackers: next.blockTrackers })
          .catch(() => {})
      } else {
        // Applies to pages loaded after the change
        window.api.settingsSet('privacy.fingerprintProtection', next.fingerprintProtection).catch(() => {})
      }
      return next
    })
  }

  const toggleMode = (): void => {
    window.api
      .privacyModeToggle()
      .then((enabled: boolean) => setPrivacyMode(enabled))
      .catch(() => {})
  }

  return (
    <div className="space-y-4">
      {/* Privacy mode */}
      <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-gray-800 dark:text-gray-200">
              Privacy Browsing Mode
            </div>
            <div className="text-xs text-gray-400">
              Force local-only AI processing (cloud providers disabled)
            </div>
          </div>
          <button
            onClick={toggleMode}
            className={`relative h-6 w-11 rounded-full transition-colors ${
              privacyMode ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
            }`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                privacyMode ? 'translate-x-5.5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Content filtering */}
      <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
        Content Filtering
      </div>

      <ToggleRow
        label="Block Ads"
        description="Remove advertisements from web pages"
        enabled={settings.blockAds}
        onToggle={() => toggle('blockAds')}
      />
      <ToggleRow
        label="Block Trackers"
        description="Prevent tracking scripts from loading"
        enabled={settings.blockTrackers}
        onToggle={() => toggle('blockTrackers')}
      />
      <ToggleRow
        label="Fingerprint Protection"
        description="Randomize browser fingerprint (applies to newly loaded pages)"
        enabled={settings.fingerprintProtection}
        onToggle={() => toggle('fingerprintProtection')}
      />

      {/* Privacy stats */}
      <div className="border-t border-gray-200 pt-3 dark:border-gray-700">
        <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Session Statistics
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <StatCard label="Trackers Blocked" value={String(stats.trackersBlocked)} />
          <StatCard label="Ads Blocked" value={String(stats.adsBlocked)} />
          <StatCard label="Requests Blocked" value={String(stats.requestsSaved)} />
        </div>
      </div>
    </div>
  )
}

function ToggleRow({
  label,
  description,
  enabled,
  onToggle,
}: {
  label: string
  description: string
  enabled: boolean
  onToggle: () => void
}): React.ReactElement {
  return (
    <div className="flex items-center justify-between rounded-lg border border-gray-200 p-3 dark:border-gray-700">
      <div>
        <div className="text-sm text-gray-700 dark:text-gray-300">{label}</div>
        <div className="text-xs text-gray-400">{description}</div>
      </div>
      <button
        onClick={onToggle}
        className={`relative h-6 w-11 rounded-full transition-colors ${
          enabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
            enabled ? 'translate-x-5.5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  )
}

function StatCard({
  label,
  value,
}: {
  label: string
  value: string
}): React.ReactElement {
  return (
    <div className="rounded-lg border border-gray-200 p-2 dark:border-gray-700">
      <div className="text-lg font-semibold text-gray-800 dark:text-gray-200">{value}</div>
      <div className="text-[10px] text-gray-400">{label}</div>
    </div>
  )
}
