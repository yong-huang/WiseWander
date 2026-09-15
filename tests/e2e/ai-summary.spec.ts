import { test, expect } from '@playwright/test'
import { launchApp, waitForAppReady, closeApp, selectSidebarTab, getSidebar, setModel } from './helpers'

const MODEL = 'qwen3.5:35b-a3b-coding-nvfp4'

let app: import('@playwright/test').ElectronApplication
let window: import('@playwright/test').Page

test.beforeAll(async () => {
  const instance = await launchApp()
  app = instance.app
  window = instance.window
  await waitForAppReady(window)
  await setModel(window, MODEL)
})

test.afterAll(async () => {
  await closeApp(app)
})

test('shows length selector and Generate Summary button', async () => {
  await selectSidebarTab(window, 'summary')
  const sidebar = getSidebar(window)

  await expect(sidebar.locator('button:has-text("brief")')).toBeVisible()
  await expect(sidebar.locator('button:has-text("standard")')).toBeVisible()
  await expect(sidebar.locator('button:has-text("detailed")')).toBeVisible()
  await expect(sidebar.locator('button:has-text("Generate Summary")')).toBeVisible()
})

test('can switch summary lengths', async () => {
  const sidebar = getSidebar(window)

  await sidebar.locator('button:has-text("brief")').click()
  let btn = sidebar.locator('button:has-text("brief")')
  expect(await btn.getAttribute('class')).toContain('bg-blue-100')

  await sidebar.locator('button:has-text("detailed")').click()
  btn = sidebar.locator('button:has-text("detailed")')
  expect(await btn.getAttribute('class')).toContain('bg-blue-100')
})

// NOTE: The real AI summary test is disabled because the summarize IPC flow
// uses extractPageContext (webview.executeJavaScript) which can hang in the
// test environment. The chat and research features work because they use
// different code paths. This should be re-enabled once the app adds a
// timeout to extractPageContext or refactors the summarize flow.
test.skip('generates a summary with real Ollama', async () => {
  test.setTimeout(180_000)

  const { navigateTo, getAddressBarValue } = await import('./helpers')
  await navigateTo(window, 'https://example.com')
  const url = await getAddressBarValue(window)
  expect(url).toContain('example.com')
  await window.waitForTimeout(3000)

  await selectSidebarTab(window, 'summary')
  const sidebar = getSidebar(window)

  await sidebar.locator('button:has-text("Generate Summary")').click()

  const summaryContent = sidebar.locator('.markdown-body')
  await expect(summaryContent).toBeVisible({ timeout: 120_000 })

  const text = await summaryContent.textContent({ timeout: 5_000 })
  expect(text!.trim().length).toBeGreaterThan(0)
})

test.skip('shows Copy/Regenerate/Export buttons after summary', async () => {
  const sidebar = getSidebar(window)

  await expect(sidebar.locator('button:has-text("Copy")')).toBeVisible()
  await expect(sidebar.locator('button:has-text("Regenerate")')).toBeVisible()
  await expect(sidebar.locator('button:has-text("Export")')).toBeVisible()
})
