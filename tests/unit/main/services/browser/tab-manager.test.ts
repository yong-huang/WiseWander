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
})
