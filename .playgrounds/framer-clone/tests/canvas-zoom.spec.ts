import { test, expect } from '@playwright/test'

test.describe('Canvas Zoom', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('scale value increases when scrolling up', async ({ page }) => {
    const viewport = page.getByTestId('canvas-viewport')

    // Get initial zoom
    const initialZoom = await viewport.getAttribute('data-zoom')
    const initialZoomValue = parseFloat(initialZoom ?? '1')

    // Scroll up (wheel up = zoom in, negative deltaY)
    const canvas = page.getByTestId('canvas')
    const box = await canvas.boundingBox()
    const cx = (box?.x ?? 0) + (box?.width ?? 800) / 2
    const cy = (box?.y ?? 0) + (box?.height ?? 600) / 2

    await page.mouse.move(cx, cy)
    await page.mouse.wheel(0, -300)

    // Wait for state to update
    await page.waitForFunction(
      ([testId, prevZoom]) => {
        const el = document.querySelector(`[data-testid="${testId}"]`)
        if (!el) return false
        const zoom = parseFloat(el.getAttribute('data-zoom') ?? '1')
        return zoom > (prevZoom as number)
      },
      ['canvas-viewport', initialZoomValue] as [string, number],
    )

    const newZoom = await viewport.getAttribute('data-zoom')
    const newZoomValue = parseFloat(newZoom ?? '1')

    // scale value increases
    console.log(`scale value increases: ${initialZoomValue} → ${newZoomValue}`)
    expect(newZoomValue).toBeGreaterThan(initialZoomValue)
  })
})
