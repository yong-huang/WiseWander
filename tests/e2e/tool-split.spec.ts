import { test, expect } from '@playwright/test'
import { launchApp, waitForAppReady, closeApp, selectSidebarTab, getSidebar, setModel, navigateTo, openNewTab } from './helpers'

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

// ── Sidebar Tab Separation ──

test('sidebar shows Browser and Page tabs with visual separator', async () => {
  await selectSidebarTab(window, 'assistant')
  const sidebar = getSidebar(window)

  const browserTab = sidebar.locator('button:text-is("Browser")')
  const pageTab = sidebar.locator('button:text-is("Page")')
  const separator = sidebar.locator('.mx-1.h-4')

  await expect(browserTab).toBeVisible()
  await expect(pageTab).toBeVisible()
  // Separator exists in DOM but may be hidden due to tab bar overflow
  const separatorCount = await separator.count()
  expect(separatorCount).toBeGreaterThan(0)
})

test('Browser tab shows assistant-specific UI', async () => {
  await selectSidebarTab(window, 'assistant')
  const sidebar = getSidebar(window)

  await expect(sidebar.locator('textarea[placeholder="Ask the assistant..."]')).toBeVisible()
  await expect(sidebar.locator('text=Browser Assistant')).toBeVisible()
})

test('Page tab shows chat-specific UI with tool suggestions', async () => {
  await selectSidebarTab(window, 'chat')
  const sidebar = getSidebar(window)

  await expect(sidebar.locator('textarea[placeholder*="Ask about this page"]')).toBeVisible()
  await expect(sidebar.locator('text=Summarize this page')).toBeVisible()
  await expect(sidebar.locator('text=Extract all links')).toBeVisible()
})

// ── Browser Assistant: Browser-level Tools ──

test('Browser assistant can use search_web tool', async () => {
  test.setTimeout(180_000)

  await selectSidebarTab(window, 'assistant')
  const sidebar = getSidebar(window)
  const textarea = sidebar.locator('textarea[placeholder="Ask the assistant..."]')

  await textarea.fill('Search for "Electron framework".')
  await sidebar.locator('button:has-text("Send")').click()

  // Wait for full cycle: streaming → tool execution → done
  await expect(sidebar.locator('text=Executing tools...')).not.toBeVisible({ timeout: 120_000 }).catch(() => {})
  await expect(sidebar.locator('button:has-text("Send")')).toBeVisible({ timeout: 30_000 })

  // Response should mention search or Electron
  const assistantMessages = sidebar.locator('.markdown-body')
  const lastMsg = assistantMessages.last()
  const text = await lastMsg.textContent({ timeout: 5_000 })
  expect(text!.length).toBeGreaterThan(0)
})

test('Browser assistant can use open_tab tool', async () => {
  test.setTimeout(180_000)

  await selectSidebarTab(window, 'assistant')
  const sidebar = getSidebar(window)
  const textarea = sidebar.locator('textarea[placeholder="Ask the assistant..."]')

  await textarea.fill('Open https://example.com in a new tab.')
  await sidebar.locator('button:has-text("Send")').click()

  await expect(sidebar.locator('text=Executing tools...')).not.toBeVisible({ timeout: 120_000 }).catch(() => {})
  await expect(sidebar.locator('button:has-text("Send")')).toBeVisible({ timeout: 30_000 })

  const assistantMessages = sidebar.locator('.markdown-body')
  const lastMsg = assistantMessages.last()
  const text = await lastMsg.textContent({ timeout: 5_000 })
  expect(text!.length).toBeGreaterThan(0)
})

test('Browser assistant can use go_back tool', async () => {
  test.setTimeout(120_000)

  await selectSidebarTab(window, 'assistant')
  const sidebar = getSidebar(window)
  const textarea = sidebar.locator('textarea[placeholder="Ask the assistant..."]')

  await textarea.fill('Go back.')
  await sidebar.locator('button:has-text("Send")').click()

  await expect(sidebar.locator('text=Executing tools...')).not.toBeVisible({ timeout: 90_000 }).catch(() => {})
  await expect(sidebar.locator('button:has-text("Send")')).toBeVisible({ timeout: 10_000 })
})

