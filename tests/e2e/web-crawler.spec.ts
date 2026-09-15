import { test, expect } from '@playwright/test'
import { launchApp, waitForAppReady, closeApp, openSidebar, selectSidebarTab, getSidebar } from './helpers'

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

// ── Helper ──

/** Navigate to Tools tab and click a specific capability card */
async function openCapability(name: string): Promise<void> {
  await selectSidebarTab(window, 'tools')
  await window.waitForTimeout(300) // wait for React re-render
  const sidebar = getSidebar(window)

  // If a capability panel is already showing (from a previous test),
  // click Back to return to the capability list first
  const backBtn = sidebar.locator('button:has-text("← Back"), button:has-text("← Tools")')
  if (await backBtn.count() > 0) {
    await backBtn.first().click()
    await window.waitForTimeout(300)
  }

  const card = sidebar.locator(`button:has-text("${name}")`)
  await card.scrollIntoViewIfNeeded()
  await card.click()

  // If the capability shows stale results from a previous run, reset it.
  // The crawl state lives in Zustand and persists across mount/unmount cycles.
  const resetBtn = sidebar.locator('button:has-text("New Crawl")')
  if (await resetBtn.isVisible().catch(() => false)) {
    await resetBtn.click()
    await window.waitForTimeout(300)
  }
}

// ── Tests ──

test('shows Web Crawler card in Tools tab', async () => {
  await selectSidebarTab(window, 'tools')
  const sidebar = getSidebar(window)
  const crawlerCard = sidebar.locator('button:has-text("Web Crawler")')
  await expect(crawlerCard).toBeVisible()
})

test('opens Web Crawler panel with settings', async () => {
  await openCapability('Web Crawler')
  const sidebar = getSidebar(window)

  // Panel header
  await expect(sidebar.locator('text=🕷️ Web Crawler')).toBeVisible()

  // Settings elements
  await expect(sidebar.locator('text=Start URL')).toBeVisible()
  await expect(sidebar.locator('text=Max Depth')).toBeVisible()
  await expect(sidebar.locator('text=Images')).toBeVisible()
  await expect(sidebar.locator('text=Full Pages')).toBeVisible()
  await expect(sidebar.locator('text=Same domain only')).toBeVisible()
  await expect(sidebar.locator('text=Max Pages')).toBeVisible()

  // Both Analyze and Start Crawl buttons visible
  await expect(sidebar.locator('button:has-text("Analyze")')).toBeVisible()
  await expect(sidebar.locator('button:has-text("Start Crawl")')).toBeVisible()
})

test('back button returns to capability list', async () => {
  // Ensure we're on the crawler panel (could be there from previous test)
  await selectSidebarTab(window, 'tools')
  const sidebar = getSidebar(window)

  // If we're on the capability list, click Web Crawler to open the panel
  const crawlerCard = sidebar.locator('button:has-text("Web Crawler")')
  if (await crawlerCard.isVisible().catch(() => false)) {
    await crawlerCard.click()
  }

  // Now we should be on the crawler panel — click Back
  const backBtn = sidebar.locator('button:has-text("← Back")')
  await expect(backBtn).toBeVisible({ timeout: 5_000 })
  await backBtn.click()

  // Should show the capability list again
  await expect(sidebar.locator('button:has-text("Web Crawler")')).toBeVisible()
  await expect(sidebar.locator('button:has-text("Design Analyzer")')).toBeVisible()
})

test('crawl starts and shows progress then results', async () => {
  // Direct-start test (without dry run)
  await openCapability('Web Crawler')
  const sidebar = getSidebar(window)

  // Set URL and start
  const urlInput = sidebar.locator('input[type="url"]')
  await urlInput.fill('https://example.com')

  const startBtn = sidebar.locator('button:has-text("Start Crawl")')
  await startBtn.click()

  // Wait for the crawl to complete (max 30s for example.com)
  const resultIndicator = sidebar.locator('text=Crawl complete')
  await expect(resultIndicator).toBeVisible({ timeout: 30_000 })

  // Should show stats (use :is to avoid matching sidebar tab label text)
  await expect(sidebar.locator('p:text-is("pages")')).toBeVisible()
  await expect(sidebar.locator('p:text-is("images")')).toBeVisible()

  // Export and New Crawl buttons should appear
  await expect(sidebar.locator('button:has-text("Export")')).toBeVisible()
  await expect(sidebar.locator('button:has-text("New Crawl")')).toBeVisible()
})

test('Analyze button runs dry run and shows preview', async () => {
  await openCapability('Web Crawler')
  const sidebar = getSidebar(window)

  // Fill URL
  const urlInput = sidebar.locator('input[type="url"]')
  await urlInput.fill('https://example.com')

  // Click Analyze
  const analyzeBtn = sidebar.locator('button:has-text("Analyze")')
  await analyzeBtn.click()

  // Wait for analyzing spinner
  await expect(sidebar.locator('text=Analyzing page...')).toBeVisible({ timeout: 5_000 })

  // Wait for analysis preview panel
  const previewHeading = sidebar.locator('text=Analysis Preview')
  await expect(previewHeading).toBeVisible({ timeout: 30_000 })

  // Verify dry run stats are visible (use :is to avoid matching sidebar tab labels)
  await expect(sidebar.locator('text=est. pages')).toBeVisible()
  await expect(sidebar.locator('text=links')).toBeVisible()
  await expect(sidebar.locator('p:text-is("images")')).toBeVisible()

  // Both Analyze and Start Crawl should still be visible (not in crawl results)
  await expect(sidebar.locator('button:has-text("Start Crawl")')).toBeVisible()
})

