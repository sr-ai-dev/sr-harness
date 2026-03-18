import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeFrame(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    kind: 'frame',
    x: 50,
    y: 50,
    width: 400,
    height: 300,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    name: 'Frame',
    parentId: null,
    childIds: [],
    fill: '#ffffff',
    borderRadius: 0,
    clipContent: false,
    layoutMode: 'absolute',
    stackDirection: 'column',
    stackGap: 0,
    stackWrap: false,
    stackAlign: 'flex-start',
    stackJustify: 'flex-start',
    gridColumns: 2,
    gridGap: 0,
    ...overrides,
  }
}

function makeRect(id: string, parentId: string | null = null, overrides: Record<string, unknown> = {}) {
  return {
    id,
    kind: 'rectangle',
    x: 0,
    y: 0,
    width: 80,
    height: 60,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    name: id,
    parentId,
    childIds: [],
    fill: '#d1d5db',
    stroke: '#000000',
    strokeWidth: 0,
    borderRadius: 0,
    ...overrides,
  }
}

async function setState(
  page: Page,
  elements: Record<string, unknown>,
  rootIds: string[],
) {
  await page.evaluate(
    ({ els, roots }) => {
      window.__editorStore.setState({
        elements: els,
        rootIds: roots,
        selection: { selectedIds: [], hoveredId: null },
      })
    },
    { els: elements, roots: rootIds },
  )
}

