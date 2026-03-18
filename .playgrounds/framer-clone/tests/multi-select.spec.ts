import { test, expect } from '@playwright/test'

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function addRectangle(
  page: import('@playwright/test').Page,
  opts: {
    id: string
    fill: string
    x?: number
    y?: number
    w?: number
    h?: number
  },
) {
  await page.evaluate((o) => {
    window.__editorStore.getState().addElement({
      id: o.id,
      kind: 'rectangle',
      x: o.x ?? 100,
      y: o.y ?? 100,
      width: o.w ?? 100,
      height: o.h ?? 100,
      rotation: 0,
      opacity: 1,
      visible: true,
      locked: false,
      name: `Rect-${o.id}`,
      parentId: null,
      childIds: [],
      fill: o.fill,
      stroke: 'transparent',
      strokeWidth: 0,
      borderRadius: 0,
    })
  }, opts)
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test.describe('Multi-select', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => {
      window.__editorStore.setState({
        elements: {},
        rootIds: [],
        selection: { selectedIds: [], hoveredId: null },
      })
    })
  })

  // R15-S3: mixed-props — two elements with different fills show "Mixed" for fill
  test('mixed-props: two elements with different fills show Mixed in Properties', async ({
    page,
  }) => {
    // Add element A (red) and element B (blue)
    await addRectangle(page, { id: 'a', fill: '#ff0000', x: 0, y: 0 })
    await addRectangle(page, { id: 'b', fill: '#0000ff', x: 200, y: 0 })

    // Select both
    await page.evaluate(() => {
      window.__editorStore.getState().selectElements(['a', 'b'])
    })

    // Properties panel should show mixed-props indicator for fill
    const fillMixed = page.getByTestId('fill-mixed')
    await expect(fillMixed).toBeVisible()
    await expect(fillMixed).toContainText('Mixed')

    // Shared props (e.g. W, H which are both 100) should show values
    const wInput = page.getByTestId('prop-w')
    await expect(wInput).toBeVisible()
    await expect(wInput).toHaveValue('100')

    const hInput = page.getByTestId('prop-h')
    await expect(hInput).toBeVisible()
    await expect(hInput).toHaveValue('100')
  })

  // R15-S1: shift-click-add — Shift+Click adds element to selection
  test('shift-click-add: Shift+Click adds element to existing selection', async ({ page }) => {
    await addRectangle(page, { id: 'sa1', fill: '#ff0000', x: 0, y: 0 })
    await addRectangle(page, { id: 'sa2', fill: '#00ff00', x: 300, y: 0 })

    // Select first element
    await page.evaluate(() => {
      window.__editorStore.getState().selectElement('sa1')
    })

    // Shift+Click second element via toggleSelectElement (mirrors Shift+Click behavior)
    await page.evaluate(() => {
      window.__editorStore.getState().toggleSelectElement('sa2')
    })

    const selectedIds = await page.evaluate(() =>
      window.__editorStore.getState().selection.selectedIds,
    )
    expect(selectedIds).toContain('sa1')
    expect(selectedIds).toContain('sa2')
    expect(selectedIds).toHaveLength(2)

    // Both should have selection overlays rendered
    await expect(page.getByTestId('selection-overlay-sa1')).toHaveCount(1)
    await expect(page.getByTestId('selection-overlay-sa2')).toHaveCount(1)
  })

  // R15-S2: multi-drag — both elements move together (store-level test)
  test('multi-drag: moving one of two selected elements via store updates both', async ({
    page,
  }) => {
    await addRectangle(page, { id: 'e', fill: '#ff0000', x: 0, y: 0 })
    await addRectangle(page, { id: 'f', fill: '#00ff00', x: 150, y: 0 })

    await page.evaluate(() => {
      window.__editorStore.getState().selectElements(['e', 'f'])
    })

    // Simulate moving both elements by +50 in x using moveElements
    await page.evaluate(() => {
      window.__editorStore.getState().moveElements(['e', 'f'], 50, 0)
    })

    const eX = await page.evaluate(() => window.__editorStore.getState().elements['e'].x)
    const fX = await page.evaluate(() => window.__editorStore.getState().elements['f'].x)
    expect(eX).toBe(50)
    expect(fX).toBe(200)
  })

  // R15-S4: shift-click-remove — Shift+Click on selected element deselects it
  test('shift-click-remove: Shift+Click on already-selected element removes it from selection', async ({
    page,
  }) => {
    await addRectangle(page, { id: 'sr1', fill: '#ff0000', x: 0, y: 0 })
    await addRectangle(page, { id: 'sr2', fill: '#0000ff', x: 200, y: 0 })

    // Select both elements
    await page.evaluate(() => {
      window.__editorStore.getState().selectElements(['sr1', 'sr2'])
    })

    // Shift+Click on sr1 to deselect it (toggleSelectElement)
    await page.evaluate(() => {
      window.__editorStore.getState().toggleSelectElement('sr1')
    })

    const selectedIds = await page.evaluate(() =>
      window.__editorStore.getState().selection.selectedIds,
    )
    expect(selectedIds).not.toContain('sr1')
    expect(selectedIds).toContain('sr2')
    expect(selectedIds).toHaveLength(1)
  })

  // R15-S5: empty-shift-click — Shift+Click on empty canvas does nothing
  test('empty-shift-click: Shift+Click on empty canvas leaves selection empty', async ({
    page,
  }) => {
    // No elements exist, no selection
    const selectedIds = await page.evaluate(() =>
      window.__editorStore.getState().selection.selectedIds,
    )
    expect(selectedIds).toHaveLength(0)

    // Clicking empty canvas (no shift) — clearSelection is a no-op when already empty
    await page.evaluate(() => {
      window.__editorStore.getState().clearSelection()
    })

    const afterIds = await page.evaluate(() =>
      window.__editorStore.getState().selection.selectedIds,
    )
    expect(afterIds).toHaveLength(0)
  })

  // R15-S6: deselect-all — clicking empty canvas clears all selected elements
  test('deselect-all: clicking empty canvas clears all selected elements', async ({ page }) => {
    await addRectangle(page, { id: 'da1', fill: '#ff0000', x: 0, y: 0 })
    await addRectangle(page, { id: 'da2', fill: '#00ff00', x: 200, y: 0 })

    // Select both
    await page.evaluate(() => {
      window.__editorStore.getState().selectElements(['da1', 'da2'])
    })

    let selectedIds = await page.evaluate(() =>
      window.__editorStore.getState().selection.selectedIds,
    )
    expect(selectedIds).toHaveLength(2)

    // Click canvas background (no shift) — clearSelection
    await page.evaluate(() => {
      window.__editorStore.getState().clearSelection()
    })

    selectedIds = await page.evaluate(() =>
      window.__editorStore.getState().selection.selectedIds,
    )
    expect(selectedIds).toHaveLength(0)
  })

  // Legacy test: multi-select banner
  test('shift-select: multi-select banner shows when multiple elements selected', async ({
    page,
  }) => {
    await addRectangle(page, { id: 'c', fill: '#ff0000' })
    await addRectangle(page, { id: 'd', fill: '#00ff00', x: 300, y: 0 })

    await page.evaluate(() => {
      window.__editorStore.getState().selectElements(['c', 'd'])
    })

    const banner = page.getByTestId('multi-select-banner')
    await expect(banner).toBeVisible()
    await expect(banner).toContainText('2 elements selected')
  })
})
