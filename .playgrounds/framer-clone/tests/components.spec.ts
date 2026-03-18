/**
 * Component system tests: master/instance, override propagation, detach on delete.
 * Covers R8-S1 through R8-S5.
 */
import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function clearStores(page: Page) {
  await page.evaluate(() => {
    // Clear editor store
    const editorState = window.__editorStore.getState()
    const ids = Object.keys(editorState.elements)
    if (ids.length > 0) editorState.deleteElements(ids)

    // Clear component store
    window.__componentStore.setState({ components: {}, instances: {} })
  })
}

interface RectangleElement {
  id: string
  kind: 'rectangle'
  x: number
  y: number
  width: number
  height: number
  rotation: number
  opacity: number
  visible: boolean
  locked: boolean
  name: string
  parentId: string | null
  childIds: string[]
  fill: string
  stroke: string
  strokeWidth: number
  borderRadius: number
}

async function addRectangle(page: Page, id: string, name: string, fill = '#ff0000'): Promise<void> {
  await page.evaluate(
    ([elemId, elemName, elemFill]) => {
      window.__editorStore.getState().addElement({
        id: elemId as string,
        kind: 'rectangle',
        x: 10,
        y: 10,
        width: 100,
        height: 100,
        rotation: 0,
        opacity: 1,
        visible: true,
        locked: false,
        name: elemName as string,
        parentId: null,
        childIds: [],
        fill: elemFill as string,
        stroke: 'transparent',
        strokeWidth: 0,
        borderRadius: 0,
      } as RectangleElement)
    },
    [id, name, fill],
  )
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.waitForSelector('[data-testid="canvas-viewport"]')
  await clearStores(page)
})

// R8-S1 @create-master
test('create-master: selection becomes master and appears in component registry', async ({ page }) => {
  // Add a rectangle to editor
  await addRectangle(page, 'elem-1', 'MyButton', '#0099ff')

  // Create a master from that element
  const masterId = await page.evaluate(() => {
    const elem = window.__editorStore.getState().elements['elem-1']
    return window.__componentStore.getState().createMaster(elem, 'MyButton')
  })

  expect(masterId).toBeTruthy()

  // Master should appear in component registry
  const master = await page.evaluate((id: string) => {
    return window.__componentStore.getState().components[id] ?? null
  }, masterId)

  expect(master).not.toBeNull()
  expect(master.name).toBe('MyButton')
  expect(master.element.id).toBe('elem-1')
})

// R8-S2 @place-instance
test('place-instance: instance created referencing master by ID', async ({ page }) => {
  await addRectangle(page, 'elem-2', 'Card', '#00ff00')

  // Create master
  const masterId = await page.evaluate(() => {
    const elem = window.__editorStore.getState().elements['elem-2']
    return window.__componentStore.getState().createMaster(elem, 'Card')
  })

  // Create instance
  const instanceElement = await page.evaluate((mId: string) => {
    const inst = window.__componentStore.getState().createInstance(mId, { x: 200, y: 200 })
    if (inst) {
      window.__editorStore.getState().addElement(inst)
    }
    return inst
  }, masterId)

  expect(instanceElement).not.toBeNull()
  expect(instanceElement!.id).toBeTruthy()

  // Verify instance is registered
  const instanceRecord = await page.evaluate((instId: string) => {
    return window.__componentStore.getState().instances[instId] ?? null
  }, instanceElement!.id)

  expect(instanceRecord).not.toBeNull()
  expect(instanceRecord.masterId).toBe(masterId)

  // Verify instance references master by ID (not a deep clone)
  expect(instanceRecord.masterId).toBeTruthy()

  // Verify element exists in editor store
  const editorElem = await page.evaluate((instId: string) => {
    return window.__editorStore.getState().elements[instId] ?? null
  }, instanceElement!.id)
  expect(editorElem).not.toBeNull()
})

