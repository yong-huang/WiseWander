import { useState, useEffect } from 'react'
import { ModelConfig } from './ModelConfig'
import { PrivacyConfig } from './PrivacyConfig'
import { useSettingsStore } from '../../store/settings-store'

type SettingsTab = 'general' | 'models' | 'privacy' | 'shortcuts' | 'about'

interface SettingsPageProps {
  onClose: () => void
}

interface GeneralFormState {
  theme: string
  searchEngine: string
  homePage: string
  downloadPath: string
  showBookmarkBar: boolean
  sidebarWidth: number
  smartTabNaming: boolean
}

const DEFAULT_GENERAL: GeneralFormState = {
  theme: 'system',
  searchEngine: 'google',
  homePage: 'https://www.google.com',
  downloadPath: '~/Downloads',
  showBookmarkBar: true,
  sidebarWidth: 380,
  smartTabNaming: false,
}

export function SettingsPage({ onClose }: SettingsPageProps): React.ReactElement {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general')
  const [saved, setSaved] = useState(false)
  const [general, setGeneral] = useState<GeneralFormState>(DEFAULT_GENERAL)
  const [dirty, setDirty] = useState(false)

  // Load settings on mount
  useEffect(() => {
    window.api.settingsGet().then((raw: Record<string, unknown>) => {
      if (!raw) return
      // Config is nested: appearance.theme, browser.downloadPath, etc.
      const appearance = raw.appearance as Record<string, unknown> | undefined
      const browser = raw.browser as Record<string, unknown> | undefined
      setGeneral({
        theme: (appearance?.theme as string) ?? DEFAULT_GENERAL.theme,
        searchEngine: (browser?.defaultSearchEngine as string) ?? DEFAULT_GENERAL.searchEngine,
        homePage: (browser?.homePage as string) ?? DEFAULT_GENERAL.homePage,
        downloadPath: (browser?.downloadPath as string) ?? DEFAULT_GENERAL.downloadPath,
        showBookmarkBar: (appearance?.showBookmarkBar as boolean) ?? DEFAULT_GENERAL.showBookmarkBar,
        sidebarWidth: (appearance?.sidebarWidth as number) ?? DEFAULT_GENERAL.sidebarWidth,
        smartTabNaming: (browser?.smartTabNaming as boolean) ?? DEFAULT_GENERAL.smartTabNaming,
      })
    }).catch(() => {})
  }, [])

  const updateGeneral = <K extends keyof GeneralFormState>(key: K, value: GeneralFormState[K]): void => {
    setGeneral((prev) => ({ ...prev, [key]: value }))
    setDirty(true)
  }

  const handleSave = async (): Promise<void> => {
    try {
      // Save general settings (nested keys matching config structure)
      await window.api.settingsSet('appearance.theme', general.theme)
      await window.api.settingsSet('browser.defaultSearchEngine', general.searchEngine)
      await window.api.settingsSet('browser.homePage', general.homePage)
      await window.api.settingsSet('browser.downloadPath', general.downloadPath)
      await window.api.settingsSet('appearance.showBookmarkBar', general.showBookmarkBar)
      await window.api.settingsSet('appearance.sidebarWidth', general.sidebarWidth)
      await window.api.settingsSet('browser.smartTabNaming', general.smartTabNaming)

      // Apply theme immediately
      const html = document.documentElement
      html.classList.remove('light', 'dark')
      if (general.theme === 'dark') {
        html.classList.add('dark')
      } else if (general.theme === 'light') {
        html.classList.remove('dark')
      } else {
        if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
          html.classList.add('dark')
        }
      }

      // Keep the settings store in sync so useTheme reacts to future changes
      useSettingsStore.setState({
        theme: general.theme as 'light' | 'dark' | 'system',
        showBookmarkBar: general.showBookmarkBar,
        sidebarWidth: general.sidebarWidth,
      })

      setDirty(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    } catch (err) {
      console.error('Failed to save settings:', err)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="flex h-[600px] w-[700px] flex-col overflow-hidden rounded-xl bg-white shadow-2xl dark:bg-gray-900">
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="w-48 shrink-0 border-r border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-850">
            <h2 className="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
              Settings
            </h2>
            <nav className="space-y-0.5">
              {([
                { key: 'general', label: 'General' },
                { key: 'models', label: 'AI Models' },
                { key: 'privacy', label: 'Privacy' },
                { key: 'shortcuts', label: 'Shortcuts' },
                { key: 'about', label: 'About' },
              ] as const).map(
                (tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`w-full rounded-md px-2.5 py-1.5 text-left text-xs ${
                      activeTab === tab.key
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                        : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                    }`}
                  >
                    {tab.label}
                  </button>
                )
              )}
            </nav>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200">
                {activeTab === 'models' ? 'AI Models' : activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
              </h3>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                &times;
              </button>
            </div>

            {activeTab === 'general' && (
              <GeneralSettings values={general} onChange={updateGeneral} />
            )}
            {activeTab === 'models' && <ModelConfig />}
            {activeTab === 'privacy' && <PrivacyConfig />}
            {activeTab === 'shortcuts' && <ShortcutSettings />}
            {activeTab === 'about' && <AboutSection />}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-gray-200 px-5 py-3 dark:border-gray-700">
          {saved && (
            <span className="text-xs text-green-600 dark:text-green-400">Saved</span>
          )}
          {dirty && !saved && (
            <span className="text-xs text-amber-500">Unsaved changes</span>
          )}
          <button
            onClick={onClose}
            className="rounded-md border border-gray-300 px-4 py-1.5 text-sm text-gray-700 hover:bg-gray-50
              dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!dirty}
            className="rounded-md bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

function GeneralSettings({
  values,
  onChange,
}: {
  values: GeneralFormState
  onChange: <K extends keyof GeneralFormState>(key: K, value: GeneralFormState[K]) => void
}): React.ReactElement {
  return (
    <div className="space-y-4">
      <SettingItem label="Theme">
        <select
          value={values.theme}
          onChange={(e) => onChange('theme', e.target.value)}
          className="rounded-md border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        >
          <option value="system">System</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </SettingItem>
      <SettingItem label="Default Search Engine">
        <select
          value={values.searchEngine}
          onChange={(e) => onChange('searchEngine', e.target.value)}
          className="rounded-md border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        >
          <option value="google">Google</option>
          <option value="bing">Bing</option>
          <option value="duckduckgo">DuckDuckGo</option>
        </select>
      </SettingItem>
      <SettingItem label="Home Page">
        <input
          type="text"
          value={values.homePage}
          onChange={(e) => onChange('homePage', e.target.value)}
          placeholder="https://www.google.com"
          className="w-64 rounded-md border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        />
      </SettingItem>
      <SettingItem label="Download Path">
        <input
          type="text"
          value={values.downloadPath}
          onChange={(e) => onChange('downloadPath', e.target.value)}
          className="w-64 rounded-md border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        />
      </SettingItem>
      <SettingItem label="Show Bookmark Bar">
        <input
          type="checkbox"
          checked={values.showBookmarkBar}
          onChange={(e) => onChange('showBookmarkBar', e.target.checked)}
          className="h-4 w-4"
        />
      </SettingItem>
      <SettingItem label="Smart Tab Naming (AI)">
        <input
          type="checkbox"
          checked={values.smartTabNaming}
          onChange={(e) => onChange('smartTabNaming', e.target.checked)}
          className="h-4 w-4"
        />
      </SettingItem>
      <SettingItem label="Sidebar Width">
        <input
          type="number"
          value={values.sidebarWidth}
          onChange={(e) => onChange('sidebarWidth', parseInt(e.target.value) || 380)}
          min={280}
          max={600}
          className="w-24 rounded-md border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        />
      </SettingItem>
    </div>
  )
}

function ShortcutSettings(): React.ReactElement {
  const shortcuts = [
    { action: 'New Tab', keys: 'Cmd+T' },
    { action: 'Close Tab', keys: 'Cmd+W' },
    { action: 'Toggle Sidebar', keys: 'Cmd+Shift+S' },
    { action: 'Command Palette', keys: 'Cmd+K' },
    { action: 'Developer Tools', keys: 'F12' },
    { action: 'Settings', keys: 'Cmd+,' },
  ]

  return (
    <div className="space-y-2">
      {shortcuts.map((s) => (
        <div
          key={s.action}
          className="flex items-center justify-between rounded-md border border-gray-200 px-3 py-2 dark:border-gray-700"
        >
          <span className="text-sm text-gray-700 dark:text-gray-300">{s.action}</span>
          <kbd className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-400">
            {s.keys}
          </kbd>
        </div>
      ))}
    </div>
  )
}

function AboutSection(): React.ReactElement {
  return (
    <div className="space-y-3">
      <div className="text-2xl font-bold text-gray-800 dark:text-gray-200">WiseWander</div>
      <p className="text-sm text-gray-500">Version 0.1.0</p>
      <p className="text-sm text-gray-500">
        An AI Native Browser powered by Electron + Ollama.
      </p>
      <p className="text-sm text-gray-500">
        Built with React, TypeScript, and Tailwind CSS.
      </p>
    </div>
  )
}

function SettingItem({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}): React.ReactElement {
  return (
    <div className="flex items-center justify-between">
      <label className="text-sm text-gray-700 dark:text-gray-300">{label}</label>
      {children}
    </div>
  )
}
