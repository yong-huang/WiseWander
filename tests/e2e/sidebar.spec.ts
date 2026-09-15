import { test, expect } from '@playwright/test'
import { launchApp, waitForAppReady, closeApp, openSidebar, selectSidebarTab, closeSidebar, getSidebar } from './helpers'

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

test('opens AI panel via sidebar toggle button', async () => {
  await closeSidebar(window)
  await window.waitForTimeout(300)

  await openSidebar(window)

  const sidebar = getSidebar(window)
  await expect(sidebar).toBeVisible()
})

test('displays all sidebar tabs', async () => {
  await openSidebar(window)
  const sidebar = getSidebar(window)

  const expectedTabs = ['Browser', 'Page', 'Summary', 'Agent', 'Research', 'For You']
  for (const tabName of expectedTabs) {
    await expect(sidebar.locator(`button:text-is("${tabName}")`)).toBeVisible()
  }
})

test('switches between sidebar tabs', async () => {
  await selectSidebarTab(window, 'summary')
  await window.waitForTimeout(300)

  // Tools tab may need scrolling into view since the tab bar can overflow
  const sidebar = getSidebar(window)
  const toolsBtn = sidebar.locator('button:text-is("Tools")')
  await toolsBtn.scrollIntoViewIfNeeded()
  await toolsBtn.click({ force: true })
  await window.waitForTimeout(300)

  await selectSidebarTab(window, 'chat')
  await window.waitForTimeout(300)

  await expect(sidebar).toBeVisible()
})

test('closes the sidebar', async () => {
  await openSidebar(window)
  await closeSidebar(window)

  const sidebar = getSidebar(window)
  await expect(sidebar).not.toBeVisible({ timeout: 5_000 })
})

test('shows For You tab content', async () => {
  await openSidebar(window)
  const sidebar = getSidebar(window)
  // Use JS click to bypass overflow interception
  await sidebar.locator('button:text-is("For You")').evaluate((el) => (el as HTMLElement).click())
  await window.waitForTimeout(500)

  await expect(sidebar.locator('text=Recommendations')).toBeVisible({ timeout: 5_000 })
  await expect(sidebar.locator('h4:text-is("Reading List")')).toBeVisible({ timeout: 5_000 })
})

test('shows AI Model status indicator', async () => {
  // The AI Model status indicator is in the browser view area (bottom-left), not in the sidebar
  const statusIndicator = window.locator('text=AI Model')
  await expect(statusIndicator).toBeVisible({ timeout: 10_000 })
})
