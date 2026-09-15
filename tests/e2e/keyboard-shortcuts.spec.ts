import { test, expect } from '@playwright/test'
import { launchApp, waitForAppReady, closeApp, openSidebar, getSidebar } from './helpers'

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

test('Cmd+T creates a new tab', async () => {
  const initialCount = await window.locator('.flex.items-center.bg-gray-100 > div > div.group').count()

  await window.keyboard.press('Meta+t')
  await window.waitForTimeout(500)

  const newCount = await window.locator('.flex.items-center.bg-gray-100 > div > div.group').count()
  expect(newCount).toBe(initialCount + 1)
})

test('Cmd+W closes the active tab', async () => {
  // First ensure we have at least 2 tabs
  let tabCount = await window.locator('.flex.items-center.bg-gray-100 > div > div.group').count()
  if (tabCount < 2) {
    await window.keyboard.press('Meta+t')
    await window.waitForTimeout(500)
  }

  const countBefore = await window.locator('.flex.items-center.bg-gray-100 > div > div.group').count()

  await window.keyboard.press('Meta+w')
  await window.waitForTimeout(500)

  const countAfter = await window.locator('.flex.items-center.bg-gray-100 > div > div.group').count()
  expect(countAfter).toBe(countBefore - 1)
})

test('Cmd+Shift+S toggles the sidebar', async () => {
  // Ensure sidebar is open first so we start from a known state
  await openSidebar(window)
  const sidebar = getSidebar(window)
  await expect(sidebar).toBeVisible()

  // Toggle closed
  await window.keyboard.press('Meta+Shift+s')
  await expect(sidebar).not.toBeVisible({ timeout: 5_000 })

  // Toggle back open
  await window.keyboard.press('Meta+Shift+s')
  await expect(sidebar).toBeVisible({ timeout: 5_000 })
})

test('Cmd+, opens settings', async () => {
  await window.keyboard.press('Meta+,')

  // Settings modal should be visible
  const modal = window.locator('.fixed.inset-0.z-50')
  await expect(modal).toBeVisible({ timeout: 5_000 })

  // Close settings
  const cancelBtn = modal.locator('button:has-text("Cancel")')
  await cancelBtn.click()
})
