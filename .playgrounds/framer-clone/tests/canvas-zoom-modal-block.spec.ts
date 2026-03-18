import { test, expect } from '@playwright/test'

test.describe('Canvas Zoom Modal Block', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('canvas does not zoom when a modal dialog is active', async ({ page }) => {
    const viewport = page.getByTestId('canvas-viewport')
    const canvas = page.getByTestId('canvas')

    // Get initial zoom
    const initialZoom = parseFloat((await viewport.getAttribute('data-zoom')) ?? '1')

    const box = await canvas.boundingBox()
    const cx = (box?.x ?? 0) + (box?.width ?? 800) / 2
    const cy = (box?.y ?? 0) + (box?.height ?? 600) / 2

    // Activate modal via store
    await page.evaluate(() => {
      window.__editorStore.getState().setModalOpen(true)
    })

    // Verify modal is marked as active on canvas
    await expect(canvas).toHaveAttribute('data-modal-open', 'true')

    // Attempt to zoom while modal is open
    await page.mouse.move(cx, cy)
    await page.mouse.wheel(0, -300)

    // Short wait to confirm no state change
    await page.waitForTimeout(200)

    const zoomAfterModal = parseFloat((await viewport.getAttribute('data-zoom')) ?? '1')

    // Zoom should not have changed
    expect(zoomAfterModal).toBe(initialZoom)

    // Close modal and verify zoom works again
    await page.evaluate(() => {
      window.__editorStore.getState().setModalOpen(false)
    })

    await page.mouse.wheel(0, -300)

    await page.waitForFunction(
      ([testId, prevZoom]) => {
        const el = document.querySelector(`[data-testid="${testId}"]`)
        if (!el) return false
        const zoom = parseFloat(el.getAttribute('data-zoom') ?? '1')
        return zoom > (prevZoom as number)
      },
      ['canvas-viewport', zoomAfterModal] as [string, number],
    )

    const zoomAfterModalClose = parseFloat((await viewport.getAttribute('data-zoom')) ?? '1')
    expect(zoomAfterModalClose).toBeGreaterThan(initialZoom)
  })
})
