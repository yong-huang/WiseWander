import { test, expect } from '@playwright/test'
import { launchApp, waitForAppReady, closeApp } from './helpers'

let app: import('@playwright/test').ElectronApplication
let window: import('@playwright/test').Page

test.beforeAll(async () => {
  const instance = await launchApp()
  app = instance.app
  window = instance.window
  await waitForAppReady(window)
  // Clear bookmarks for clean test state and notify the UI to reload
  await window.evaluate(async () => {
    try {
      const list = await (window as any).api.bookmarkList()
      for (const bm of (list || [])) {
        await (window as any).api.bookmarkRemove(bm.id)
      }
      window.dispatchEvent(new CustomEvent('bookmark-changed'))
    } catch { /* ignore */ }
  })
  // Wait for the bookmark bar to reload and show empty state
  await expect(window.locator('text=No bookmarks — press Cmd+D to add')).toBeVisible({ timeout: 5_000 })
})

test.afterAll(async () => {
  await closeApp(app)
})

test('bookmark bar is visible', async () => {
  // The bookmark bar is rendered by default (visible prop is true)
  const bookmarkBar = window.locator('text=No bookmarks — press Cmd+D to add')
  await expect(bookmarkBar).toBeVisible()
})

test('shows empty state when no bookmarks exist', async () => {
  await expect(window.locator('text=No bookmarks — press Cmd+D to add')).toBeVisible()
})
