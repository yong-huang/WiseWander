import Store from 'electron-store'
import { CONFIG_NAME } from '../../shared/constants'

export interface AppConfig {
  ollama: {
    baseUrl: string
    defaultModel: string
  }
  browser: {
    defaultSearchEngine: string
    homePage: string
    downloadPath: string
    smartTabNaming: boolean
  }
  privacy: {
    blockAds: boolean
    blockTrackers: boolean
    fingerprintProtection: boolean
  }
  appearance: {
    theme: 'light' | 'dark' | 'system'
    sidebarWidth: number
    showBookmarkBar: boolean
  }
  shortcuts: {
    toggleSidebar: string
    commandPalette: string
    newTab: string
  }
}

const DEFAULT_CONFIG: AppConfig = {
  ollama: {
    baseUrl: 'http://localhost:11434',
    defaultModel: 'llama3.2',
  },
  browser: {
    defaultSearchEngine: 'https://www.google.com/search?q=',
    homePage: 'https://www.google.com',
    downloadPath: '~/Downloads',
    smartTabNaming: false,
  },
  privacy: {
    blockAds: true,
    blockTrackers: true,
    fingerprintProtection: false,
  },
  appearance: {
    theme: 'system',
    sidebarWidth: 380,
    showBookmarkBar: true,
  },
  shortcuts: {
    toggleSidebar: 'CommandOrControl+Shift+S',
    commandPalette: 'CommandOrControl+K',
    newTab: 'CommandOrControl+T',
  },
}

export const configStore = new Store<AppConfig>({
  name: CONFIG_NAME.replace('.json', ''),
  defaults: DEFAULT_CONFIG,
})
