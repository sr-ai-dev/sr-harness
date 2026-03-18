import { test, expect } from '@playwright/test'

test.describe('Theme', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('font-fallback: editor renders with Inter or system sans-serif fallback', async ({ page }) => {
    // Verify the body has an appropriate font-family (Inter or fallback sans-serif)
    const bodyFontFamily = await page.evaluate(() => {
      return window.getComputedStyle(document.body).fontFamily
    })

    // Font family should contain Inter or a system sans-serif
    const hasFontFamily = /inter|sans-serif|system-ui|ui-sans-serif/i.test(bodyFontFamily)
    expect(hasFontFamily).toBe(true)

    // Editor layout should still be visible even if Inter fails
    const editorLayout = page.getByTestId('editor-layout')
    await expect(editorLayout).toBeVisible()
  })
})
