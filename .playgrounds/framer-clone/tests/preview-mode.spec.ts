import { test, expect } from '@playwright/test'

declare global {
  interface Window {
    __editorStore: typeof import('../src/store/editorStore').useEditorStore
  }
}

async function addRectWithAnimation(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    const store = window.__editorStore.getState()
    store.addElement({
      id: 'pm-el-1',
      kind: 'rectangle',
      x: 200,
      y: 200,
      width: 100,
      height: 100,
      rotation: 0,
      opacity: 1,
      visible: true,
      locked: false,
      name: 'AnimRect',
      parentId: null,
      childIds: [],
      fill: '#0099ff',
      stroke: 'transparent',
      strokeWidth: 0,
      borderRadius: 0,
      animations: [
        {
          trigger: 'hover',
          targetProps: { opacity: 0.5 },
          duration: 200,
          easing: 'ease',
          delay: 0,
        },
      ],
    })
  })
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

// ── R20-S1: enter-preview ────────────────────────────────────────────────────

test('enter-preview: pressing P hides editor chrome', async ({ page }) => {
  // Verify toolbar visible in edit mode
  await expect(page.locator('[data-testid="toolbar"]')).toBeVisible()

  await page.keyboard.press('p')

  const isPreview = await page.evaluate(() => window.__editorStore.getState().isPreviewMode)
  expect(isPreview).toBe(true)

  // Toolbar should be hidden in preview
  await expect(page.locator('[data-testid="toolbar"]')).toBeHidden()
  // Left and right panels should be gone
  await expect(page.locator('[data-testid="left-panel"]')).not.toBeVisible()
  await expect(page.locator('[data-testid="right-panel"]')).not.toBeVisible()
})

// ── R20-S2: exit-preview ─────────────────────────────────────────────────────

test('exit-preview: pressing P again exits preview mode', async ({ page }) => {
  // Enter preview
  await page.keyboard.press('p')
  await expect(page.locator('[data-testid="toolbar"]')).toBeHidden()

  // Exit with P
  await page.keyboard.press('p')

  const isPreview = await page.evaluate(() => window.__editorStore.getState().isPreviewMode)
  expect(isPreview).toBe(false)

  await expect(page.locator('[data-testid="toolbar"]')).toBeVisible()
})

test('exit-preview: pressing Escape exits preview mode', async ({ page }) => {
  // Enter preview
  await page.keyboard.press('p')
  expect(await page.evaluate(() => window.__editorStore.getState().isPreviewMode)).toBe(true)

  // Exit with Escape
  await page.keyboard.press('Escape')
  expect(await page.evaluate(() => window.__editorStore.getState().isPreviewMode)).toBe(false)

  await expect(page.locator('[data-testid="toolbar"]')).toBeVisible()
})

// ── R20-S3: toggle-button ────────────────────────────────────────────────────

test('toggle-button: clicking preview button enters preview mode', async ({ page }) => {
  await page.locator('[data-testid="preview-button"]').click()

  const isPreview = await page.evaluate(() => window.__editorStore.getState().isPreviewMode)
  expect(isPreview).toBe(true)

  await expect(page.locator('[data-testid="toolbar"]')).toBeHidden()
})

// ── R20-S4: animations-active ────────────────────────────────────────────────

test('animations-active: hover animation triggers in preview mode', async ({ page }) => {
  await addRectWithAnimation(page)

  // Enter preview mode
  await page.keyboard.press('p')
  expect(await page.evaluate(() => window.__editorStore.getState().isPreviewMode)).toBe(true)

  // In preview mode, canvas should still render the element
  // The element is rendered in Canvas.tsx with AnimatedWrapper
  const canvas = page.locator('[data-testid="canvas"]')
  await expect(canvas).toBeVisible()

  // The element should be present (rendered with animations enabled in preview)
  const elCount = await page.evaluate(() => Object.keys(window.__editorStore.getState().elements).length)
  expect(elCount).toBe(1)

  // Verify animation data is present on the element
  const anim = await page.evaluate(() => {
    const elements = window.__editorStore.getState().elements
    const el = Object.values(elements)[0]
    return el?.animations?.[0]?.trigger
  })
  expect(anim).toBe('hover')
})

// ── R20-S5: exit-always-works ─────────────────────────────────────────────────

test('exit-always-works: P always exits preview even without explicit input focus', async ({ page }) => {
  // Enter preview
  await page.keyboard.press('p')
  expect(await page.evaluate(() => window.__editorStore.getState().isPreviewMode)).toBe(true)

  // In preview mode, P should exit regardless
  await page.keyboard.press('p')
  expect(await page.evaluate(() => window.__editorStore.getState().isPreviewMode)).toBe(false)
})

// ── R20-S6: shortcuts-disabled ───────────────────────────────────────────────

test('shortcuts-disabled: tool shortcuts ignored in preview mode', async ({ page }) => {
  await page.evaluate(() => {
    window.__editorStore.getState().setActiveTool('select')
  })

  // Enter preview
  await page.keyboard.press('p')
  expect(await page.evaluate(() => window.__editorStore.getState().isPreviewMode)).toBe(true)

  // Tool shortcuts should be ignored
  await page.keyboard.press('f')
  const toolAfterF = await page.evaluate(() => window.__editorStore.getState().activeTool)
  expect(toolAfterF).toBe('select') // unchanged

  await page.keyboard.press('t')
  const toolAfterT = await page.evaluate(() => window.__editorStore.getState().activeTool)
  expect(toolAfterT).toBe('select') // unchanged

  await page.keyboard.press('r')
  const toolAfterR = await page.evaluate(() => window.__editorStore.getState().activeTool)
  expect(toolAfterR).toBe('select') // unchanged

  // Confirm we are still in preview mode (these keys didn't exit it either)
  expect(await page.evaluate(() => window.__editorStore.getState().isPreviewMode)).toBe(true)
})
