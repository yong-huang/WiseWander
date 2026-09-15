import type { Tab } from '../../../shared/types'
import { NEW_TAB_URL, MAX_RECENTLY_CLOSED } from '../../../shared/constants'

export class TabManager {
  private tabs = new Map<string, Tab>()
  private activeTabId: string | null = null
  private closedStack: Tab[] = []

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
    const tab = this.tabs.get(id)
    if (tab) {
      this.closedStack.push(tab)
      if (this.closedStack.length > MAX_RECENTLY_CLOSED) {
        this.closedStack.shift()
      }
    }
    this.tabs.delete(id)
    if (this.activeTabId === id) {
      const remaining = Array.from(this.tabs.keys())
      this.activeTabId = remaining.length > 0 ? remaining[remaining.length - 1] : null
    }
  }

  /** Reopen the most recently closed tab (restores its original id and state). */
  restoreTab(): Tab | null {
    const tab = this.closedStack.pop()
    if (!tab) return null
    this.tabs.set(tab.id, tab)
    this.activeTabId = tab.id
    return tab
  }

  /** Reorder tabs to match the given id sequence (missing ids keep relative order at the end). */
  reorderTabs(tabIds: string[]): Tab[] {
    const reordered: Tab[] = []
    for (const id of tabIds) {
      const tab = this.tabs.get(id)
      if (tab) {
        reordered.push(tab)
        this.tabs.delete(id)
      }
    }
    // Preserve original Map insertion for remaining tabs
    for (const tab of this.tabs.values()) {
      reordered.push(tab)
    }
    this.tabs.clear()
    for (const tab of reordered) {
      this.tabs.set(tab.id, tab)
    }
    return reordered
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