test('dry run error is displayed for invalid URL', async () => {
  await openCapability('Web Crawler')
  const sidebar = getSidebar(window)

  // Fill invalid URL
  const urlInput = sidebar.locator('input[type="url"]')
  await urlInput.fill('not-a-valid-url-xyz123')

  // Click Analyze
  const analyzeBtn = sidebar.locator('button:has-text("Analyze")')
  await analyzeBtn.click()

  // Wait for error — red error box should appear
  // The dry run error div has border-red-200 bg-red-50 text-red-600 classes
  const errorBox = sidebar.locator('.border-red-200.bg-red-50, .dark\\:border-red-800, [class*="red-50"][class*="border-red"]')
  await expect(errorBox.first()).toBeVisible({ timeout: 15_000 })
})

test('Start Crawl after Analyze clears preview and runs full crawl', async () => {
  await openCapability('Web Crawler')
  const sidebar = getSidebar(window)

  // Fill URL and run dry run first
  const urlInput = sidebar.locator('input[type="url"]')
  await urlInput.fill('https://example.com')

  await sidebar.locator('button:has-text("Analyze")').click()
  await expect(sidebar.locator('text=Analysis Preview')).toBeVisible({ timeout: 30_000 })

  // Now click Start Crawl — dry run preview should disappear
  await sidebar.locator('button:has-text("Start Crawl")').click()

  // Analysis Preview should no longer be visible
  await expect(sidebar.locator('text=Analysis Preview')).not.toBeVisible({ timeout: 5_000 })

  // Wait for full crawl to complete
  await expect(sidebar.locator('text=Crawl complete')).toBeVisible({ timeout: 30_000 })

  // Export and New Crawl buttons should appear
  await expect(sidebar.locator('button:has-text("Export")')).toBeVisible()
  await expect(sidebar.locator('button:has-text("New Crawl")')).toBeVisible()
})

test('Analyze + Start Crawl in sequence (full flow)', async () => {
  await openCapability('Web Crawler')
  const sidebar = getSidebar(window)

  // Step 1: Fill URL and Analyze
  const urlInput = sidebar.locator('input[type="url"]')
  await urlInput.fill('https://example.com')

  await sidebar.locator('button:has-text("Analyze")').click()

  // Wait for analysis preview with stats
  await expect(sidebar.locator('text=Analysis Preview')).toBeVisible({ timeout: 30_000 })
  await expect(sidebar.locator('text=est. pages')).toBeVisible()
  await expect(sidebar.locator('text=links')).toBeVisible()
  await expect(sidebar.locator('p:text-is("images")')).toBeVisible()

  // Step 2: Start full crawl
  await sidebar.locator('button:has-text("Start Crawl")').click()

  // Step 3: Wait for crawl results with pages/images/duration stats (use :is for stats)
  await expect(sidebar.locator('text=Crawl complete')).toBeVisible({ timeout: 30_000 })
  await expect(sidebar.locator('p:text-is("pages")')).toBeVisible()
  await expect(sidebar.locator('p:text-is("images")')).toBeVisible()
  await expect(sidebar.locator('p:text-is("duration")')).toBeVisible()

  // Export and New Crawl buttons
  await expect(sidebar.locator('button:has-text("Export")')).toBeVisible()
  await expect(sidebar.locator('button:has-text("New Crawl")')).toBeVisible()
})

test('New Crawl resets to settings view', async () => {
  // This test assumes the previous crawl test left us in results state
  // If not, run a quick crawl first
  await selectSidebarTab(window, 'tools')
  const sidebar = getSidebar(window)

  // If we're on the results screen, click New Crawl; otherwise navigate there
  const newCrawlBtn = sidebar.locator('button:has-text("New Crawl")')
  if (await newCrawlBtn.isVisible().catch(() => false)) {
    await newCrawlBtn.click()
  } else {
    // Navigate to crawler and do a quick crawl
    await openCapability('Web Crawler')
    const urlInput = sidebar.locator('input[type="url"]')
    await urlInput.fill('https://example.com')
    await sidebar.locator('button:has-text("Start Crawl")').click()
    await sidebar.locator('text=Crawl complete').waitFor({ timeout: 30_000 })
    await sidebar.locator('button:has-text("New Crawl")').click()
  }

  // Should show settings again with both buttons
  await expect(sidebar.locator('text=Start URL')).toBeVisible()
  await expect(sidebar.locator('button:has-text("Analyze")')).toBeVisible()
  await expect(sidebar.locator('button:has-text("Start Crawl")')).toBeVisible()
})

test('Ollama footer removed from sidebar', async () => {
  await openSidebar(window)
  const sidebar = getSidebar(window)

  // The old Ollama status footer with "Model:" text should NOT exist
  const modelInfo = sidebar.locator('text=Model:')
  await expect(modelInfo).toHaveCount(0)
})
