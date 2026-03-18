import { test, expect } from '@playwright/test'

const MIN_ZOOM = 0.1
const MAX_ZOOM = 32

test.describe('Canvas Zoom Limits', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('min: zoom clamps at minimum (10%)', async ({ page }) => {
    const viewport = page.getByTestId('canvas-viewport')
    const canvas = page.getByTestId('canvas')
    const box = await canvas.boundingBox()
    const cx = (box?.x ?? 0) + (box?.width ?? 800) / 2
    const cy = (box?.y ?? 0) + (box?.height ?? 600) / 2

    await page.mouse.move(cx, cy)

    // Scroll down many times to zoom out past minimum
    for (let i = 0; i < 20; i++) {
      await page.mouse.wheel(0, 2000)
    }

    // Wait for zoom to stabilize
    await page.waitForTimeout(200)

    const zoomAttr = await viewport.getAttribute('data-zoom')
    const zoomValue = parseFloat(zoomAttr ?? '1')

    // Zoom should be clamped at minimum
    expect(zoomValue).toBeGreaterThanOrEqual(MIN_ZOOM)
    expect(zoomValue).toBeLessThanOrEqual(MIN_ZOOM + 0.05)
  })

  test('max: zoom clamps at maximum (3200%)', async ({ page }) => {
    const viewport = page.getByTestId('canvas-viewport')
    const canvas = page.getByTestId('canvas')
    const box = await canvas.boundingBox()
    const cx = (box?.x ?? 0) + (box?.width ?? 800) / 2
    const cy = (box?.y ?? 0) + (box?.height ?? 600) / 2

    await page.mouse.move(cx, cy)

    // Scroll up many times to zoom in past maximum
    for (let i = 0; i < 30; i++) {
      await page.mouse.wheel(0, -2000)
    }

    // Wait for zoom to stabilize
    await page.waitForTimeout(200)

    const zoomAttr = await viewport.getAttribute('data-zoom')
    const zoomValue = parseFloat(zoomAttr ?? '1')

    // Zoom should be clamped at maximum
    expect(zoomValue).toBeLessThanOrEqual(MAX_ZOOM)
    expect(zoomValue).toBeGreaterThanOrEqual(MAX_ZOOM - 0.5)
  })
})
