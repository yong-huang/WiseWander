import { test, expect } from '@playwright/test'
import { launchApp, waitForAppReady, closeApp } from './helpers'

let app: import('@playwright/test').ElectronApplication
let window: import('@playwright/test').Page

test.beforeAll(async () => {
  const instance = await launchApp()
  app = instance.app
  window = instance.window
  await waitForAppReady(window)
})

test.afterAll(async () => {
  await closeApp(app)
})

/**
 * Open command palette by pressing Cmd+K.
 * Steals focus from webview by clicking the tab bar area first.
 * If the palette is already open, this is a no-op.
 */
async function ensurePaletteOpen(window: import('@playwright/test').Page): Promise<void> {
  // Check if already open
  const input = window.locator('input[placeholder="Type a command..."]')
  if (await input.isVisible().catch(() => false)) return

  // Close any overlay first (e.g. if palette was left open)
  await window.keyboard.press('Escape')
  await window.waitForTimeout(100)

  // Click on the tab bar area to take focus from webview
  await window.locator('.flex.items-center.bg-gray-100').click()
  await window.waitForTimeout(100)
  await window.keyboard.press('Meta+k')
  await input.waitFor({ state: 'visible', timeout: 5_000 })
}

test('opens command palette with Cmd+K', async () => {
  await ensurePaletteOpen(window)
  await expect(window.locator('input[placeholder="Type a command..."]')).toBeVisible()
})

test('shows command list grouped by category', async () => {
  await ensurePaletteOpen(window)

  // Should show commands from different categories
  await expect(window.locator('.fixed.inset-0.z-50 button:has-text("New Tab")')).toBeVisible()
  await expect(window.locator('.fixed.inset-0.z-50 button:has-text("Page AI")')).toBeVisible()
})

test('filters commands as you type', async () => {
  await ensurePaletteOpen(window)

  const input = window.locator('input[placeholder="Type a command..."]')
  await input.fill('setting')

  // Only settings-related commands should be visible
  await expect(window.locator('.fixed.inset-0.z-50 button:has-text("Settings")')).toBeVisible()

  // "New Tab" should be filtered out
  await expect(window.locator('.fixed.inset-0.z-50 button:has-text("New Tab")')).not.toBeVisible()
})

test('closes on Escape', async () => {
  await ensurePaletteOpen(window)
  await window.keyboard.press('Escape')

  await expect(window.locator('input[placeholder="Type a command..."]')).not.toBeVisible()
})