async function selectEl(page: Page, id: string) {
  await page.evaluate((eid: string) => {
    window.__editorStore.getState().selectElement(eid)
  }, id)
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test.describe('Layout modes', () => {
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

  // R7-S1: absolute-to-stack — Frame with 2 children switches from Absolute to Stack → children reflow as flex column
  test('absolute-to-stack: switching Frame to Stack applies flexbox column layout', async ({ page }) => {
    const frame = makeFrame('f1', { layoutMode: 'absolute', childIds: ['r1', 'r2'] })
    const r1 = makeRect('r1', 'f1')
    const r2 = makeRect('r2', 'f1')

    await setState(
      page,
      { f1: frame, r1, r2 },
      ['f1'],
    )

    // Select the frame
    await selectEl(page, 'f1')

    // Layout mode section should be visible
    const layoutSection = page.getByTestId('layout-mode-section')
    await expect(layoutSection).toBeVisible()

    // Initially Absolute is active
    const absoluteBtn = page.getByTestId('layout-mode-absolute')
    await expect(absoluteBtn).toHaveClass(/bg-\[#0099ff\]/)

    // Click Stack mode
    const stackBtn = page.getByTestId('layout-mode-stack')
    await stackBtn.click()

    // Stack button is now active
    await expect(stackBtn).toHaveClass(/bg-\[#0099ff\]/)

    // Verify store update
    const layoutMode = await page.evaluate(() => {
      const state = window.__editorStore.getState()
      return (state.elements['f1'] as Record<string, unknown>).layoutMode
    })
    expect(layoutMode).toBe('stack')

    // The frame div should have data-layout-mode="stack"
    const frameDiv = page.locator('[data-element-id="f1"] [data-layout-mode]')
    await expect(frameDiv).toHaveAttribute('data-layout-mode', 'stack')

    // The frame should have display:flex applied
    const display = await page.evaluate(() => {
      const el = document.querySelector('[data-element-id="f1"] [data-layout-mode]') as HTMLElement | null
      return el ? window.getComputedStyle(el).display : null
    })
    expect(display).toBe('flex')

    // Stack controls should appear
    await expect(page.getByTestId('stack-controls')).toBeVisible()
  })

  // R7-S2: stack-gap — Frame in Stack mode with gap=10 renders children with gap
  test('stack-gap: Stack Frame with gap=10 applies 10px gap to children', async ({ page }) => {
    const frame = makeFrame('f1', {
      layoutMode: 'stack',
      stackDirection: 'column',
      stackGap: 10,
      childIds: ['r1', 'r2'],
    })
    const r1 = makeRect('r1', 'f1')
    const r2 = makeRect('r2', 'f1')

    await setState(page, { f1: frame, r1, r2 }, ['f1'])

    // Frame should have the gap applied
    const gapValue = await page.evaluate(() => {
      const el = document.querySelector('[data-element-id="f1"] [data-layout-mode]') as HTMLElement | null
      return el ? window.getComputedStyle(el).gap : null
    })
    expect(gapValue).toBe('10px')

    // Select frame and add a new child to verify it also gets the gap
    await selectEl(page, 'f1')
    const stackControls = page.getByTestId('stack-controls')
    await expect(stackControls).toBeVisible()

    // Verify gap input shows 10
    const gapInput = page.getByTestId('stack-gap')
    await expect(gapInput).toHaveValue('10')

    // Add a 3rd child via store
    await page.evaluate(() => {
      const state = window.__editorStore.getState()
      state.addElement({
        id: 'r3',
        kind: 'rectangle',
        x: 0,
        y: 0,
        width: 80,
        height: 60,
        rotation: 0,
        opacity: 1,
        visible: true,
        locked: false,
        name: 'r3',
        parentId: 'f1',
        childIds: [],
        fill: '#ff0000',
        stroke: '#000000',
        strokeWidth: 0,
        borderRadius: 0,
      })
      // Add r3 to frame's childIds
      state.updateElement('f1', { childIds: ['r1', 'r2', 'r3'] } as never)
    })

    // Gap should still be 10px
    const gapAfter = await page.evaluate(() => {
      const el = document.querySelector('[data-element-id="f1"] [data-layout-mode]') as HTMLElement | null
      return el ? window.getComputedStyle(el).gap : null
    })
    expect(gapAfter).toBe('10px')
  })

  // R7-S3: grid-2col — Frame in Grid with 2 columns and 4 children renders in 2x2 grid
  test('grid-2col: Frame in Grid mode with 2 columns renders CSS grid', async ({ page }) => {
    const frame = makeFrame('f1', {
      layoutMode: 'grid',
      gridColumns: 2,
      gridGap: 0,
      childIds: ['r1', 'r2', 'r3', 'r4'],
    })
    const r1 = makeRect('r1', 'f1')
    const r2 = makeRect('r2', 'f1')
    const r3 = makeRect('r3', 'f1')
    const r4 = makeRect('r4', 'f1')

    await setState(page, { f1: frame, r1, r2, r3, r4 }, ['f1'])

    // Frame should have display:grid
    const display = await page.evaluate(() => {
      const el = document.querySelector('[data-element-id="f1"] [data-layout-mode]') as HTMLElement | null
      return el ? window.getComputedStyle(el).display : null
    })
    expect(display).toBe('grid')

    // Should have data-layout-mode="grid"
    const frameDiv = page.locator('[data-element-id="f1"] [data-layout-mode]')
    await expect(frameDiv).toHaveAttribute('data-layout-mode', 'grid')

    // Select frame, grid controls should appear with columns=2
    await selectEl(page, 'f1')
    const gridControls = page.getByTestId('grid-controls')
    await expect(gridControls).toBeVisible()
    const colsInput = page.getByTestId('grid-columns')
    await expect(colsInput).toHaveValue('2')
  })

  // R7-S4: empty-stack — Frame in Stack mode with no children renders without error
  test('empty-stack: Frame in Stack mode with no children renders without error', async ({ page }) => {
    const frame = makeFrame('f1', {
      layoutMode: 'stack',
      stackDirection: 'column',
      stackGap: 0,
      childIds: [],
    })

    await setState(page, { f1: frame }, ['f1'])

    // Frame should still be rendered
    const frameContainer = page.locator('[data-element-id="f1"]')
    await expect(frameContainer).toHaveCount(1)

    const frameDiv = page.locator('[data-element-id="f1"] [data-layout-mode]')
    await expect(frameDiv).toHaveAttribute('data-layout-mode', 'stack')

    // Display should be flex
    const display = await page.evaluate(() => {
      const el = document.querySelector('[data-element-id="f1"] [data-layout-mode]') as HTMLElement | null
      return el ? window.getComputedStyle(el).display : null
    })
    expect(display).toBe('flex')

    // No JS errors (page should not have error)
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))
    // Wait a tick to flush any pending errors
    await page.waitForTimeout(100)
    expect(errors).toHaveLength(0)
  })

  // R7-S5: non-frame — Non-Frame element selected → Layout mode controls are hidden
  test('non-frame: Layout mode controls not shown for non-Frame elements', async ({ page }) => {
    const rect = makeRect('r1', null)

    await setState(page, { r1: rect }, ['r1'])
    await selectEl(page, 'r1')

    // Layout mode section should not exist
    const layoutSection = page.getByTestId('layout-mode-section')
    await expect(layoutSection).toHaveCount(0)
  })
})
