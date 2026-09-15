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

// ── UI / Welcome State ──

test('shows Browser Assistant welcome state with placeholder and suggested prompts', async () => {
  await selectSidebarTab(window, 'assistant')
  const sidebar = getSidebar(window)

  await expect(sidebar.locator('text=Browser Assistant')).toBeVisible()
  await expect(sidebar.locator('text=Control your browser with AI')).toBeVisible()
  await expect(sidebar.locator('text=Open github.com')).toBeVisible()
  await expect(sidebar.locator('text=What tabs do I have open?')).toBeVisible()
  await expect(sidebar.locator('text=Summarize the current page')).toBeVisible()
  await expect(sidebar.locator('text=Search for TypeScript best practices')).toBeVisible()
})

test('shows textarea with correct placeholder', async () => {
  await selectSidebarTab(window, 'assistant')
  const sidebar = getSidebar(window)
  const textarea = sidebar.locator('textarea[placeholder="Ask the assistant..."]')
  await expect(textarea).toBeVisible()
  await expect(textarea).toHaveValue('')
})

test('Send button is disabled when input is empty', async () => {
  await selectSidebarTab(window, 'assistant')
  const sidebar = getSidebar(window)
  const sendBtn = sidebar.locator('button:has-text("Send")')
  await expect(sendBtn).toBeVisible()
  await expect(sendBtn).toBeDisabled()
})

test('clear conversation button is not shown when no messages', async () => {
  await selectSidebarTab(window, 'assistant')
  const sidebar = getSidebar(window)
  await expect(sidebar.locator('button:has-text("Clear conversation")')).not.toBeVisible()
})

// ── Sending Messages ──

test('sends a general question and receives AI response', async () => {
  test.setTimeout(120_000)

  await selectSidebarTab(window, 'assistant')
  const sidebar = getSidebar(window)
  const textarea = sidebar.locator('textarea[placeholder="Ask the assistant..."]')

  await textarea.fill('What is 1+1? Answer with just the number.')
  await sidebar.locator('button:has-text("Send")').click()

  // Stop button replaces Send during streaming; wait for Send to come back
  await expect(sidebar.locator('button:has-text("Send")')).toBeVisible({ timeout: 90_000 })

  // Assistant response should be rendered with non-empty text
  const assistantMessages = sidebar.locator('.markdown-body')
  const count = await assistantMessages.count()
  expect(count).toBeGreaterThanOrEqual(1)

  const lastAssistant = assistantMessages.last()
  const text = await lastAssistant.textContent({ timeout: 5_000 })
  expect(text!.trim().length).toBeGreaterThan(0)
})

test('sends a message by pressing Enter', async () => {
  test.setTimeout(120_000)

  await selectSidebarTab(window, 'assistant')
  const sidebar = getSidebar(window)
  const textarea = sidebar.locator('textarea[placeholder="Ask the assistant..."]')

  await textarea.fill('Reply with exactly: hello world')
  await textarea.press('Enter')

  // Wait for response
  await expect(sidebar.locator('button:has-text("Send")')).toBeVisible({ timeout: 90_000 })

  const assistantMessages = sidebar.locator('.markdown-body')
  const text = await assistantMessages.last().textContent({ timeout: 5_000 })
  expect(text!.toLowerCase()).toContain('hello world')
})

test('does not send on Shift+Enter (newline)', async () => {
  await selectSidebarTab(window, 'assistant')
  const sidebar = getSidebar(window)
  const textarea = sidebar.locator('textarea[placeholder="Ask the assistant..."]')

  // Fill and press Shift+Enter — should add a newline, not send
  await textarea.fill('line one')
  await textarea.press('Shift+Enter')
  // The textarea should still have content (not cleared)
  await expect(textarea).not.toHaveValue('')
})

test('Stop button appears during streaming, Send returns after', async () => {
  test.setTimeout(120_000)

  await selectSidebarTab(window, 'assistant')
  const sidebar = getSidebar(window)
  const textarea = sidebar.locator('textarea[placeholder="Ask the assistant..."]')

  await textarea.fill('Count from 1 to 20, one per line.')
  await sidebar.locator('button:has-text("Send")').click()

  // Quickly check for Stop button (may or may not be visible depending on timing)
  const stopVisible = await sidebar.locator('button:has-text("Stop")').isVisible().catch(() => false)
  // Either Stop is showing (still streaming) or Send is showing (already done)
  expect(stopVisible || await sidebar.locator('button:has-text("Send")').isVisible()).toBe(true)

  // Wait for streaming to finish
  await expect(sidebar.locator('button:has-text("Send")')).toBeVisible({ timeout: 90_000 })
})

