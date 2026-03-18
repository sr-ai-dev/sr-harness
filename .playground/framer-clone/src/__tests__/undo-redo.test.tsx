import { describe, it, expect, beforeEach } from 'vitest'
import { useEditorStore } from '../store'
import type { FrameElement, TextElement } from '../types'

// ───────────────────────────────────────────────────────────────────────────
// Test factories
// ───────────────────────────────────────────────────────────────────────────
function makeFrame(id: string, x = 0, y = 0): FrameElement {
  return {
    id,
    type: 'frame',
    x,
    y,
    width: 200,
    height: 150,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    name: `Frame ${id}`,
    parentId: null,
    children: [],
    zIndex: 0,
    backgroundColor: '#ffffff',
    borderRadius: 0,
    borderWidth: 0,
    borderColor: '#000000',
    overflow: 'visible',
    layoutMode: 'none',
    gap: 0,
    padding: { top: 0, right: 0, bottom: 0, left: 0 },
  }
}

function makeText(id: string, content = 'Hello'): TextElement {
  return {
    id,
    type: 'text',
    x: 10,
    y: 10,
    width: 100,
    height: 30,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    name: `Text ${id}`,
    parentId: null,
    children: [],
    zIndex: 1,
    content,
    fontSize: 16,
    fontFamily: 'Inter',
    fontWeight: 400,
    fontStyle: 'normal',
    textAlign: 'left',
    color: '#000000',
    lineHeight: 1.5,
    letterSpacing: 0,
    textDecoration: 'none',
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Reset store before each test
// ───────────────────────────────────────────────────────────────────────────
beforeEach(() => {
  useEditorStore.setState({
    elements: {},
    rootIds: [],
    selectedIds: [],
    past: [],
    future: [],
  })
})

// ───────────────────────────────────────────────────────────────────────────
// Element CRUD
// ───────────────────────────────────────────────────────────────────────────
describe('addElement', () => {
  it('adds a root-level element and records history', () => {
    const store = useEditorStore.getState()
    store.addElement(makeFrame('f1'))

    const s = useEditorStore.getState()
    expect(s.elements['f1']).toBeDefined()
    expect(s.rootIds).toContain('f1')
    expect(s.past.length).toBe(1) // one history entry saved
    expect(s.future.length).toBe(0)
  })

  it('adds a child element and links it to parent', () => {
    const store = useEditorStore.getState()
    store.addElement(makeFrame('parent'))

    const child: FrameElement = { ...makeFrame('child'), parentId: 'parent' }
    useEditorStore.getState().addElement(child)

    const s = useEditorStore.getState()
    expect(s.elements['child']).toBeDefined()
    expect(s.elements['parent'].children).toContain('child')
    expect(s.rootIds).not.toContain('child')
  })
})

describe('removeElement', () => {
  it('removes a root-level element', () => {
    const store = useEditorStore.getState()
    store.addElement(makeFrame('f1'))
    useEditorStore.getState().removeElement('f1')

    const s = useEditorStore.getState()
    expect(s.elements['f1']).toBeUndefined()
    expect(s.rootIds).not.toContain('f1')
  })

  it('removes element from selection when deleted', () => {
    const store = useEditorStore.getState()
    store.addElement(makeFrame('f1'))
    useEditorStore.getState().selectElement('f1')
    useEditorStore.getState().removeElement('f1')

    const s = useEditorStore.getState()
    expect(s.selectedIds).not.toContain('f1')
  })
})

describe('updateElement', () => {
  it('updates element properties', () => {
    const store = useEditorStore.getState()
    store.addElement(makeFrame('f1'))
    useEditorStore.getState().updateElement('f1', { x: 100, y: 200 })

    const s = useEditorStore.getState()
    expect(s.elements['f1'].x).toBe(100)
    expect(s.elements['f1'].y).toBe(200)
  })
})

describe('moveElement', () => {
  it('moves an element to new coordinates', () => {
    const store = useEditorStore.getState()
    store.addElement(makeFrame('f1', 0, 0))
    useEditorStore.getState().moveElement('f1', 300, 400)

    const s = useEditorStore.getState()
    expect(s.elements['f1'].x).toBe(300)
    expect(s.elements['f1'].y).toBe(400)
  })
})

// ───────────────────────────────────────────────────────────────────────────
// Selection
// ───────────────────────────────────────────────────────────────────────────
describe('selection', () => {
  it('selectElement sets a single selection', () => {
    const store = useEditorStore.getState()
    store.addElement(makeFrame('f1'))
    store.addElement(makeFrame('f2'))
    useEditorStore.getState().selectElement('f1')
    useEditorStore.getState().selectElement('f2')

    expect(useEditorStore.getState().selectedIds).toEqual(['f2'])
  })

  it('multiSelect allows multiple selections', () => {
    const store = useEditorStore.getState()
    store.addElement(makeFrame('f1'))
    store.addElement(makeFrame('f2'))
    useEditorStore.getState().multiSelect(['f1', 'f2'])

    expect(useEditorStore.getState().selectedIds).toEqual(['f1', 'f2'])
  })

  it('deselectAll clears selection', () => {
    const store = useEditorStore.getState()
    store.addElement(makeFrame('f1'))
    useEditorStore.getState().selectElement('f1')
    useEditorStore.getState().deselectAll()

    expect(useEditorStore.getState().selectedIds).toEqual([])
  })
})

// ───────────────────────────────────────────────────────────────────────────
// Undo / Redo — R4-S1: undo move returns element to previous position
// ───────────────────────────────────────────────────────────────────────────
describe('undo/redo — R4-S1: undo restores previous position after move', () => {
  it('pressing undo after moveElement returns element to original position', () => {
    const store = useEditorStore.getState()
    // Add element at (0, 0)
    store.addElement(makeFrame('f1', 0, 0))
    // Move element to (300, 400)
    useEditorStore.getState().moveElement('f1', 300, 400)
    expect(useEditorStore.getState().elements['f1'].x).toBe(300)

    // Undo — should return to (0, 0)
    useEditorStore.getState().undo()
    const s = useEditorStore.getState()
    expect(s.elements['f1'].x).toBe(0)
    expect(s.elements['f1'].y).toBe(0)
  })
})

// ───────────────────────────────────────────────────────────────────────────
// Undo / Redo — R4-S2: redo after undo restores modified state
// ───────────────────────────────────────────────────────────────────────────
describe('undo/redo — R4-S2: redo after undo restores modified state', () => {
  it('pressing redo after undo returns element to the moved position', () => {
    const store = useEditorStore.getState()
    store.addElement(makeFrame('f1', 0, 0))
    useEditorStore.getState().moveElement('f1', 300, 400)

    // Undo
    useEditorStore.getState().undo()
    expect(useEditorStore.getState().elements['f1'].x).toBe(0)

    // Redo — should return to (300, 400)
    useEditorStore.getState().redo()
    const s = useEditorStore.getState()
    expect(s.elements['f1'].x).toBe(300)
    expect(s.elements['f1'].y).toBe(400)
  })
})

// ───────────────────────────────────────────────────────────────────────────
// Undo / Redo — R4-S3: undo on empty history does nothing
// ───────────────────────────────────────────────────────────────────────────
describe('undo/redo — R4-S3: undo on empty history does nothing', () => {
  it('canUndo returns false when no history exists', () => {
    const s = useEditorStore.getState()
    expect(s.canUndo()).toBe(false)
  })

  it('undo on empty history leaves state unchanged', () => {
    const store = useEditorStore.getState()
    store.addElement(makeFrame('f1', 5, 5))
    // Clear past manually to simulate empty history after initial load
    useEditorStore.setState({ past: [] })

    const before = useEditorStore.getState().elements['f1'].x
    useEditorStore.getState().undo()
    const after = useEditorStore.getState().elements['f1'].x
    expect(after).toBe(before) // unchanged
    expect(useEditorStore.getState().canUndo()).toBe(false)
  })
})

// ───────────────────────────────────────────────────────────────────────────
// Undo / Redo — R4-S4: new action after undo clears redo history
// ───────────────────────────────────────────────────────────────────────────
describe('undo/redo — R4-S4: new action after undo clears redo history', () => {
  it('performing a new action after undo clears future and redo is unavailable', () => {
    const store = useEditorStore.getState()
    store.addElement(makeFrame('f1', 0, 0))
    useEditorStore.getState().moveElement('f1', 100, 100)
    useEditorStore.getState().moveElement('f1', 200, 200)

    // Undo twice
    useEditorStore.getState().undo()
    useEditorStore.getState().undo()
    expect(useEditorStore.getState().canRedo()).toBe(true)

    // Perform new action — should clear redo history
    useEditorStore.getState().addElement(makeText('t1'))
    const s = useEditorStore.getState()
    expect(s.future.length).toBe(0)
    expect(s.canRedo()).toBe(false)
  })

  it('canRedo returns false after new action following undo', () => {
    const store = useEditorStore.getState()
    store.addElement(makeFrame('f1', 0, 0))
    useEditorStore.getState().moveElement('f1', 50, 50)
    useEditorStore.getState().undo()

    // Confirm redo is available before new action
    expect(useEditorStore.getState().canRedo()).toBe(true)

    // New action
    useEditorStore.getState().updateElement('f1', { opacity: 0.5 })
    expect(useEditorStore.getState().canRedo()).toBe(false)
  })
})

// ───────────────────────────────────────────────────────────────────────────
// Multiple undo steps
// ───────────────────────────────────────────────────────────────────────────
describe('multiple undo steps', () => {
  it('can undo multiple operations in sequence', () => {
    const store = useEditorStore.getState()
    store.addElement(makeFrame('f1', 0, 0))
    useEditorStore.getState().moveElement('f1', 100, 0)
    useEditorStore.getState().moveElement('f1', 200, 0)
    useEditorStore.getState().moveElement('f1', 300, 0)

    useEditorStore.getState().undo()
    expect(useEditorStore.getState().elements['f1'].x).toBe(200)

    useEditorStore.getState().undo()
    expect(useEditorStore.getState().elements['f1'].x).toBe(100)

    useEditorStore.getState().undo()
    expect(useEditorStore.getState().elements['f1'].x).toBe(0)
  })
})
