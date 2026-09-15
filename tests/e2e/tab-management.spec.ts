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

test('creates a new tab via the + button', async () => {
  const initialCount = await window.locator('.flex.items-center.bg-gray-100 > div > div.group').count()

  // Click the "+" new tab button
  await window.locator('button[title="New Tab (Cmd+T)"]').click()

  // Wait for a new tab to appear
  await window.waitForFunction(
    (prev) => document.querySelectorAll('.group.flex.items-center.gap-1\\.5').length > prev,
    initialCount,
    { timeout: 5_000 }
  )

  const newCount = await window.locator('.flex.items-center.bg-gray-100 > div > div.group').count()
  expect(newCount).toBe(initialCount + 1)
})

test('switches active tab on click', async () => {
  // Ensure at least 2 tabs exist
  let tabCount = await window.locator('.flex.items-center.bg-gray-100 > div > div.group').count()
  if (tabCount < 2) {
    await window.locator('button[title="New Tab (Cmd+T)"]').click()
    await window.waitForTimeout(500)
    tabCount = await window.locator('.flex.items-center.bg-gray-100 > div > div.group').count()
  }

  // The first tab should be active (has bg-white class)
  const firstTab = window.locator('.flex.items-center.bg-gray-100 > div > div.group').first()
  await firstTab.click()

  // Verify the active tab has the active styling
  const classes = await firstTab.getAttribute('class')
  expect(classes).toContain('bg-white')
})

test('closes a tab via the × button', async () => {
  // Create a new tab first so we have one to close
  await window.locator('button[title="New Tab (Cmd+T)"]').click()
  await window.waitForTimeout(500)

  const countBefore = await window.locator('.flex.items-center.bg-gray-100 > div > div.group').count()

  // Hover over the last tab to reveal its close button, then click it
  const lastTab = window.locator('.flex.items-center.bg-gray-100 > div > div.group').last()
  await lastTab.hover()
  const closeBtn = lastTab.locator('button:text-is("×")')
  await closeBtn.click()

  await window.waitForTimeout(500)

  const countAfter = await window.locator('.flex.items-center.bg-gray-100 > div > div.group').count()
  expect(countAfter).toBe(countBefore - 1)
})

test('shows empty state when all tabs are closed', async () => {
  // Close all tabs
  const tabs = window.locator('.flex.items-center.bg-gray-100 > div > div.group')
  const count = await tabs.count()

  for (let i = count - 1; i >= 0; i--) {
    const tab = tabs.nth(i)
    await tab.hover()
    const closeBtn = tab.locator('button:text-is("×")')
    await closeBtn.click({ timeout: 3_000 }).catch(() => {
      // Tab might already be gone
    })
    await window.waitForTimeout(300)
  }

  // Should show the empty state with "WiseWander" text
  await expect(window.locator('text=Open a new tab to start browsing')).toBeVisible({ timeout: 5_000 })
})

test('can create a new tab from empty state', async () => {
  // Build the empty state ourselves instead of relying on the previous test
  const tabs = window.locator('.flex.items-center.bg-gray-100 > div > div.group')
  const count = await tabs.count()
  for (let i = count - 1; i >= 0; i--) {
    const tab = tabs.nth(i)
    await tab.hover()
    await tab.locator('button:text-is("×")').click({ timeout: 3_000 }).catch(() => {})
    await window.waitForTimeout(200)
  }
  await expect(window.locator('text=Open a new tab to start browsing')).toBeVisible({ timeout: 5_000 })

  // From the empty state, click the "New Tab" button
  await window.locator('button:has-text("New Tab")').click()
  await window.waitForTimeout(500)

  // A new tab should appear
  const tabCount = await window.locator('.flex.items-center.bg-gray-100 > div > div.group').count()
  expect(tabCount).toBeGreaterThanOrEqual(1)
})
