import { test, expect } from '@playwright/test'

// Helper: add a rectangle element via the store
async function addRect(
  page: import('@playwright/test').Page,
  id: string,
  x: number,
  y: number,
) {
  await page.evaluate(
    ([elemId, ex, ey]) => {
      window.__editorStore.getState().addElement({
        id: elemId as string,
        kind: 'rectangle',
        x: ex as number,
        y: ey as number,
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
    },
    [id, x, y],
  )
}

// Helper: move element to new position
async function moveElement(
  page: import('@playwright/test').Page,
  id: string,
  x: number,
  y: number,
) {
  await page.evaluate(
    ([elemId, nx, ny]) => {
      window.__editorStore.getState().updateElement(elemId as string, {
        x: nx as number,
        y: ny as number,
      })
    },
    [id, x, y],
  )
}

// Helper: delete element
async function deleteElement(
  page: import('@playwright/test').Page,
  id: string,
) {
  await page.evaluate((elemId) => {
    window.__editorStore.getState().deleteElement(elemId as string)
  }, id)
}

// Helper: get element position from DOM
async function getElementPos(page: import('@playwright/test').Page, id: string) {
  const el = page.getByTestId(`element-${id}`)
  const x = await el.getAttribute('data-x')
  const y = await el.getAttribute('data-y')
  return { x: parseFloat(x ?? '0'), y: parseFloat(y ?? '0') }
}

// Helper: check element exists
async function elementExists(page: import('@playwright/test').Page, id: string) {
  const count = await page.locator(`[data-testid="element-${id}"]`).count()
  return count > 0
}

test.describe('Undo / Redo', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    // Wait for store to be available
    await page.waitForFunction(() => !!window.__editorStore)
  })

  test('undo-move: element returns to (0,0) after Cmd+Z', async ({ page }) => {
    const id = 'test-rect-1'
    // Add element at (0,0)
    await addRect(page, id, 0, 0)
    // Move to (100,100)
    await moveElement(page, id, 100, 100)

    // Verify moved
    await page.waitForFunction(
      (elemId) => {
        const el = document.querySelector(`[data-testid="element-${elemId}"]`)
        return el?.getAttribute('data-x') === '100'
      },
      id,
    )

    // Undo — Cmd+Z
    await page.keyboard.press('Meta+z')

    // Wait for position to revert to (0,0)
    await page.waitForFunction(
      (elemId) => {
        const el = document.querySelector(`[data-testid="element-${elemId}"]`)
        return el?.getAttribute('data-x') === '0'
      },
      id,
    )

    const pos = await getElementPos(page, id)
    expect(pos.x).toBe(0)
    expect(pos.y).toBe(0)
  })

  test('redo-move: element returns to (100,100) after Cmd+Shift+Z', async ({
    page,
  }) => {
    const id = 'test-rect-2'
    await addRect(page, id, 0, 0)
    await moveElement(page, id, 100, 100)

    await page.waitForFunction(
      (elemId) => {
        const el = document.querySelector(`[data-testid="element-${elemId}"]`)
        return el?.getAttribute('data-x') === '100'
      },
      id,
    )

    // Undo
    await page.keyboard.press('Meta+z')
    await page.waitForFunction(
      (elemId) => {
        const el = document.querySelector(`[data-testid="element-${elemId}"]`)
        return el?.getAttribute('data-x') === '0'
      },
      id,
    )

    // Redo
    await page.keyboard.press('Meta+Shift+z')
    await page.waitForFunction(
      (elemId) => {
        const el = document.querySelector(`[data-testid="element-${elemId}"]`)
        return el?.getAttribute('data-x') === '100'
      },
      id,
    )

    const pos = await getElementPos(page, id)
    expect(pos.x).toBe(100)
    expect(pos.y).toBe(100)
  })

  test('empty-undo: nothing happens on Cmd+Z with empty undo stack', async ({
    page,
  }) => {
    // Ensure store is clean (no elements)
    const initialElements = await page.evaluate(() => {
      const state = window.__editorStore.getState()
      return Object.keys(state.elements).length
    })

    // Empty undo should not throw
    await page.keyboard.press('Meta+z')
    await page.keyboard.press('Meta+z')

    // Page should still be functional
    const afterElements = await page.evaluate(() => {
      const state = window.__editorStore.getState()
      return Object.keys(state.elements).length
    })

    // No error, element count unchanged
    expect(afterElements).toBe(initialElements)
  })

  test('redo-cleared: redo stack clears when new change made after undo', async ({
    page,
  }) => {
    const id = 'test-rect-3'
    await addRect(page, id, 0, 0)
    await moveElement(page, id, 100, 100)

    await page.waitForFunction(
      (elemId) => {
        const el = document.querySelector(`[data-testid="element-${elemId}"]`)
        return el?.getAttribute('data-x') === '100'
      },
      id,
    )

    // Undo
    await page.keyboard.press('Meta+z')
    await page.waitForFunction(
      (elemId) => {
        const el = document.querySelector(`[data-testid="element-${elemId}"]`)
        return el?.getAttribute('data-x') === '0'
      },
      id,
    )

    // Make a new change — clears redo stack
    await moveElement(page, id, 50, 50)
    await page.waitForFunction(
      (elemId) => {
        const el = document.querySelector(`[data-testid="element-${elemId}"]`)
        return el?.getAttribute('data-x') === '50'
      },
      id,
    )

    // Attempt redo — should do nothing (redo stack cleared)
    await page.keyboard.press('Meta+Shift+z')
    await page.waitForTimeout(100)

    const pos = await getElementPos(page, id)
    // Should remain at (50,50) not (100,100)
    expect(pos.x).toBe(50)
  })

  test('multi-undo: create then delete element, undo twice restores correctly', async ({
    page,
  }) => {
    const id = 'test-rect-4'

    // Create element
    await addRect(page, id, 0, 0)
    await page.waitForFunction(
      (elemId) =>
        !!document.querySelector(`[data-testid="element-${elemId}"]`),
      id,
    )

    // Delete element
    await deleteElement(page, id)
    await page.waitForFunction(
      (elemId) =>
        !document.querySelector(`[data-testid="element-${elemId}"]`),
      id,
    )

    // Undo delete — element restored
    await page.keyboard.press('Meta+z')
    await page.waitForFunction(
      (elemId) =>
        !!document.querySelector(`[data-testid="element-${elemId}"]`),
      id,
    )

    const existsAfterUndoDelete = await elementExists(page, id)
    expect(existsAfterUndoDelete).toBe(true)

    // Undo create — element removed again
    await page.keyboard.press('Meta+z')
    await page.waitForFunction(
      (elemId) =>
        !document.querySelector(`[data-testid="element-${elemId}"]`),
      id,
    )

    const existsAfterUndoCreate = await elementExists(page, id)
    expect(existsAfterUndoCreate).toBe(false)
  })
})
