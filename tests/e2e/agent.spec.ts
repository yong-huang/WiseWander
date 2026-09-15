import { test, expect } from '@playwright/test'
import { launchApp, waitForAppReady, closeApp, selectSidebarTab } from './helpers'

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

test('shows task input and Execute button', async () => {
  await selectSidebarTab(window, 'agent')

  // Should show the task description textarea
  const textarea = window.locator('textarea[placeholder*="Search for TypeScript"]')
  await expect(textarea).toBeVisible()

  // Should show the Execute Task button
  const executeBtn = window.locator('button:has-text("Execute Task")')
  await expect(executeBtn).toBeVisible()
})

test('displays 3 Quick Actions', async () => {
  await selectSidebarTab(window, 'agent')

  const quickActions = window.locator('text=Quick Actions')
  await expect(quickActions).toBeVisible()

  const actionButtons = window.locator('button:has-text("Fill the login form"), button:has-text("Extract all links"), button:has-text("Extract the main text")')
  const count = await actionButtons.count()
  expect(count).toBe(3)
})

test('switches to tasks view when clicking Execute', async () => {
  await selectSidebarTab(window, 'agent')

  // Verify the input view structure
  const heading = window.locator('text=AI Automation')
  await expect(heading).toBeVisible()

  // Fill in a task and execute it
  const textarea = window.locator('textarea[placeholder*="Search for TypeScript"]')
  await textarea.fill('Test task for E2E')

  const executeBtn = window.locator('button:has-text("Execute Task")')
  await executeBtn.click()

  // View should switch to tasks view showing "← New Task" back button
  const backBtn = window.locator('button:has-text("New Task")')
  await expect(backBtn).toBeVisible({ timeout: 5_000 })
})

test('returns to input view via back button', async () => {
  await selectSidebarTab(window, 'agent')

  // Click the back button if we're in tasks view
  const backBtn = window.locator('button:has-text("New Task")')
  if (await backBtn.isVisible().catch(() => false)) {
    await backBtn.click()
  }

  // Should show the input view again
  const textarea = window.locator('textarea[placeholder*="Search for TypeScript"]')
  await expect(textarea).toBeVisible({ timeout: 5_000 })

  // If tasks were created, "View Previous Tasks" button should appear
  // Otherwise, just verify the input view is shown
  // The button may show "Execute Task" or "Executing..." depending on state
  const executeBtn = window.locator('button:has-text("Execute"), button:has-text("Executing")')
  await expect(executeBtn).toBeVisible()
})