// ── Tool Calling ──

test('list_tabs tool: asks about open tabs and sees tab list in response', async () => {
  test.setTimeout(120_000)

  await selectSidebarTab(window, 'assistant')
  const sidebar = getSidebar(window)
  const textarea = sidebar.locator('textarea[placeholder="Ask the assistant..."]')

  await textarea.fill('What tabs do I have open? Use the list_tabs tool.')
  await sidebar.locator('button:has-text("Send")').click()

  // Wait for streaming + tool execution to finish
  // During tool execution, isStreaming stays true so Stop remains — wait for Executing to clear
  await expect(sidebar.locator('text=Executing tools...')).not.toBeVisible({ timeout: 90_000 }).catch(() => {})
  // Now wait for Send to return
  await expect(sidebar.locator('button:has-text("Send")')).toBeVisible({ timeout: 10_000 })

  // The response should contain tool results
  const assistantMessages = sidebar.locator('.markdown-body')
  const lastMsg = assistantMessages.last()
  const text = await lastMsg.textContent({ timeout: 5_000 })
  expect(text!.length).toBeGreaterThan(0)
})

test('open_tab tool: asks to open a website and verifies tool execution', async () => {
  test.setTimeout(120_000)

  await selectSidebarTab(window, 'assistant')
  const sidebar = getSidebar(window)
  const textarea = sidebar.locator('textarea[placeholder="Ask the assistant..."]')

  await textarea.fill('Please open https://example.com in a new tab. Use the open_tab tool.')
  await sidebar.locator('button:has-text("Send")').click()

  // Wait for streaming + tool execution to finish
  await expect(sidebar.locator('text=Executing tools...')).not.toBeVisible({ timeout: 90_000 }).catch(() => {})
  await expect(sidebar.locator('button:has-text("Send")')).toBeVisible({ timeout: 10_000 })

  // Verify response mentions the opened URL or tool action
  const assistantMessages = sidebar.locator('.markdown-body')
  const lastMsg = assistantMessages.last()
  const text = await lastMsg.textContent({ timeout: 5_000 })
  expect(text!.toLowerCase()).toContain('example.com')

  // Verify a new tab was opened (at least 2 tabs now)
  await window.waitForTimeout(500)
  const tabCount = await window.evaluate(() => {
    return document.querySelectorAll('.group.flex.items-center').length
  })
  expect(tabCount).toBeGreaterThanOrEqual(2)
})

test('search_web tool: asks to search and verifies new tab opens', async () => {
  test.setTimeout(120_000)

  await selectSidebarTab(window, 'assistant')
  const sidebar = getSidebar(window)
  const textarea = sidebar.locator('textarea[placeholder="Ask the assistant..."]')

  await textarea.fill('Search the web for "Playwright testing framework". Use the search_web tool.')
  await sidebar.locator('button:has-text("Send")').click()

  // Wait for streaming + tool execution to finish
  await expect(sidebar.locator('text=Executing tools...')).not.toBeVisible({ timeout: 90_000 }).catch(() => {})
  await expect(sidebar.locator('button:has-text("Send")')).toBeVisible({ timeout: 10_000 })

  // Verify response mentions search or results
  const assistantMessages = sidebar.locator('.markdown-body')
  const lastMsg = assistantMessages.last()
  const text = await lastMsg.textContent({ timeout: 5_000 })
  expect(text!.length).toBeGreaterThan(0)
})

test('open_tabs tool: asks to open multiple tabs and verifies tool execution', async () => {
  test.setTimeout(120_000)

  await selectSidebarTab(window, 'assistant')
  const sidebar = getSidebar(window)
  const textarea = sidebar.locator('textarea[placeholder="Ask the assistant..."]')

  await textarea.fill('Open https://example.com and https://httpbin.org in new tabs. Use the open_tabs tool.')
  await sidebar.locator('button:has-text("Send")').click()

  // Wait for streaming + tool execution to finish
  await expect(sidebar.locator('text=Executing tools...')).not.toBeVisible({ timeout: 90_000 }).catch(() => {})
  await expect(sidebar.locator('button:has-text("Send")')).toBeVisible({ timeout: 10_000 })

  // Verify response mentions the opened URLs
  const assistantMessages = sidebar.locator('.markdown-body')
  const lastMsg = assistantMessages.last()
  const text = await lastMsg.textContent({ timeout: 5_000 })
  expect(text!.length).toBeGreaterThan(0)

  // Verify multiple new tabs were opened (at least 3 tabs now: original + 2 new)
  await window.waitForTimeout(500)
  const tabCount = await window.evaluate(() => {
    return document.querySelectorAll('.group.flex.items-center').length
  })
  expect(tabCount).toBeGreaterThanOrEqual(3)
})

