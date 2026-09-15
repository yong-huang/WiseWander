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

// ── Helper ──

/** Navigate to Tools tab and click a specific capability card */
async function openCapability(name: string): Promise<void> {
  await selectSidebarTab(window, 'tools')
  await window.waitForTimeout(300) // wait for React re-render
  const sidebar = getSidebar(window)
  const card = sidebar.locator(`button:has-text("${name}")`)
  await card.scrollIntoViewIfNeeded()
  await card.click()
}

// ── Tests ──

test('shows text input, language selector, and Translate button', async () => {
  await openCapability('Translate')
  const sidebar = getSidebar(window)
  const content = sidebar.locator('.flex-1.overflow-hidden')

  await expect(content.locator('textarea[placeholder="Enter or paste text to translate..."]')).toBeVisible()
  await expect(content.locator('select')).toBeVisible()
  // The translate button (bg-blue-600) is distinct from the sidebar tab
  await expect(content.locator('button.bg-blue-600')).toBeVisible()
})

test('can select target language', async () => {
  const content = getSidebar(window).locator('.flex-1.overflow-hidden')
  const select = content.locator('select')

  await select.selectOption('ja')
  expect(await select.inputValue()).toBe('ja')

  await select.selectOption('en')
  expect(await select.inputValue()).toBe('en')
})

test('translates text with real Ollama', async () => {
  test.setTimeout(120_000)

  const content = getSidebar(window).locator('.flex-1.overflow-hidden')

  // Select Chinese as target language
  await content.locator('select').selectOption('zh')

  // Enter text to translate
  const textarea = content.locator('textarea[placeholder="Enter or paste text to translate..."]')
  await textarea.fill('Hello, how are you?')

  // Click Translate
  const translateBtn = content.locator('button.bg-blue-600')
  await translateBtn.click()

  // Wait for translation result to appear
  // The translation is shown in a div with bg-blue-50 class
  const translationResult = content.locator('[class*="bg-blue-50"], [class*="dark:bg-blue-950"]')
  await expect(translationResult).toBeVisible({ timeout: 90_000 })

  // Verify the translation has content
  const text = await translationResult.textContent({ timeout: 5_000 })
  expect(text!.trim().length).toBeGreaterThan(0)
})

test('shows original text alongside translation', async () => {
  const content = getSidebar(window).locator('.flex-1.overflow-hidden')

  // Original text label should be visible
  await expect(content.locator('text=Original')).toBeVisible()
  // Translation label should be visible
  await expect(content.locator('text=Translation')).toBeVisible()
})
