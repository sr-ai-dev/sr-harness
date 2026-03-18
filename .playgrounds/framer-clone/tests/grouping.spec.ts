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
    parentId?: string | null
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
      parentId: o.parentId ?? null,
      childIds: [],
      fill: o.fill,
      stroke: 'transparent',
      strokeWidth: 0,
      borderRadius: 0,
    })
  }, opts)
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test.describe('Grouping', () => {
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

  // R17-S1: group-create — Cmd+G wraps selected elements in a new Frame
  test('group-create: grouping selected elements creates new Frame wrapper', async ({ page }) => {
    await addRectangle(page, { id: 'g1', fill: '#ff0000', x: 0, y: 0, w: 100, h: 100 })
    await addRectangle(page, { id: 'g2', fill: '#0000ff', x: 200, y: 0, w: 100, h: 100 })

    await page.evaluate(() => {
      window.__editorStore.getState().selectElements(['g1', 'g2'])
    })

    // Group via store action (same as Cmd+G triggers)
    await page.evaluate(() => {
      const { selectedIds } = window.__editorStore.getState().selection
      window.__editorStore.getState().groupElements(selectedIds)
    })

    const state = await page.evaluate(() => {
      const s = window.__editorStore.getState()
      const frames = Object.values(s.elements).filter((el) => el.kind === 'frame')
      return {
        elementCount: Object.keys(s.elements).length,
        rootIds: s.rootIds,
        selectedIds: s.selection.selectedIds,
        frameCount: frames.length,
        groupId: frames[0]?.id,
        groupChildIds: frames[0]?.childIds,
        g1parentId: s.elements['g1']?.parentId,
        g2parentId: s.elements['g2']?.parentId,
      }
    })

    // Should have 3 elements: the group frame + 2 children
    expect(state.elementCount).toBe(3)

    // There should be exactly one frame (the new group)
    expect(state.frameCount).toBe(1)

    // The new group should be selected
    expect(state.selectedIds).toHaveLength(1)
    const groupId = state.groupId!
    expect(state.selectedIds).toContain(groupId)

    // The group should be in rootIds
    expect(state.rootIds).toContain(groupId)

    // Children should NOT be in rootIds
    expect(state.rootIds).not.toContain('g1')
    expect(state.rootIds).not.toContain('g2')

    // Children should be parented to group
    expect(state.g1parentId).toBe(groupId)
    expect(state.g2parentId).toBe(groupId)

    // Group childIds should contain both
    expect(state.groupChildIds).toContain('g1')
    expect(state.groupChildIds).toContain('g2')
  })

  // R17-S2: ungroup — Cmd+Shift+G removes wrapper, promotes children
  test('ungroup: ungrouping frame removes wrapper and promotes children with position preservation', async ({
    page,
  }) => {
    await addRectangle(page, { id: 'u1', fill: '#ff0000', x: 0, y: 0, w: 100, h: 100 })
    await addRectangle(page, { id: 'u2', fill: '#00ff00', x: 200, y: 0, w: 100, h: 100 })

    // Group first
    await page.evaluate(() => {
      window.__editorStore.getState().groupElements(['u1', 'u2'])
    })

    const groupId = await page.evaluate(
      () => window.__editorStore.getState().selection.selectedIds[0],
    )
    expect(groupId).toBeTruthy()

    // Now ungroup
    await page.evaluate((gid) => {
      window.__editorStore.getState().ungroupElement(gid)
    }, groupId)

    const state = await page.evaluate(() => {
      const s = window.__editorStore.getState()
      return {
        elementIds: Object.keys(s.elements),
        rootIds: s.rootIds,
        selectedIds: s.selection.selectedIds,
        u1: { x: s.elements['u1']?.x, y: s.elements['u1']?.y, parentId: s.elements['u1']?.parentId },
        u2: { x: s.elements['u2']?.x, y: s.elements['u2']?.y, parentId: s.elements['u2']?.parentId },
      }
    })

    // Group frame should be removed
    expect(state.elementIds).not.toContain(groupId)
    expect(state.elementIds).toHaveLength(2)

    // Children should be promoted to root
    expect(state.rootIds).toContain('u1')
    expect(state.rootIds).toContain('u2')

    // Positions should be preserved (absolute canvas coordinates)
    expect(state.u1.x).toBe(0)
    expect(state.u1.y).toBe(0)
    expect(state.u2.x).toBe(200)
    expect(state.u2.y).toBe(0)

    // Children parentId should be null (back to root)
    expect(state.u1.parentId).toBeNull()
    expect(state.u2.parentId).toBeNull()

    // Children should be selected
    expect(state.selectedIds).toContain('u1')
    expect(state.selectedIds).toContain('u2')
  })

  // R17-S3: single-element-group — grouping a single element creates single-child group
  test('single-element-group: grouping single element creates valid single-child group', async ({
    page,
  }) => {
    await addRectangle(page, { id: 'sg1', fill: '#ff0000', x: 50, y: 50, w: 100, h: 100 })

    await page.evaluate(() => {
      window.__editorStore.getState().groupElements(['sg1'])
    })

    const state = await page.evaluate(() => {
      const s = window.__editorStore.getState()
      const frames = Object.values(s.elements).filter((e) => e.kind === 'frame')
      return {
        elementCount: Object.keys(s.elements).length,
        rootIds: s.rootIds,
        selectedIds: s.selection.selectedIds,
        frameCount: frames.length,
        frameChildIds: frames[0]?.childIds,
      }
    })

    // Should have 2 elements: group frame + child
    expect(state.elementCount).toBe(2)

    // There should be one frame group
    expect(state.frameCount).toBe(1)
    expect(state.frameChildIds).toHaveLength(1)
    expect(state.frameChildIds).toContain('sg1')

    // Group should be selected and in rootIds
    const groupId = state.selectedIds[0]
    expect(state.rootIds).toContain(groupId)
    expect(state.rootIds).not.toContain('sg1')
  })

  // R17-S4: group-no-selection — grouping with no selection does nothing
  test('group-no-selection: grouping with no elements selected does nothing', async ({ page }) => {
    await addRectangle(page, { id: 'gns1', fill: '#ff0000', x: 0, y: 0 })

    await page.evaluate(() => {
      window.__editorStore.getState().clearSelection()
    })

    const before = await page.evaluate(() => ({
      elementCount: Object.keys(window.__editorStore.getState().elements).length,
      rootIds: [...window.__editorStore.getState().rootIds],
    }))

    // Attempt group with empty selection
    await page.evaluate(() => {
      const { selectedIds } = window.__editorStore.getState().selection
      window.__editorStore.getState().groupElements(selectedIds)
    })

    const after = await page.evaluate(() => ({
      elementCount: Object.keys(window.__editorStore.getState().elements).length,
      rootIds: window.__editorStore.getState().rootIds,
    }))

    // Nothing should change
    expect(after.elementCount).toBe(before.elementCount)
    expect(after.rootIds).toEqual(before.rootIds)
  })

  // R17-S5: nested-ungroup — ungroup nested group promotes children to grandparent
  test('nested-ungroup: ungrouping nested frame promotes children to parent frame', async ({
    page,
  }) => {
    // Build tree: C (outer frame, root) → D (inner frame) → [E, F]
    await page.evaluate(() => {
      const add = window.__editorStore.getState().addElement

      // Outer frame C
      add({
        id: 'C', kind: 'frame', x: 0, y: 0, width: 500, height: 500,
        rotation: 0, opacity: 1, visible: true, locked: false, name: 'Frame-C',
        parentId: null, childIds: ['D'],
        fill: 'transparent', borderRadius: 0, clipContent: false,
        layoutMode: 'absolute', stackDirection: 'column', stackGap: 0,
        stackWrap: false, stackAlign: 'flex-start', stackJustify: 'flex-start',
        gridColumns: 2, gridGap: 0,
      })

      // Inner frame D (child of C, positioned at 100,100 relative to C)
      add({
        id: 'D', kind: 'frame', x: 100, y: 100, width: 200, height: 200,
        rotation: 0, opacity: 1, visible: true, locked: false, name: 'Frame-D',
        parentId: 'C', childIds: ['E', 'F'],
        fill: 'transparent', borderRadius: 0, clipContent: false,
        layoutMode: 'absolute', stackDirection: 'column', stackGap: 0,
        stackWrap: false, stackAlign: 'flex-start', stackJustify: 'flex-start',
        gridColumns: 2, gridGap: 0,
      })

      // Child E (relative to D)
      add({
        id: 'E', kind: 'rectangle', x: 10, y: 10, width: 80, height: 80,
        rotation: 0, opacity: 1, visible: true, locked: false, name: 'Rect-E',
        parentId: 'D', childIds: [], fill: '#ff0000', stroke: '', strokeWidth: 0, borderRadius: 0,
      })

      // Child F (relative to D)
      add({
        id: 'F', kind: 'rectangle', x: 110, y: 10, width: 80, height: 80,
        rotation: 0, opacity: 1, visible: true, locked: false, name: 'Rect-F',
        parentId: 'D', childIds: [], fill: '#0000ff', stroke: '', strokeWidth: 0, borderRadius: 0,
      })

      window.__editorStore.setState({ rootIds: ['C'] })
    })

    // Ungroup D (the inner group)
    await page.evaluate(() => {
      window.__editorStore.getState().ungroupElement('D')
    })

    const state = await page.evaluate(() => {
      const s = window.__editorStore.getState()
      const cFrame = s.elements['C']
      return {
        dExists: !!s.elements['D'],
        eExists: !!s.elements['E'],
        fExists: !!s.elements['F'],
        cChildIds: cFrame?.childIds ?? [],
        eParentId: s.elements['E']?.parentId,
        fParentId: s.elements['F']?.parentId,
        rootIds: s.rootIds,
      }
    })

    // D should be removed
    expect(state.dExists).toBe(false)

    // E and F should still exist
    expect(state.eExists).toBe(true)
    expect(state.fExists).toBe(true)

    // E and F should now be children of C
    expect(state.cChildIds).toContain('E')
    expect(state.cChildIds).toContain('F')
    expect(state.eParentId).toBe('C')
    expect(state.fParentId).toBe('C')

    // C should still be the root
    expect(state.rootIds).toContain('C')
    expect(state.rootIds).not.toContain('D')
  })
})
