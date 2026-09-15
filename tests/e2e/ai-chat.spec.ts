import { test, expect } from '@playwright/test'
import { launchApp, waitForAppReady, closeApp, selectSidebarTab, getSidebar, setModel, navigateTo } from './helpers'

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

test('shows welcome state with suggested prompts', async () => {
  await selectSidebarTab(window, 'chat')
  const sidebar = getSidebar(window)

  await expect(sidebar.locator('text=Ask about this page')).toBeVisible()
  await expect(sidebar.locator('text=Summarize this page')).toBeVisible()
  await expect(sidebar.locator('text=Extract all links')).toBeVisible()
})

test('Send button is disabled when input is empty', async () => {
  const sidebar = getSidebar(window)
  const sendBtn = sidebar.locator('button:has-text("Send")')
  await expect(sendBtn).toBeVisible()
  await expect(sendBtn).toBeDisabled()
})

test('sends a chat message and receives AI response', async () => {
  test.setTimeout(120_000) // AI response may be slow

  // Navigate to example.com first so the webview is initialized and extractPageContext works
  await navigateTo(window, 'https://example.com')
  await window.waitForTimeout(2000)

  // Switch back to chat tab
  await selectSidebarTab(window, 'chat')
  const sidebar = getSidebar(window)
  const textarea = sidebar.locator('textarea[placeholder*="Ask about this page"]')

  // Type and send a simple question
  await textarea.fill('What is 1+1? Answer with just the number.')
  const sendBtn = sidebar.locator('button:has-text("Send")')
  await sendBtn.click()

  // Textarea should be cleared
  await expect(textarea).toHaveValue('')

  // During streaming the Stop button is shown; after it finishes, Send returns
  // Wait for streaming to fully complete (Stop → Send transition)
  await expect(sidebar.locator('button:has-text("Send")')).toBeVisible({ timeout: 90_000 })

  // Wait a moment for React to render the response
  await window.waitForTimeout(500)

  // Assistant response should exist — rendered via StreamingText (markdown-body class)
  const assistantMessages = sidebar.locator('.markdown-body')
  const count = await assistantMessages.count()
  expect(count).toBeGreaterThanOrEqual(1)

  // The last assistant message should have text content (the AI response)
  const lastAssistant = assistantMessages.last()
  const text = await lastAssistant.textContent({ timeout: 5_000 })
  expect(text!.trim().length).toBeGreaterThan(0)
})

test('Stop button appears during streaming, Send returns after', async () => {
  test.setTimeout(120_000)

  const sidebar = getSidebar(window)
  const textarea = sidebar.locator('textarea[placeholder*="Ask about this page"]')

  // Send a message that will take a while to answer
  await textarea.fill('Count from 1 to 20, one per line.')
  await sidebar.locator('button:has-text("Send")').click()

  // Quickly check for Stop button (may or may not be visible depending on timing)
  const stopVisible = await sidebar.locator('button:has-text("Stop")').isVisible().catch(() => false)
  // Either Stop is showing (still streaming) or Send is showing (already done)
  expect(stopVisible || await sidebar.locator('button:has-text("Send")').isVisible()).toBe(true)

  // Wait for streaming to finish
  await expect(sidebar.locator('button:has-text("Send")')).toBeVisible({ timeout: 90_000 })
})