// R8-S3 @override-propagation
test('override-propagation: overridden instance fill survives master fill change', async ({ page }) => {
  await addRectangle(page, 'elem-3', 'Box', '#0000ff')

  // Create master
  const masterId = await page.evaluate(() => {
    const elem = window.__editorStore.getState().elements['elem-3']
    return window.__componentStore.getState().createMaster(elem, 'Box')
  })

  // Create instance and override its fill to red
  const instanceId = await page.evaluate((mId: string) => {
    const inst = window.__componentStore.getState().createInstance(mId)
    if (!inst) return null
    // Override fill to red
    window.__componentStore.getState().setInstanceOverride(inst.id, { fill: '#ff0000' } as Partial<import('../src/types/editor').EditorElement>)
    window.__editorStore.getState().addElement(inst)
    return inst.id
  }, masterId)

  expect(instanceId).not.toBeNull()

  // Now change master fill from blue to green
  await page.evaluate((mId: string) => {
    window.__componentStore.getState().propagateMasterChange(mId, { fill: '#00ff00' } as Partial<import('../src/types/editor').EditorElement>)
  }, masterId)

  // Resolve instance — should still show red (overridden), not green
  const resolved = await page.evaluate((instId: string) => {
    return window.__componentStore.getState().resolveInstance(instId) as { fill?: string } | null
  }, instanceId!)

  expect(resolved).not.toBeNull()
  expect((resolved as { fill?: string })!.fill).toBe('#ff0000')

  // Master fill should now be green
  const masterFill = await page.evaluate((mId: string) => {
    const m = window.__componentStore.getState().components[mId]
    return (m?.element as { fill?: string })?.fill ?? null
  }, masterId)
  expect(masterFill).toBe('#00ff00')
})

// R8-S4 @reset-override
test('reset-override: resetting override reverts instance property to master value', async ({ page }) => {
  await addRectangle(page, 'elem-4', 'Badge', '#ff00ff')

  const masterId = await page.evaluate(() => {
    const elem = window.__editorStore.getState().elements['elem-4']
    return window.__componentStore.getState().createMaster(elem, 'Badge')
  })

  // Create instance, override fill
  const instanceId = await page.evaluate((mId: string) => {
    const inst = window.__componentStore.getState().createInstance(mId)
    if (!inst) return null
    window.__componentStore.getState().setInstanceOverride(inst.id, { fill: '#ffffff' } as Partial<import('../src/types/editor').EditorElement>)
    window.__editorStore.getState().addElement(inst)
    return inst.id
  }, masterId)

  expect(instanceId).not.toBeNull()

  // Verify override is active
  const beforeReset = await page.evaluate((instId: string) => {
    return (window.__componentStore.getState().resolveInstance(instId) as { fill?: string })?.fill ?? null
  }, instanceId!)
  expect(beforeReset).toBe('#ffffff')

  // Reset the fill override
  await page.evaluate((instId: string) => {
    window.__componentStore.getState().resetInstanceOverride(instId, ['fill'])
  }, instanceId!)

  // After reset, should inherit master fill (#ff00ff)
  const afterReset = await page.evaluate((instId: string) => {
    return (window.__componentStore.getState().resolveInstance(instId) as { fill?: string })?.fill ?? null
  }, instanceId!)
  expect(afterReset).toBe('#ff00ff')
})

// R8-S5 @delete-master
test('delete-master: instances detached and become regular elements', async ({ page }) => {
  await addRectangle(page, 'elem-5', 'Widget', '#abcdef')

  const masterId = await page.evaluate(() => {
    const elem = window.__editorStore.getState().elements['elem-5']
    return window.__componentStore.getState().createMaster(elem, 'Widget')
  })

  // Create two instances
  const instanceIds = await page.evaluate((mId: string) => {
    const ids: string[] = []
    for (let i = 0; i < 2; i++) {
      const inst = window.__componentStore.getState().createInstance(mId, { x: i * 150, y: 50 })
      if (inst) {
        window.__editorStore.getState().addElement(inst)
        ids.push(inst.id)
      }
    }
    return ids
  }, masterId)

  expect(instanceIds).toHaveLength(2)

  // Delete master — detaches instances
  const detached = await page.evaluate((mId: string) => {
    return window.__componentStore.getState().deleteMaster(mId)
  }, masterId)

  expect(detached).toHaveLength(2)

  // Master should be gone
  const masterGone = await page.evaluate((mId: string) => {
    return window.__componentStore.getState().components[mId] ?? null
  }, masterId)
  expect(masterGone).toBeNull()

  // Instances should be unregistered from component store
  const inst0 = await page.evaluate((instId: string) => {
    return window.__componentStore.getState().instances[instId] ?? null
  }, instanceIds[0])
  expect(inst0).toBeNull()

  // But elements should still exist in editor store (detached = regular elements)
  const elem0 = await page.evaluate((instId: string) => {
    return window.__editorStore.getState().elements[instId] ?? null
  }, instanceIds[0])
  expect(elem0).not.toBeNull()
})