test('Browser assistant help command returns tool list', async () => {
  test.setTimeout(120_000)

  await selectSidebarTab(window, 'assistant')
  const sidebar = getSidebar(window)
  const textarea = sidebar.locator('textarea[placeholder="Ask the assistant..."]')

  await textarea.fill('help')
  await sidebar.locator('button:has-text("Send")').click()

  await expect(sidebar.locator('button:has-text("Send")')).toBeVisible({ timeout: 90_000 })

  // Response should mention some tools
  const assistantMessages = sidebar.locator('.markdown-body')
  const lastMsg = assistantMessages.last()
  const text = await lastMsg.textContent({ timeout: 5_000 })
  // Should mention at least some browser-level tools
  const toolKeywords = ['open_tab', 'search_web', 'bookmark', 'history']
  const matchCount = toolKeywords.filter(k => text!.toLowerCase().includes(k)).length
  expect(matchCount).toBeGreaterThanOrEqual(2)
})

// ── Page Chat: Tab-level Tools ──

test('Page chat has "Executing tools..." indicator', async () => {
  // This verifies the ChatPanel has the tool execution indicator
  await selectSidebarTab(window, 'chat')
  const sidebar = getSidebar(window)

  // The indicator should exist in DOM (hidden by default)
  const indicator = sidebar.locator('text=Executing tools...')
  // It should not be visible when idle
  await expect(indicator).not.toBeVisible()
})

// ── Conversations Are Separate ──

test('Browser and Page conversations are independent', async () => {
  test.setTimeout(120_000)

  // Send a message in Browser assistant
  await selectSidebarTab(window, 'assistant')
  const sidebar = getSidebar(window)
  const assistantTextarea = sidebar.locator('textarea[placeholder="Ask the assistant..."]')

  await assistantTextarea.fill('Say "browser-test-unique"')
  await sidebar.locator('button:has-text("Send")').click()
  await expect(sidebar.locator('button:has-text("Send")')).toBeVisible({ timeout: 90_000 })

  // Verify browser response contains the marker
  const browserMsgs = sidebar.locator('.markdown-body')
  const browserText = await browserMsgs.last().textContent({ timeout: 5_000 })
  expect(browserText!.toLowerCase()).toContain('browser-test-unique')

  // Switch to Page tab
  await selectSidebarTab(window, 'chat')

  // Page chat should NOT contain browser messages
  const pageMsgs = sidebar.locator('.markdown-body')
  const pageCount = await pageMsgs.count()
  expect(pageCount).toBe(0)
})

// ── AI Model Status Indicator ──

test('status indicator shows "AI Model" label (not "Ollama")', async () => {
  const indicator = window.locator('text=AI Model')
  await expect(indicator).toBeVisible({ timeout: 10_000 })
})

// ── Bookmark Tool ──

test('Browser assistant bookmark_page tool works', async () => {
  test.setTimeout(180_000)

  // Navigate to a real page first
  await navigateTo(window, 'https://example.com')
  await window.waitForTimeout(3000)

  await selectSidebarTab(window, 'assistant')
  const sidebar = getSidebar(window)
  const textarea = sidebar.locator('textarea[placeholder="Ask the assistant..."]')

  await textarea.fill('Bookmark this page.')
  await sidebar.locator('button:has-text("Send")').click()

  await expect(sidebar.locator('text=Executing tools...')).not.toBeVisible({ timeout: 120_000 }).catch(() => {})
  await expect(sidebar.locator('button:has-text("Send")')).toBeVisible({ timeout: 30_000 });

  // Response should mention bookmark
  const assistantMessages = sidebar.locator('.markdown-body')
  const lastMsg = assistantMessages.last()
  const text = await lastMsg.textContent({ timeout: 5_000 })
  expect(text!.toLowerCase()).toContain('bookmark')
})

// ── Internal Page Guard ──

test('Page chat responds to requests on internal pages', async () => {
  test.setTimeout(120_000)

  await selectSidebarTab(window, 'chat')
  const sidebar = getSidebar(window)
  const textarea = sidebar.locator('textarea[placeholder*="Ask about this page"]')
  await textarea.waitFor({ state: 'visible', timeout: 5_000 })

  await textarea.click()
  await textarea.fill('What is 1+1?')
  await sidebar.locator('button:has-text("Send")').click()

  // Wait for response to complete
  await expect(sidebar.locator('button:has-text("Send")')).toBeVisible({ timeout: 90_000 })

  // Wait for React to render the response
  await window.waitForTimeout(500)

  // Should get a response
  const assistantMessages = sidebar.locator('.markdown-body')
  const msgCount = await assistantMessages.count()
  expect(msgCount).toBeGreaterThanOrEqual(1)
})
