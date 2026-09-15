import type { Tab } from '../../../shared/types'
import { NEW_TAB_URL } from '../../../shared/constants'

export class TabManager {
  private tabs = new Map<string, Tab>()
  private activeTabId: string | null = null

  createTab(url?: string): Tab {
    const id = crypto.randomUUID()
    const tab: Tab = {
      id,
      url: url ?? NEW_TAB_URL,
      title: 'New Tab',
      status: 'loading',
      lastAccessed: Date.now(),
    }
    this.tabs.set(id, tab)
    if (!this.activeTabId) this.activeTabId = id
    return tab
  }

  closeTab(id: string): void {
    this.tabs.delete(id)
    if (this.activeTabId === id) {
      const remaining = Array.from(this.tabs.keys())
      this.activeTabId = remaining.length > 0 ? remaining[remaining.length - 1] : null
    }
  }

  activateTab(id: string): void {
    if (this.tabs.has(id)) {
      this.activeTabId = id
      const tab = this.tabs.get(id)!
      tab.lastAccessed = Date.now()
    }
  }

  getActiveTab(): Tab | null {
    return this.activeTabId ? (this.tabs.get(this.activeTabId) ?? null) : null
  }

  getAllTabs(): Tab[] {
    return Array.from(this.tabs.values())
  }

  getTab(id: string): Tab | undefined {
    return this.tabs.get(id)
  }
}
