import { _electron as electron, ElectronApplication, Page, Locator } from '@playwright/test'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

export interface TestApp {
  app: ElectronApplication
  window: Page
}

/**
 * Get the sidebar locator (the element with w-[340px] Tailwind class).
 */
export function getSidebar(window: Page): Locator {
  return window.locator('[class*="340px"]')
}

/**
 * Launch the WiseWander Electron app and wait for the first window.
 */
export async function launchApp(): Promise<TestApp> {
  const mainPath = join(__dirname, '../../out/main/index.js')
  const app = await electron.launch({
    args: [mainPath],
    env: {
      ...process.env,
      OLLAMA_LLM_LIBRARY: 'cpu',
      NODE_ENV: 'test',
    },
  })

  const window = await app.firstWindow()
  return { app, window }
}

/**
 * Wait for the initial tab to finish loading (app is ready).
 */
export async function waitForAppReady(window: Page): Promise<void> {
  await window.waitForSelector('input[placeholder="Search or enter URL..."]', {
    timeout: 15_000,
  })
}

/**
 * Type a URL in the address bar and press Enter to navigate.
 */
export async function navigateTo(window: Page, url: string): Promise<void> {
  const input = window.locator('input[placeholder="Search or enter URL..."]')
  await input.click()
  await input.fill(url)
  await input.press('Enter')
}

/**
 * Get the address bar input value, handling the focus state issue.
 * After pressing Enter, blurs the input so the URL syncs.
 */
export async function getAddressBarValue(window: Page): Promise<string> {
  const input = window.locator('input[placeholder="Search or enter URL..."]')
  // Blur first so the URL syncs from the store
  await input.blur()
  await window.waitForTimeout(100)
  return input.inputValue()
}

/**
 * Open the AI sidebar if not already open, by clicking the toggle button.
 */
export async function openSidebar(window: Page): Promise<void> {
  const sidebar = getSidebar(window)
  const isVisible = await sidebar.isVisible().catch(() => false)
  if (!isVisible) {
    await window.locator('button[title="Toggle AI Sidebar (Cmd+Shift+S)"]').click()
    await sidebar.waitFor({ state: 'visible', timeout: 5_000 })
  }
}

/**
 * Map internal sidebar tab IDs to their displayed labels.
 */
const TAB_LABELS: Record<string, string> = {
  assistant: 'Browser',
  chat: 'Page',
  recommend: 'For You',
}

/**
 * Switch to a specific tab in the AI sidebar (chat/summary/agent/research/recommend/tools).
 */
export async function selectSidebarTab(window: Page, tab: string): Promise<void> {
  await openSidebar(window)
  const sidebar = getSidebar(window)
  const label = TAB_LABELS[tab] ?? capitalize(tab)
  const tabButton = sidebar.locator(`button:text-is("${label}")`)
  await tabButton.scrollIntoViewIfNeeded()
  await window.waitForTimeout(200)
  try {
    await tabButton.click({ timeout: 5_000 })
  } catch {
    // Overflow container may intercept pointer events — use programmatic click
    await tabButton.evaluate((el) => (el as HTMLElement).click())
  }
}

/**
 * Close the AI sidebar.
 */
export async function closeSidebar(window: Page): Promise<void> {
  const sidebar = getSidebar(window)
  const isVisible = await sidebar.isVisible().catch(() => false)
  if (isVisible) {
    const closeBtn = sidebar.locator('button:text-is("×")').first()
    await closeBtn.click()
  }
}

/**
 * Set the Ollama model for AI operations.
 * Uses the app's IPC to set and persist the model choice.
 * Retries if Ollama is not yet reachable (up to `timeout` ms).
 */
export async function setModel(window: Page, model: string, timeout = 30_000): Promise<void> {
  const deadline = Date.now() + timeout
  while (true) {
    try {
      await window.evaluate(async (m) => {
        await (window as any).api.ollamaSetModel(m)
      }, model)
      return
    } catch {
      if (Date.now() > deadline) throw new Error(`Ollama not reachable after ${timeout}ms`)
      await window.waitForTimeout(2_000)
    }
  }
}

/**
 * Safely close the Electron app.
 */
export async function closeApp(app: ElectronApplication): Promise<void> {
  await app.close()
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/**
 * Create a new tab by clicking the "+" button.
 */
export async function openNewTab(window: Page): Promise<void> {
  await window.locator('button[title="New Tab (Cmd+T)"]').click()
  await window.waitForFunction(
    () => document.querySelectorAll('.group.flex.items-center.gap-1\\.5').length > 0,
    { timeout: 5_000 }
  )
}