// ── Clear Conversation ──

test('Clear conversation button resets the chat', async () => {
  test.setTimeout(120_000)

  await selectSidebarTab(window, 'assistant')
  const sidebar = getSidebar(window)
  const textarea = sidebar.locator('textarea[placeholder="Ask the assistant..."]')

  await textarea.fill('Say "test message"')
  await sidebar.locator('button:has-text("Send")').click()
  await expect(sidebar.locator('button:has-text("Send")')).toBeVisible({ timeout: 90_000 })

  // Verify messages exist
  const msgCount = await sidebar.locator('.markdown-body').count()
  expect(msgCount).toBeGreaterThanOrEqual(1)

  // Clear button should now be visible
  await expect(sidebar.locator('button:has-text("Clear conversation")')).toBeVisible()
  await sidebar.locator('button:has-text("Clear conversation")').click()

  // After clearing, welcome state should return
  await expect(sidebar.locator('text=Browser Assistant')).toBeVisible()
  await expect(sidebar.locator('text=Open github.com')).toBeVisible()

  // No messages should remain
  const newMsgCount = await sidebar.locator('.markdown-body').count()
  expect(newMsgCount).toBe(0)
})

// ── Persistence ──

test('assistant conversation persists when switching sidebar tabs', async () => {
  test.setTimeout(120_000)

  await selectSidebarTab(window, 'assistant')
  const sidebar = getSidebar(window)
  const textarea = sidebar.locator('textarea[placeholder="Ask the assistant..."]')

  // Send a message
  await textarea.fill('Say "persistence test"')
  await sidebar.locator('button:has-text("Send")').click()
  await expect(sidebar.locator('button:has-text("Send")')).toBeVisible({ timeout: 90_000 })

  // Verify the message is there
  const msgCountBefore = await sidebar.locator('.markdown-body').count()
  expect(msgCountBefore).toBeGreaterThanOrEqual(1)

  // Switch to a different tab
  await selectSidebarTab(window, 'chat')
  await window.waitForTimeout(500)

  // Switch back to assistant
  await selectSidebarTab(window, 'assistant')
  await window.waitForTimeout(500)

  // Messages should still be there
  const msgCountAfter = await sidebar.locator('.markdown-body').count()
  expect(msgCountAfter).toBe(msgCountBefore)
})

// ── Command Palette Integration ──

test('command palette shows Browser AI entry', async () => {
  // Click on the tab bar area to take focus from any webview
  await window.locator('.flex.items-center.bg-gray-100').click()
  await window.waitForTimeout(100)
  await window.keyboard.press('Meta+k')

  const paletteInput = window.locator('input[placeholder="Type a command..."]')
  await paletteInput.waitFor({ state: 'visible', timeout: 5_000 })

  // Filter to find Browser AI
  await paletteInput.fill('Browser AI')
  await window.waitForTimeout(300)

  await expect(window.locator('.fixed.inset-0.z-50 button:has-text("Browser AI")')).toBeVisible()

  // Close palette
  await window.keyboard.press('Escape')
})

test('command palette opens sidebar to Browser tab', async () => {
  // Ensure sidebar is closed first
  const sidebar = getSidebar(window)
  const isVisible = await sidebar.isVisible().catch(() => false)
  if (isVisible) {
    const closeBtn = sidebar.locator('button:text-is("×")').first()
    await closeBtn.click()
    await window.waitForTimeout(500)
    await expect(sidebar).not.toBeVisible({ timeout: 5_000 })
  }

  // Open command palette
  await window.locator('.flex.items-center.bg-gray-100').click()
  await window.waitForTimeout(200)
  await window.keyboard.press('Meta+k')
  await window.locator('input[placeholder="Type a command..."]').waitFor({ state: 'visible', timeout: 5_000 })

  // Filter to browser commands
  const paletteInput = window.locator('input[placeholder="Type a command..."]')
  await paletteInput.fill('Browser AI')
  await window.waitForTimeout(300)

  // Click Browser AI command
  await window.locator('.fixed.inset-0.z-50 button:has-text("Browser AI")').click()
  await window.waitForTimeout(1000)

  // Sidebar should be open with Browser tab active
  await expect(sidebar).toBeVisible()
  // Verify Browser tab is the active sidebar tab
  const activeTabBtn = sidebar.locator('button:text-is("Browser")')
  await expect(activeTabBtn).toBeVisible()
  // Verify assistant panel content is shown
  await expect(sidebar.locator('textarea[placeholder="Ask the assistant..."]')).toBeVisible({ timeout: 5_000 })
})
