import { useEffect } from 'react'
import { useSettingsStore } from '../store/settings-store'

type Theme = 'light' | 'dark' | 'system'

function applyTheme(theme: Theme): void {
  const root = document.documentElement
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches

  const shouldBeDark = theme === 'dark' || (theme === 'system' && prefersDark)

  if (shouldBeDark) {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
}

export function useTheme(): void {
  const theme = useSettingsStore((s) => s.theme)

  // Apply theme on mount and whenever it changes
  useEffect(() => {
    applyTheme(theme)

    // When theme is 'system', listen for OS-level preference changes
    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

      const handleChange = (e: MediaQueryListEvent): void => {
        if (useSettingsStore.getState().theme === 'system') {
          if (e.matches) {
            document.documentElement.classList.add('dark')
          } else {
            document.documentElement.classList.remove('dark')
          }
        }
      }

      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    }
  }, [theme])
}
