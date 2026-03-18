import { test, expect } from '@playwright/test'

// Helper: add a rectangle element directly via store
async function addRectangle(
  page: import('@playwright/test').Page,
  opts: { id?: string; x?: number; y?: number; w?: number; h?: number } = {},
) {
  const id = opts.id ?? `test-rect-${Date.now()}`
  await page.evaluate(
    ({ id, x, y, w, h }) => {
      window.__editorStore.getState().addElement({
        id,
        kind: 'rectangle',
        name: 'TestRect',
        x: x ?? 100,
        y: y ?? 100,
        width: w ?? 200,
        height: h ?? 150,
        rotation: 0,
        opacity: 1,
        visible: true,
        locked: false,
        parentId: null,
        childIds: [],
        fill: '#d1d5db',
        stroke: '#000000',
        strokeWidth: 0,
        borderRadius: 0,
      })
    },
    { id, x: opts.x ?? 100, y: opts.y ?? 100, w: opts.w ?? 200, h: opts.h ?? 150 },
  )
  return id
}

test.describe('Element Transform', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => {
      const store = window.__editorStore.getState()
      store.deleteElements(store.rootIds.slice())
      store.revertToSelect()
      store.clearSelection()
    })
  })

  // ─── R3-S1: drag-move ────────────────────────────────────────────────────────

  test('drag-move: dragging selected element updates x/y in store', async ({ page }) => {
    const id = await addRectangle(page, { x: 100, y: 100, w: 200, h: 150 })

    // Select the element via store
    await page.evaluate((id) => window.__editorStore.getState().selectElement(id), id)

    // Get the element body handle position
    const overlay = page.getByTestId(`element-body-${id}`)
    await expect(overlay).toBeVisible()
    const box = await overlay.boundingBox()
    expect(box).not.toBeNull()

    // Drag center by 50px right, 30px down
    const cx = box!.x + box!.width / 2
    const cy = box!.y + box!.height / 2

    await page.mouse.move(cx, cy)
    await page.mouse.down()
    await page.mouse.move(cx + 50, cy + 30, { steps: 5 })
    await page.mouse.up()

    const el = await page.evaluate(
      (id) => window.__editorStore.getState().elements[id],
      id,
    )
    expect(el).toBeTruthy()
    // x and y should have increased roughly by 50/30 (at zoom=1, camera.x=0)
    expect((el as { x: number }).x).toBeGreaterThan(120)
    expect((el as { y: number }).y).toBeGreaterThan(110)
  })

  // ─── R3-S2: resize ────────────────────────────────────────────────────────────

  test('resize: dragging se corner handle resizes element', async ({ page }) => {
    const id = await addRectangle(page, { x: 100, y: 100, w: 200, h: 150 })
    await page.evaluate((id) => window.__editorStore.getState().selectElement(id), id)

    const handle = page.getByTestId(`resize-handle-se-${id}`)
    await expect(handle).toBeVisible()
    const box = await handle.boundingBox()
    expect(box).not.toBeNull()

    const hx = box!.x + box!.width / 2
    const hy = box!.y + box!.height / 2

    await page.mouse.move(hx, hy)
    await page.mouse.down()
    await page.mouse.move(hx + 60, hy + 40, { steps: 5 })
    await page.mouse.up()

    const el = await page.evaluate(
      (id) => window.__editorStore.getState().elements[id],
      id,
    )
    expect((el as { width: number }).width).toBeGreaterThan(220)
    expect((el as { height: number }).height).toBeGreaterThan(160)
  })

  // ─── R3-S3: rotate ────────────────────────────────────────────────────────────

  test('rotate: dragging rotation handle updates element rotation', async ({ page }) => {
    const id = await addRectangle(page, { x: 200, y: 200, w: 200, h: 150 })
    await page.evaluate((id) => window.__editorStore.getState().selectElement(id), id)

    // Initial rotation should be 0
    const before = await page.evaluate(
      (id) => (window.__editorStore.getState().elements[id] as { rotation: number }).rotation,
      id,
    )
    expect(before).toBe(0)

    const rotHandle = page.getByTestId(`rotate-handle-${id}`)
    await expect(rotHandle).toBeVisible()
    const box = await rotHandle.boundingBox()
    expect(box).not.toBeNull()

    const hx = box!.x + box!.width / 2
    const hy = box!.y + box!.height / 2

    // Drag to a point significantly offset from current position
    await page.mouse.move(hx, hy)
    await page.mouse.down()
    await page.mouse.move(hx + 80, hy + 80, { steps: 5 })
    await page.mouse.up()

    const after = await page.evaluate(
      (id) => (window.__editorStore.getState().elements[id] as { rotation: number }).rotation,
      id,
    )
    // rotation should have changed from 0
    expect(Math.abs(after)).toBeGreaterThan(0)
  })

  // ─── R3-S4: flip-resize ──────────────────────────────────────────────────────

  test('flip-resize: dragging handle past opposite edge keeps positive dimensions', async ({ page }) => {
    const id = await addRectangle(page, { x: 200, y: 200, w: 200, h: 150 })
    await page.evaluate((id) => window.__editorStore.getState().selectElement(id), id)

    // Use the 'e' (right) handle and drag far left, past the left edge
    const handle = page.getByTestId(`resize-handle-e-${id}`)
    await expect(handle).toBeVisible()
    const box = await handle.boundingBox()
    expect(box).not.toBeNull()

    const hx = box!.x + box!.width / 2
    const hy = box!.y + box!.height / 2

    // Drag left by 300px (well past the left edge at zoom=1)
    await page.mouse.move(hx, hy)
    await page.mouse.down()
    await page.mouse.move(hx - 300, hy, { steps: 10 })
    await page.mouse.up()

    const el = await page.evaluate(
      (id) => window.__editorStore.getState().elements[id],
      id,
    )
    const w = (el as { width: number }).width
    const h = (el as { height: number }).height
    // Dimensions must always be positive (flip behavior)
    expect(w).toBeGreaterThan(0)
    expect(h).toBeGreaterThan(0)
  })

  // ─── R3-S5: marquee ──────────────────────────────────────────────────────────

  test('marquee: dragging on empty canvas selects intersecting elements', async ({ page }) => {
    // Add two elements at known canvas positions
    const id1 = await addRectangle(page, { id: 'rect1', x: 50, y: 50, w: 100, h: 80 })
    const id2 = await addRectangle(page, { id: 'rect2', x: 500, y: 500, w: 100, h: 80 })

    // Ensure nothing is selected
    await page.evaluate(() => window.__editorStore.getState().clearSelection())

    // At zoom=1, camera.x=0, camera.y=0: canvas coords = screen coords relative to canvas
    const canvas = page.getByTestId('canvas')
    const canvasBox = await canvas.boundingBox()
    expect(canvasBox).not.toBeNull()

    // Read actual camera state
    const camera = await page.evaluate(() => window.__editorStore.getState().camera)

    // Compute screen positions of rect1 (should be near canvas top-left)
    const rect1ScreenX = canvasBox!.x + 50 * camera.zoom + camera.x
    const rect1ScreenY = canvasBox!.y + 50 * camera.zoom + camera.y

    // Drag marquee from just before rect1 to just after it
    const startX = rect1ScreenX - 10
    const startY = rect1ScreenY - 10
    const endX = rect1ScreenX + 120
    const endY = rect1ScreenY + 100

    await page.mouse.move(startX, startY)
    await page.mouse.down()
    await page.mouse.move(endX, endY, { steps: 5 })

    // Marquee should appear
    const marquee = page.getByTestId('selection-marquee')
    await expect(marquee).toBeVisible()

    await page.mouse.up()

    // rect1 should be selected
    const sel = await page.evaluate(
      () => window.__editorStore.getState().selection.selectedIds,
    )
    expect(sel).toContain(id1)

    // rect2 should not be selected (it's far away)
    expect(sel).not.toContain(id2)
  })
})
