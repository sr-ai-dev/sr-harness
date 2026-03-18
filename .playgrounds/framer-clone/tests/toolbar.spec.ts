import { test, expect } from '@playwright/test'

test.describe('Toolbar', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('display-tools: all 6 tool icons visible, Select active by default', async ({ page }) => {
    const tools = ['select', 'frame', 'text', 'image', 'rectangle', 'ellipse']

    for (const tool of tools) {
      const btn = page.getByTestId(`tool-${tool}`)
      await expect(btn).toBeVisible()
    }

    // Select should be active by default (aria-pressed=true)
    const selectBtn = page.getByTestId('tool-select')
    await expect(selectBtn).toHaveAttribute('aria-pressed', 'true')

    // Active indicator should be visible within select button
    const activeIndicator = page.getByTestId('active-indicator')
    await expect(activeIndicator).toBeVisible()
  })

  test('switch-tool: click Rectangle icon switches active tool', async ({ page }) => {
    const rectangleBtn = page.getByTestId('tool-rectangle')
    await rectangleBtn.click()

    await expect(rectangleBtn).toHaveAttribute('aria-pressed', 'true')

    const selectBtn = page.getByTestId('tool-select')
    await expect(selectBtn).toHaveAttribute('aria-pressed', 'false')
  })

  test('auto-revert: tool auto-reverts to select after canvas click', async ({ page }) => {
    // Switch to rectangle tool
    const rectangleBtn = page.getByTestId('tool-rectangle')
    await rectangleBtn.click()
    await expect(rectangleBtn).toHaveAttribute('aria-pressed', 'true')

    // Click the canvas to simulate element creation
    const canvas = page.getByTestId('canvas')
    await canvas.click()

    // Tool should revert to select
    const selectBtn = page.getByTestId('tool-select')
    await expect(selectBtn).toHaveAttribute('aria-pressed', 'true')
  })

  test('hidden-in-preview: toolbar hidden when preview mode active', async ({ page }) => {
    const toolbar = page.getByTestId('toolbar')
    await expect(toolbar).toBeVisible()

    // Click preview button to enter preview mode
    const previewBtn = page.getByTestId('preview-button')
    await previewBtn.click()

    // Toolbar should now be hidden
    await expect(toolbar).toBeHidden()
  })
})
