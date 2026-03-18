import { test, expect } from '@playwright/test'

declare global {
  interface Window {
    __editorStore: typeof import('../src/store/editorStore').useEditorStore
  }
}

async function addRect(page: import('@playwright/test').Page, id: string, x = 100, y = 100) {
  await page.evaluate(({ id, x, y }) => {
    window.__editorStore.getState().addElement({
      id,
      kind: 'rectangle',
      x,
      y,
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
  }, { id, x, y })
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
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

// ── R12-S1: show-menu ────────────────────────────────────────────────────────

test('show-menu: right-click on element with selection shows context menu with all options', async ({ page }) => {
  await addRect(page, 'cm-el-1')
  await page.evaluate(() => {
    window.__editorStore.getState().selectElement('cm-el-1')
  })

  // Right-click via dispatchEvent to ensure contextmenu fires correctly in React
  await page.evaluate(() => {
    const el = document.querySelector('[data-testid="editor-layout"]') as HTMLElement
    const evt = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 400, clientY: 300 })
    el.dispatchEvent(evt)
  })

  const menu = page.locator('[data-testid="context-menu"]')
  await expect(menu).toBeVisible()

  // All expected options
  await expect(page.locator('[data-testid="context-menu-item-copy"]')).toBeVisible()
  await expect(page.locator('[data-testid="context-menu-item-duplicate"]')).toBeVisible()
  await expect(page.locator('[data-testid="context-menu-item-delete"]')).toBeVisible()
  await expect(page.locator('[data-testid="context-menu-item-bring-forward"]')).toBeVisible()
  await expect(page.locator('[data-testid="context-menu-item-send-backward"]')).toBeVisible()
  await expect(page.locator('[data-testid="context-menu-item-create-component"]')).toBeVisible()
})

// ── R12-S2: duplicate ────────────────────────────────────────────────────────

test('duplicate: clicking Duplicate in context menu creates a copy with offset', async ({ page }) => {
  await addRect(page, 'cm-el-dup')
  await page.evaluate(() => {
    window.__editorStore.getState().selectElement('cm-el-dup')
  })

  const countBefore = await page.evaluate(() => Object.keys(window.__editorStore.getState().elements).length)

  await page.evaluate(() => {
    const el = document.querySelector('[data-testid="editor-layout"]') as HTMLElement
    el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 400, clientY: 300 }))
  })
  await expect(page.locator('[data-testid="context-menu"]')).toBeVisible()

  await page.locator('[data-testid="context-menu-item-duplicate"]').click()

  // Menu should close
  await expect(page.locator('[data-testid="context-menu"]')).not.toBeVisible()

  const countAfter = await page.evaluate(() => Object.keys(window.__editorStore.getState().elements).length)
  expect(countAfter).toBe(countBefore + 1)

  // Verify offset
  const elements = await page.evaluate(() => {
    const state = window.__editorStore.getState()
    return Object.values(state.elements).map((el) => ({ id: el.id, x: el.x, y: el.y }))
  })
  const original = elements.find((el) => el.id === 'cm-el-dup')!
  const copy = elements.find((el) => el.id !== 'cm-el-dup')!
  expect(copy.x).toBe(original.x + 20)
  expect(copy.y).toBe(original.y + 20)
})

// ── R12-S3: empty-canvas ─────────────────────────────────────────────────────

test('empty-canvas: right-click empty canvas shows limited menu', async ({ page }) => {
  // No element selected
  await page.evaluate(() => {
    const el = document.querySelector('[data-testid="editor-layout"]') as HTMLElement
    el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 400, clientY: 300 }))
  })

  const menu = page.locator('[data-testid="context-menu"]')
  await expect(menu).toBeVisible()

  // Only Paste visible (no selection-dependent items)
  await expect(page.locator('[data-testid="context-menu-item-paste"]')).toBeVisible()
  await expect(page.locator('[data-testid="context-menu-item-copy"]')).not.toBeVisible()
  await expect(page.locator('[data-testid="context-menu-item-delete"]')).not.toBeVisible()
})

// ── R12-S4: dismiss ──────────────────────────────────────────────────────────

test('dismiss: clicking outside context menu closes it', async ({ page }) => {
  await addRect(page, 'cm-el-dismiss')
  await page.evaluate(() => {
    window.__editorStore.getState().selectElement('cm-el-dismiss')
  })

  await page.evaluate(() => {
    const el = document.querySelector('[data-testid="editor-layout"]') as HTMLElement
    el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 400, clientY: 300 }))
  })
  await expect(page.locator('[data-testid="context-menu"]')).toBeVisible()

  // Click somewhere else (outside the menu)
  await page.evaluate(() => {
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, clientX: 200, clientY: 200 }))
  })

  await expect(page.locator('[data-testid="context-menu"]')).not.toBeVisible()
})
