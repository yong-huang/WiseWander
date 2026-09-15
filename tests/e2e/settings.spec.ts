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

test('opens settings page via gear button', async () => {
  await window.locator('button[title="Settings (Cmd+,)"]').click()

  // The settings overlay — use a simple selector; command palette is not open in this app instance
  const overlay = window.locator('.fixed.inset-0.z-50')
  await expect(overlay).toBeVisible({ timeout: 5_000 })
  // Settings heading in the nav sidebar
  await expect(overlay.locator('h2:text-is("Settings")')).toBeVisible()
})

test('contains General tab by default with Theme and Home Page', async () => {
  const overlay = window.locator('.fixed.inset-0.z-50')
  // Content area is the scrollable div on the right side of settings
  const content = overlay.locator('.overflow-y-auto')
  await expect(content.locator('text=Theme')).toBeVisible()
  await expect(content.locator('text=Home Page')).toBeVisible()
})

test('allows setting home page URL', async () => {
  const overlay = window.locator('.fixed.inset-0.z-50')
  const homePageInput = overlay.locator('input[placeholder="https://www.google.com"]')
  await expect(homePageInput).toBeVisible()

  await homePageInput.fill('https://bing.com')
  const value = await homePageInput.inputValue()
  expect(value).toBe('https://bing.com')
})

test('navigates to AI Models tab and shows provider configuration', async () => {
  const overlay = window.locator('.fixed.inset-0.z-50')
  await overlay.locator('nav button:has-text("AI Models")').click()

  const content = overlay.locator('.overflow-y-auto')
  await expect(content.locator('text=AI Providers')).toBeVisible()
})

test('navigates to Shortcuts tab and shows keyboard shortcuts', async () => {
  const overlay = window.locator('.fixed.inset-0.z-50')
  await overlay.locator('nav button:has-text("Shortcuts")').click()

  const content = overlay.locator('.overflow-y-auto')
  await expect(content.locator('text=New Tab')).toBeVisible()
  await expect(content.locator('text=Close Tab')).toBeVisible()
  await expect(content.locator('text=Toggle Sidebar')).toBeVisible()
  await expect(content.locator('text=Command Palette')).toBeVisible()
})

test('navigates to About tab and shows version info', async () => {
  const overlay = window.locator('.fixed.inset-0.z-50')
  await overlay.locator('nav button:has-text("About")').click()

  const content = overlay.locator('.overflow-y-auto')
  await expect(content.locator('text=Version 0.1.0')).toBeVisible()
})

test('closes settings via Cancel button', async () => {
  const overlay = window.locator('.fixed.inset-0.z-50')
  // The Cancel button is in the footer border-t area
  await overlay.locator('button:has-text("Cancel")').click()

  await expect(overlay).not.toBeVisible({ timeout: 5_000 })
})
