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

/** Get the DevTools panel locator (border-t border-gray-300 container at the bottom) */
function devToolsPanel() {
  return window.locator('.border-t.border-gray-300')
}

/** Click the tab bar area to ensure renderer has focus (not the webview) */
async function focusRenderer(): Promise<void> {
  await window.locator('.flex.items-center.bg-gray-100').first().click()
  await window.waitForTimeout(100)
}

test('opens DevTools with F12 key', async () => {
  await focusRenderer()
  await window.keyboard.press('F12')

  // DevTools panel should be visible with tabs
  await expect(devToolsPanel().locator('button:text-is("Console")')).toBeVisible({ timeout: 5_000 })
})

test('shows all 5 DevTools tabs', async () => {
  const panel = devToolsPanel()
  await expect(panel.locator('button:text-is("Console")')).toBeVisible()
  await expect(panel.locator('button:text-is("Network")')).toBeVisible()
  await expect(panel.locator('button:text-is("Elements")')).toBeVisible()
  await expect(panel.locator('button:text-is("AI")')).toBeVisible()
  await expect(panel.locator('button:text-is("Storage")')).toBeVisible()
})

test('can switch between DevTools tabs', async () => {
  const panel = devToolsPanel()

  // Click Network tab
  await panel.locator('button:text-is("Network")').click()
  await window.waitForTimeout(200)

  // Click AI tab
  await panel.locator('button:text-is("AI")').click()
  await window.waitForTimeout(200)

  // Click Console tab
  await panel.locator('button:text-is("Console")').click()
  await window.waitForTimeout(200)
})

test('closes DevTools with F12 again', async () => {
  await focusRenderer()
  await window.keyboard.press('F12')

  // DevTools should be gone
  await expect(devToolsPanel()).not.toBeVisible({ timeout: 5_000 })
})
