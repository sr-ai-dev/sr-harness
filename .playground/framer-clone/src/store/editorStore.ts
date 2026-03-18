import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { Element, ElementMap } from '../types'

// ───────────────────────────────────────────────────────────────────────────
// History entry: a snapshot of the element tree
// ───────────────────────────────────────────────────────────────────────────
interface HistoryEntry {
  elements: ElementMap
  rootIds: string[]
}

// ───────────────────────────────────────────────────────────────────────────
// Store state shape
// ───────────────────────────────────────────────────────────────────────────
export interface EditorState {
  // Element tree
  elements: ElementMap
  rootIds: string[] // top-level element ids (no parent)

  // Selection
  selectedIds: string[]

  // Undo/redo history
  past: HistoryEntry[]
  future: HistoryEntry[]

  // ── Computed helpers ──────────────────────────────────────────────────
  canUndo: () => boolean
  canRedo: () => boolean

  // ── Element CRUD ──────────────────────────────────────────────────────
  addElement: (element: Element) => void
  removeElement: (id: string) => void
  updateElement: (id: string, patch: Partial<Element>) => void
  moveElement: (id: string, x: number, y: number) => void

  // ── Selection ─────────────────────────────────────────────────────────
  selectElement: (id: string) => void
  multiSelect: (ids: string[]) => void
  deselectAll: () => void

  // ── Undo / Redo ───────────────────────────────────────────────────────
  undo: () => void
  redo: () => void
}

// ───────────────────────────────────────────────────────────────────────────
// Helper: deep-clone the history-relevant portion of state
// ───────────────────────────────────────────────────────────────────────────
function snapshot(elements: ElementMap, rootIds: string[]): HistoryEntry {
  return {
    elements: JSON.parse(JSON.stringify(elements)) as ElementMap,
    rootIds: [...rootIds],
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Max history depth (prevent unbounded memory growth)
// ───────────────────────────────────────────────────────────────────────────
const MAX_HISTORY = 100

// ───────────────────────────────────────────────────────────────────────────
// Store
// ───────────────────────────────────────────────────────────────────────────
export const useEditorStore = create<EditorState>()(
  immer((set, get) => ({
    elements: {},
    rootIds: [],
    selectedIds: [],
    past: [],
    future: [],

    // ── Computed ────────────────────────────────────────────────────────
    canUndo: () => get().past.length > 0,
    canRedo: () => get().future.length > 0,

    // ── Element CRUD ────────────────────────────────────────────────────
    addElement: (element) => {
      set((state) => {
        // Save current state to history before mutation
        state.past.push(snapshot(state.elements, state.rootIds))
        if (state.past.length > MAX_HISTORY) state.past.shift()
        state.future = []

        state.elements[element.id] = element

        if (element.parentId === null) {
          state.rootIds.push(element.id)
        } else {
          const parent = state.elements[element.parentId]
          if (parent && !parent.children.includes(element.id)) {
            parent.children.push(element.id)
          }
        }
      })
    },

    removeElement: (id) => {
      set((state) => {
        const element = state.elements[id]
        if (!element) return

        // Save history
        state.past.push(snapshot(state.elements, state.rootIds))
        if (state.past.length > MAX_HISTORY) state.past.shift()
        state.future = []

        // Remove from parent's children list
        if (element.parentId !== null) {
          const parent = state.elements[element.parentId]
          if (parent) {
            parent.children = parent.children.filter((cid) => cid !== id)
          }
        } else {
          state.rootIds = state.rootIds.filter((rid) => rid !== id)
        }

        // Recursively collect all descendant ids
        const collectDescendants = (eid: string): string[] => {
          const el = state.elements[eid]
          if (!el) return []
          return [eid, ...el.children.flatMap(collectDescendants)]
        }

        for (const eid of collectDescendants(id)) {
          delete state.elements[eid]
        }

        // Remove from selection
        state.selectedIds = state.selectedIds.filter((sid) => sid !== id)
      })
    },

    updateElement: (id, patch) => {
      set((state) => {
        const element = state.elements[id]
        if (!element) return

        // Save history
        state.past.push(snapshot(state.elements, state.rootIds))
        if (state.past.length > MAX_HISTORY) state.past.shift()
        state.future = []

        Object.assign(state.elements[id], patch)
      })
    },

    moveElement: (id, x, y) => {
      set((state) => {
        const element = state.elements[id]
        if (!element) return

        // Save history
        state.past.push(snapshot(state.elements, state.rootIds))
        if (state.past.length > MAX_HISTORY) state.past.shift()
        state.future = []

        state.elements[id].x = x
        state.elements[id].y = y
      })
    },

    // ── Selection ───────────────────────────────────────────────────────
    selectElement: (id) => {
      set((state) => {
        state.selectedIds = [id]
      })
    },

    multiSelect: (ids) => {
      set((state) => {
        state.selectedIds = ids
      })
    },

    deselectAll: () => {
      set((state) => {
        state.selectedIds = []
      })
    },

    // ── Undo ────────────────────────────────────────────────────────────
    undo: () => {
      set((state) => {
        if (state.past.length === 0) return

        const prev = state.past[state.past.length - 1]
        state.past = state.past.slice(0, -1)

        // Push current onto future
        state.future.unshift(snapshot(state.elements, state.rootIds))

        state.elements = prev.elements
        state.rootIds = prev.rootIds
      })
    },

    // ── Redo ────────────────────────────────────────────────────────────
    redo: () => {
      set((state) => {
        if (state.future.length === 0) return

        const next = state.future[0]
        state.future = state.future.slice(1)

        // Push current onto past
        state.past.push(snapshot(state.elements, state.rootIds))
        if (state.past.length > MAX_HISTORY) state.past.shift()

        state.elements = next.elements
        state.rootIds = next.rootIds
      })
    },
  }))
)
