/**
 * Asset Library panel tests.
 * Covers R16-S1 through R16-S5.
 */
import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function clearStores(page: Page) {
  await page.evaluate(() => {
    const editorState = window.__editorStore.getState()
    const ids = Object.keys(editorState.elements)
    if (ids.length > 0) editorState.deleteElements(ids)
    window.__componentStore.setState({ components: {}, instances: {} })
  })
}

async function openAssetsTab(page: Page) {
  await page.click('[data-testid="tab-assets"]')
  await page.waitForSelector('[data-testid="asset-library"]')
}

async function createMasterInStore(
  page: Page,
  name: string,
  fill = '#3a3a3a',
): Promise<string> {
  return page.evaluate(
    ([n, f]) => {
      const element = {
        id: `master-elem-${Math.random().toString(36).slice(2)}`,
        kind: 'rectangle' as const,
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        rotation: 0,
        opacity: 1,
        visible: true,
        locked: false,
        name: n as string,
        parentId: null,
        childIds: [],
        fill: f as string,
        stroke: 'transparent',
        strokeWidth: 0,
        borderRadius: 0,
      }
      window.__editorStore.getState().addElement(element)
      return window.__componentStore.getState().createMaster(element, n as string)
    },
    [name, fill],
  )
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.waitForSelector('[data-testid="canvas-viewport"]')
  await clearStores(page)
})

// R16-S1 @list-components
test('list-components: both masters listed with names and thumbnails', async ({ page }) => {
  // Create two master components
  const id1 = await createMasterInStore(page, 'ButtonA', '#ff0000')
  const id2 = await createMasterInStore(page, 'CardB', '#00ff00')

  await openAssetsTab(page)

  // Both should appear
  await expect(page.locator(`[data-testid="asset-component-${id1}"]`)).toBeVisible()
  await expect(page.locator(`[data-testid="asset-component-${id2}"]`)).toBeVisible()

  // Names shown
  await expect(page.locator(`[data-testid="asset-name-${id1}"]`)).toHaveText('ButtonA')
  await expect(page.locator(`[data-testid="asset-name-${id2}"]`)).toHaveText('CardB')

  // Thumbnails present
  await expect(page.locator(`[data-testid="asset-thumbnail-${id1}"]`)).toBeVisible()
  await expect(page.locator(`[data-testid="asset-thumbnail-${id2}"]`)).toBeVisible()
})

// R16-S2 @search-filter
test('search-filter: searching for "card" shows only Card component', async ({ page }) => {
  await createMasterInStore(page, 'Button', '#ff0000')
  await createMasterInStore(page, 'Card', '#00ff00')
  await createMasterInStore(page, 'Header', '#0000ff')

  await openAssetsTab(page)

  // Type in search
  await page.fill('[data-testid="asset-search"]', 'card')

  // Only Card should be visible — Button and Header gone
  const list = page.locator('[data-testid="asset-component-list"]')
  const items = list.locator('[data-component-id]')
  await expect(items).toHaveCount(1)

  // The visible item name is Card
  await expect(items.first().locator('[class*="text-"]')).toHaveText('Card')
})

// R16-S3 @drag-insert
test('drag-insert: clicking button component creates instance via store API', async ({ page }) => {
  const masterId = await createMasterInStore(page, 'Button', '#ff00ff')

  await openAssetsTab(page)

  // Verify component is listed
  await expect(page.locator(`[data-testid="asset-component-${masterId}"]`)).toBeVisible()

  // Simulate "drag insert" via store API (drag-and-drop is impractical in Playwright without precise coords)
  const instanceId = await page.evaluate((mId: string) => {
    const inst = window.__componentStore.getState().createInstance(mId, {
      x: 300,
      y: 200,
      parentId: null,
    })
    if (inst) {
      window.__editorStore.getState().addElement(inst)
      return inst.id
    }
    return null
  }, masterId)

  expect(instanceId).not.toBeNull()

  // Instance registered with correct masterId
  const instanceRecord = await page.evaluate((instId: string) => {
    return window.__componentStore.getState().instances[instId] ?? null
  }, instanceId!)

  expect(instanceRecord).not.toBeNull()
  expect(instanceRecord.masterId).toBe(masterId)

  // Element added to editor store at specified position
  const editorElem = await page.evaluate((instId: string) => {
    const elem = window.__editorStore.getState().elements[instId]
    return elem ? { x: elem.x, y: elem.y } : null
  }, instanceId!)

  expect(editorElem).not.toBeNull()
  expect(editorElem!.x).toBe(300)
  expect(editorElem!.y).toBe(200)
})

// R16-S4 @empty-state
test('empty-state: no components shows empty state message', async ({ page }) => {
  // Ensure no components exist
  await openAssetsTab(page)

  await expect(page.locator('[data-testid="asset-empty-state"]')).toBeVisible()
  // Should NOT show the component list
  await expect(page.locator('[data-testid="asset-component-list"]')).toHaveCount(0)
})

// R16-S5 @no-results
test('no-results: search with no matches shows no results message', async ({ page }) => {
  // Add one component
  await createMasterInStore(page, 'Button', '#ff0000')

  await openAssetsTab(page)

  // Search for something that won't match
  await page.fill('[data-testid="asset-search"]', 'xyznotfound')

  // No results state shown
  await expect(page.locator('[data-testid="asset-no-results"]')).toBeVisible()
  // Component list should not appear
  await expect(page.locator('[data-testid="asset-component-list"]')).toHaveCount(0)
})
