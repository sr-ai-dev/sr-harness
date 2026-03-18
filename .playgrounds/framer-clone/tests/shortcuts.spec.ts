import { test, expect } from '@playwright/test'

declare global {
  interface Window {
    __editorStore: typeof import('../src/store/editorStore').useEditorStore
  }
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  // Reset store to clean state
  await page.evaluate(() => {
    window.__editorStore.setState({
      elements: {},
      rootIds: [],
      selection: { selectedIds: [], hoveredId: null },
      activeTool: 'select',
      isPreviewMode: false,
      clipboard: [],
    })
  })
})

// ── R11-S1: tool-switch ─────────────────────────────────────────────────────

test('tool-switch: pressing F switches to frame tool', async ({ page }) => {
  // Ensure Select is active first
  await expect(page.locator('[data-testid="tool-select"]')).toHaveAttribute('aria-pressed', 'true')

  await page.keyboard.press('f')

  await expect(page.locator('[data-testid="tool-frame"]')).toHaveAttribute('aria-pressed', 'true')
  const tool = await page.evaluate(() => window.__editorStore.getState().activeTool)
  expect(tool).toBe('frame')
})

test('tool-switch: pressing V switches to select tool', async ({ page }) => {
  // First switch to frame
  await page.keyboard.press('f')
  await expect(page.locator('[data-testid="tool-frame"]')).toHaveAttribute('aria-pressed', 'true')

  // Then back to select
  await page.keyboard.press('v')
  const tool = await page.evaluate(() => window.__editorStore.getState().activeTool)
  expect(tool).toBe('select')
})

test('tool-switch: pressing T switches to text tool', async ({ page }) => {
  await page.keyboard.press('t')
  const tool = await page.evaluate(() => window.__editorStore.getState().activeTool)
  expect(tool).toBe('text')
})

test('tool-switch: pressing R switches to rectangle tool', async ({ page }) => {
  await page.keyboard.press('r')
  const tool = await page.evaluate(() => window.__editorStore.getState().activeTool)
  expect(tool).toBe('rectangle')
})

// ── R11-S2: delete ──────────────────────────────────────────────────────────

test('delete: pressing Delete removes selected element', async ({ page }) => {
  // Add an element and select it
  await page.evaluate(() => {
    const store = window.__editorStore.getState()
    store.addElement({
      id: 'el-del-1',
      kind: 'rectangle',
      x: 100,
      y: 100,
      width: 100,
      height: 100,
      rotation: 0,
      opacity: 1,
      visible: true,
      locked: false,
      name: 'Rect',
      parentId: null,
      childIds: [],
      fill: '#ff0000',
      stroke: 'transparent',
      strokeWidth: 0,
      borderRadius: 0,
    })
    store.selectElement('el-del-1')
  })

  const countBefore = await page.evaluate(() => Object.keys(window.__editorStore.getState().elements).length)
  expect(countBefore).toBe(1)

  await page.keyboard.press('Delete')

  const countAfter = await page.evaluate(() => Object.keys(window.__editorStore.getState().elements).length)
  expect(countAfter).toBe(0)
})

// ── R11-S3: input-focus ─────────────────────────────────────────────────────

test('input-focus: shortcut not activated when input is focused', async ({ page }) => {
  // Focus any number input in the properties/breakpoint area
  const bpInput = page.locator('[data-testid="breakpoint-width-desktop"]')
  await bpInput.focus()

  // Get current tool
  const toolBefore = await page.evaluate(() => window.__editorStore.getState().activeTool)

  // Press F — should type into input, not switch tool
  await page.keyboard.press('f')

  const toolAfter = await page.evaluate(() => window.__editorStore.getState().activeTool)
  expect(toolAfter).toBe(toolBefore) // Tool unchanged
})

// ── R11-S4: delete-no-selection ─────────────────────────────────────────────

test('delete-no-selection: Delete with no selection does nothing', async ({ page }) => {
  // Add element but don't select it
  await page.evaluate(() => {
    const store = window.__editorStore.getState()
    store.addElement({
      id: 'el-nosel-1',
      kind: 'rectangle',
      x: 100,
      y: 100,
      width: 100,
      height: 100,
      rotation: 0,
      opacity: 1,
      visible: true,
      locked: false,
      name: 'Rect',
      parentId: null,
      childIds: [],
      fill: '#ff0000',
      stroke: 'transparent',
      strokeWidth: 0,
      borderRadius: 0,
    })
    // No selection
  })

  const countBefore = await page.evaluate(() => Object.keys(window.__editorStore.getState().elements).length)

  // No element selected, press Delete
  await page.keyboard.press('Delete')

  const countAfter = await page.evaluate(() => Object.keys(window.__editorStore.getState().elements).length)
  expect(countAfter).toBe(countBefore) // Nothing deleted
})
