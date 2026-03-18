import { test, expect } from '@playwright/test'

test.describe('Canvas Pan', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('pans canvas when spacebar held and mouse dragged', async ({ page }) => {
    const viewport = page.getByTestId('canvas-viewport')

    // Get initial translate values
    const initTx = parseFloat((await viewport.getAttribute('data-translate-x')) ?? '0')
    const initTy = parseFloat((await viewport.getAttribute('data-translate-y')) ?? '0')

    const canvas = page.getByTestId('canvas')
    const box = await canvas.boundingBox()
    const cx = (box?.x ?? 0) + (box?.width ?? 800) / 2
    const cy = (box?.y ?? 0) + (box?.height ?? 600) / 2

    // Hold spacebar, drag mouse
    await page.keyboard.down('Space')
    await page.mouse.move(cx, cy)
    await page.mouse.down()
    await page.mouse.move(cx + 100, cy + 80)
    await page.mouse.up()
    await page.keyboard.up('Space')

    // Wait for translate values to change
    await page.waitForFunction(
      ([testId, prevTx, prevTy]) => {
        const el = document.querySelector(`[data-testid="${testId}"]`)
        if (!el) return false
        const tx = parseFloat(el.getAttribute('data-translate-x') ?? '0')
        const ty = parseFloat(el.getAttribute('data-translate-y') ?? '0')
        return tx !== (prevTx as number) || ty !== (prevTy as number)
      },
      ['canvas-viewport', initTx, initTy] as [string, number, number],
    )

    const newTx = parseFloat((await viewport.getAttribute('data-translate-x')) ?? '0')
    const newTy = parseFloat((await viewport.getAttribute('data-translate-y')) ?? '0')

    // CSS transform translate values update
    expect(newTx).not.toBe(initTx)
    expect(newTy).not.toBe(initTy)
  })
})
