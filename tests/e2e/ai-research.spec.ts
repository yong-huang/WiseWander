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

test('shows Research Assistant UI', async () => {
  await selectSidebarTab(window, 'research')
  const sidebar = getSidebar(window)

  await expect(sidebar.locator('text=Research Assistant')).toBeVisible()
  await expect(sidebar.locator('input[placeholder="Enter research topic..."]')).toBeVisible()

  const content = sidebar.locator('.flex-1.overflow-hidden')
  const researchBtn = content.locator('button.bg-teal-600')
  await expect(researchBtn).toBeVisible()
  await expect(researchBtn).toBeDisabled()
})

test('Research button enables when topic is entered', async () => {
  const sidebar = getSidebar(window)
  await sidebar.locator('input[placeholder="Enter research topic..."]').fill('React hooks')

  const content = sidebar.locator('.flex-1.overflow-hidden')
  await expect(content.locator('button.bg-teal-600')).toBeEnabled()
})

test('executes research and generates a report with real Ollama', async () => {
  test.setTimeout(180_000) // Research can take longer

  const sidebar = getSidebar(window)
  const content = sidebar.locator('.flex-1.overflow-hidden')

  // Click Research
  await content.locator('button.bg-teal-600').click()

  // Should show "Researching..." on the button
  await expect(content.locator('button:has-text("Researching...")')).toBeVisible({ timeout: 5_000 })

  // Wait for the report to appear (report has sections with headings)
  const reportHeading = sidebar.locator('text=/Generated|sections/i')
  await expect(reportHeading.first()).toBeVisible({ timeout: 120_000 })

  // The research button should return to "Research" text
  await expect(content.locator('button:has-text("Research")')).toBeVisible()
})

test('shows report/sources view tabs after research', async () => {
  const sidebar = getSidebar(window)

  // After research, there should be report/sources tabs
  await expect(sidebar.locator('button:has-text("report")')).toBeVisible()
  await expect(sidebar.locator('button:has-text("sources")')).toBeVisible()
})
