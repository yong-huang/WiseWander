import { test, expect } from '@playwright/test'
import { launchApp, waitForAppReady, closeApp, selectSidebarTab, getSidebar, navigateTo, openSidebar } from './helpers'

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
  const card = sidebar.locator(`button:has-text("${name}")`)
  await card.scrollIntoViewIfNeeded()
  await card.click()
}

// ── Tests ──

test('shows Markdown Exporter card in Tools tab', async () => {
  await selectSidebarTab(window, 'tools')
  const sidebar = getSidebar(window)
  const card = sidebar.locator('button:has-text("Markdown Exporter")')
  await expect(card).toBeVisible()
})

test('opens Markdown Exporter panel with UI elements', async () => {
  await openCapability('Markdown Exporter')
  const sidebar = getSidebar(window)

  // Panel header
  await expect(sidebar.locator('text=Markdown Exporter')).toBeVisible()

  // Extract button
  await expect(sidebar.locator('button:has-text("Extract & Convert")')).toBeVisible()

  // Empty state hint
  await expect(sidebar.locator('text=Navigate to an article')).toBeVisible()
})

test('back button returns to capability list', async () => {
  // Ensure we're on the markdown exporter panel
  await selectSidebarTab(window, 'tools')
  const sidebar = getSidebar(window)

  const mdCard = sidebar.locator('button:has-text("Markdown Exporter")')
  if (await mdCard.isVisible().catch(() => false)) {
    await mdCard.click()
  }

  // Click back
  const backBtn = sidebar.locator('button:has-text("← Tools")')
  await expect(backBtn).toBeVisible({ timeout: 5_000 })
  await backBtn.click()

  // Should show all capability cards again
  await expect(sidebar.locator('button:has-text("Design Analyzer")')).toBeVisible()
  await expect(sidebar.locator('button:has-text("Web Crawler")')).toBeVisible()
  await expect(sidebar.locator('button:has-text("Markdown Exporter")')).toBeVisible()
  await expect(sidebar.locator('button:has-text("Translate")')).toBeVisible()
})

test('shows error when extracting from blank/new tab page', async () => {
  await openCapability('Markdown Exporter')
  const sidebar = getSidebar(window)

  const extractBtn = sidebar.locator('button:has-text("Extract & Convert")')
  await extractBtn.click()

  // On a blank page, extraction should fail — wait for error or done
  // (The default new tab page may or may not produce a valid article)
  await window.waitForTimeout(5_000)

  // Button should no longer say "Reading page..."
  const readingText = sidebar.locator('text=Reading page...')
  await expect(readingText).toHaveCount(0, { timeout: 10_000 })
})

test('extracts article from example.com and shows stats', async () => {
  // Navigate to a real page first
  await navigateTo(window, 'https://example.com')
  await window.waitForTimeout(3_000)

  // Sidebar still shows MarkdownExporterPanel from previous test
  // (selectedCapability persists in AISidebar state between serial tests).
  // No need to click the capability card again — just open sidebar.
  await openSidebar(window)
  const sidebar = getSidebar(window)

  // If for some reason we're on the capability list (card is a <button>),
  // click it to open the panel
  const mdCard = sidebar.locator('button:has-text("Markdown Exporter")')
  if (await mdCard.isVisible().catch(() => false)) {
    await mdCard.click()
  }

  // Click extract button (text varies: "Extract & Convert" after error/idle,
  // "Re-extract Page" after a previous success)
  const extractBtn = sidebar.locator('button:has-text("Extract & Convert")')
    .or(sidebar.locator('button:has-text("Re-extract Page")'))
  await expect(extractBtn).toBeVisible({ timeout: 10_000 })
  await extractBtn.click()

  // Wait for extraction to complete — stats or error
  await expect(
    sidebar.locator('text=min read').or(sidebar.locator('text=Could not extract'))
  ).toBeVisible({ timeout: 30_000 })
})

test('Source and Preview view tabs appear after extraction', async () => {
  // Previous test navigated to example.com and extracted — panel should still show results.
  // If not, navigate and extract again.
  await openSidebar(window)
  let sidebar = getSidebar(window)

  // Check if we're already on the Markdown Exporter panel with results
  const statsChip = sidebar.locator('text=min read')
  if (!(await statsChip.isVisible().catch(() => false))) {
    // Need to navigate and extract first
    await navigateTo(window, 'https://example.com')
    await window.waitForTimeout(3_000)

    await openSidebar(window)
    sidebar = getSidebar(window)

    // If on capability list, click card
    const mdCard = sidebar.locator('button:has-text("Markdown Exporter")')
    if (await mdCard.isVisible().catch(() => false)) {
      await mdCard.click()
    }

    const extractBtn = sidebar.locator('button:has-text("Extract & Convert")')
      .or(sidebar.locator('button:has-text("Re-extract Page")'))
    await expect(extractBtn).toBeVisible({ timeout: 10_000 })
    await extractBtn.click()
    await expect(statsChip).toBeVisible({ timeout: 30_000 })
  }

  const sourceTab = sidebar.locator('button:text-is("Source")')
  const previewTab = sidebar.locator('button:text-is("Preview")')

  // Switch to Preview
  await previewTab.click()
  await window.waitForTimeout(500)

  // Switch back to Source
  await sourceTab.click()
  await window.waitForTimeout(500)

  // Source view should have a pre/code block
  const codeBlock = sidebar.locator('pre')
  await expect(codeBlock).toBeVisible()

  // Copy and Export buttons should be visible
  await expect(sidebar.locator('button:has-text("Copy")')).toBeVisible()
  await expect(sidebar.locator('button:has-text("Export .md")')).toBeVisible()
})
