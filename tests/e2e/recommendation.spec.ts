import { test, expect } from '@playwright/test'
import { launchApp, waitForAppReady, closeApp, openNewTab, openSidebar, selectSidebarTab, getSidebar } from './helpers'

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

// --- New Tab Page ---

test('shows new tab page with greeting and search bar', async () => {
  await openNewTab(window)

  // Use h2:text-is to avoid matching the sidebar "For You" tab button
  await expect(window.locator('h2:text-is("For You")')).toBeVisible({ timeout: 10_000 })
})

test('new tab page has Refresh button', async () => {
  await openNewTab(window)

  // Use .last() because previous tests may have created additional NewTabPage
  // instances (each with their own Refresh button in the DOM)
  const refreshBtn = window.locator('button', { hasText: 'Refresh' }).last()
  await expect(refreshBtn).toBeVisible({ timeout: 10_000 })
})

test('searching from new tab navigates away', async () => {
  await openNewTab(window)

  // Use .last() because multiple NewTabPage instances create duplicate search inputs
  const searchInput = window.locator('input[placeholder="Search the web..."]').last()
  await expect(searchInput).toBeVisible({ timeout: 10_000 })
  await searchInput.fill('https://example.com')
  await searchInput.press('Enter')

  // The tab should navigate away from wisewander://newtab
  await window.waitForTimeout(3_000)
  const addressBar = window.locator('input[placeholder="Search or enter URL..."]')
  await addressBar.blur()
  await window.waitForTimeout(100)
  const url = await addressBar.inputValue()
  expect(url).not.toBe('wisewander://newtab')
})

test('new tab page shows placeholder when no recommendations', async () => {
  await openNewTab(window)

  // Use .last() because multiple NewTabPage instances create duplicate placeholder paragraphs
  await expect(
    window.locator('text=Start browsing to get personalized recommendations').last()
  ).toBeVisible({ timeout: 10_000 })
})

// --- Sidebar Recommendation Panel ---

/** Click the For You tab in the sidebar, without force:true which may not trigger React handlers */
async function switchToRecommendTab(): Promise<void> {
  await openSidebar(window)
  const sidebar = getSidebar(window)
  const tabButton = sidebar.locator('button:text-is("For You")')
  await tabButton.scrollIntoViewIfNeeded()
  await window.waitForTimeout(200)
  await tabButton.click()
  await window.waitForTimeout(500)
}

test('sidebar For You tab shows recommendation panel', async () => {
  await switchToRecommendTab()

  const sidebar = getSidebar(window)
  // Use h4 to match the heading (avoids matching the "+ Reading List" button)
  await expect(sidebar.locator('h4:text-is("Reading List")')).toBeVisible({ timeout: 10_000 })
})

test('recommendation panel shows Add to Reading List button', async () => {
  await switchToRecommendTab()

  const sidebar = getSidebar(window)
  await expect(sidebar.locator('button', { hasText: '+ Reading List' })).toBeVisible({ timeout: 10_000 })
})
