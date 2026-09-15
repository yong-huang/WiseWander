import { describe, it, expect } from 'vitest'
import { TabManager } from '../../../../../src/main/services/browser/tab-manager'
import { NEW_TAB_URL } from '../../../../../src/shared/constants'

describe('TabManager', () => {
  it('should create a new tab with unique ID', () => {
    const mgr = new TabManager()
    const tab = mgr.createTab()
    expect(tab.id).toBeDefined()
    expect(tab.url).toBe(NEW_TAB_URL)
    expect(tab.title).toBe('New Tab')
    expect(tab.status).toBe('loading')
  })

  it('should create tab with custom URL', () => {
    const mgr = new TabManager()
    const tab = mgr.createTab('https://example.com')
    expect(tab.url).toBe('https://example.com')
  })

  it('should close a tab', () => {
    const mgr = new TabManager()
    const tab = mgr.createTab()
    mgr.closeTab(tab.id)
    expect(mgr.getTab(tab.id)).toBeUndefined()
  })

  it('should activate a tab', () => {
    const mgr = new TabManager()
    const tab1 = mgr.createTab()
    const tab2 = mgr.createTab()
    mgr.activateTab(tab1.id)
    expect(mgr.getActiveTab()?.id).toBe(tab1.id)
  })

  it('should return all tabs', () => {
    const mgr = new TabManager()
    mgr.createTab()
    mgr.createTab()
    mgr.createTab()
    expect(mgr.getAllTabs()).toHaveLength(3)
  })

  it('should return null active tab when empty', () => {
    const mgr = new TabManager()
    expect(mgr.getActiveTab()).toBeNull()
  })

  it('should fallback to another tab when active is closed', () => {
    const mgr = new TabManager()
    const tab1 = mgr.createTab()
    const tab2 = mgr.createTab()
    mgr.activateTab(tab2.id)
    mgr.closeTab(tab2.id)
    // After closing active, it should fallback
    const active = mgr.getActiveTab()
    expect(active).not.toBeNull()
    expect(active?.id).toBe(tab1.id)
  })

  it('should restore the most recently closed tab', () => {
    const mgr = new TabManager()
    const tab1 = mgr.createTab('https://example.com')
    const tab2 = mgr.createTab('https://example.org')
    mgr.closeTab(tab1.id)
    mgr.closeTab(tab2.id)

    const restored = mgr.restoreTab()
    expect(restored).not.toBeNull()
    expect(restored?.id).toBe(tab2.id)
    expect(restored?.url).toBe('https://example.org')
    expect(mgr.getTab(tab2.id)).toBeDefined()
    expect(mgr.getActiveTab()?.id).toBe(tab2.id)

    const restoredAgain = mgr.restoreTab()
    expect(restoredAgain?.id).toBe(tab1.id)
  })

  it('should return null when restoring with no closed tabs', () => {
    const mgr = new TabManager()
    expect(mgr.restoreTab()).toBeNull()
  })

  it('should reorder tabs', () => {
    const mgr = new TabManager()
    const a = mgr.createTab('https://a.com')
    const b = mgr.createTab('https://b.com')
    const c = mgr.createTab('https://c.com')

    const reordered = mgr.reorderTabs([c.id, a.id, b.id])
    expect(reordered.map((t) => t.id)).toEqual([c.id, a.id, b.id])
    expect(mgr.getAllTabs().map((t) => t.id)).toEqual([c.id, a.id, b.id])
  })

  it('should keep unknown ids out and preserve the rest when reordering', () => {
    const mgr = new TabManager()
    const a = mgr.createTab('https://a.com')
    const b = mgr.createTab('https://b.com')

    mgr.reorderTabs(['nonexistent-id', b.id])
    expect(mgr.getAllTabs().map((t) => t.id)).toEqual([b.id, a.id])
  })
})
