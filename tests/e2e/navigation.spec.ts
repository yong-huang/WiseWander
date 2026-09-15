import { test, expect } from '@playwright/test'
import { launchApp, waitForAppReady, closeApp, getAddressBarValue } from './helpers'

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

test('navigates to a URL entered in the address bar', async () => {
  const input = window.locator('input[placeholder="Search or enter URL..."]')
  await input.click()
  await input.fill('https://example.com')
  await input.press('Enter')

  const value = await getAddressBarValue(window)
  expect(value).toContain('example.com')
})

test('redirects search keywords to search engine', async () => {
  const input = window.locator('input[placeholder="Search or enter URL..."]')
  await input.click()
  await input.fill('playwright testing')
  await input.press('Enter')

  // The app redirects to Google search for non-URL text
  const value = await getAddressBarValue(window)
  expect(value).toContain('google.com/search')
})

test('navigation back/forward buttons are present', async () => {
  const backBtn = window.locator('button:has-text("←")').first()
  await expect(backBtn).toBeVisible()

  const forwardBtn = window.locator('button:has-text("→")').first()
  await expect(forwardBtn).toBeVisible()
})

test('auto-adds https:// for domain input', async () => {
  const input = window.locator('input[placeholder="Search or enter URL..."]')
  await input.click()
  await input.fill('example.com')
  await input.press('Enter')

  const value = await getAddressBarValue(window)
  expect(value).toContain('https://')
  expect(value).toContain('example.com')
})
