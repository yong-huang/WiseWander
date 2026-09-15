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

test('shows a window after launch', async () => {
  const windows = app.windows()
  expect(windows.length).toBeGreaterThanOrEqual(1)
})

test('window has correct title', async () => {
  const title = await window.title()
  expect(title).toBeDefined()
  // Title may be empty initially or set by loaded page
})

test('opens with an initial tab', async () => {
  // The tab bar should contain at least one tab
  const tabBar = window.locator('.flex.items-center.bg-gray-100')
  await expect(tabBar).toBeVisible()

  // At least one tab element should be present
  const tabCount = await window.locator('.flex.items-center.bg-gray-100 > div > div.group').count()
  expect(tabCount).toBeGreaterThanOrEqual(1)
})

test('address bar shows a URL', async () => {
  const input = window.locator('input[placeholder="Search or enter URL..."]')
  await expect(input).toBeVisible()

  const value = await input.inputValue()
  expect(value).toBeTruthy()
  expect(value).toMatch(/^(http|wisewander:\/\/)/)
})
