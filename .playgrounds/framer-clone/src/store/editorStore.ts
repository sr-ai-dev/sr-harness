import { create } from 'zustand'
import { temporal } from 'zundo'
import { immer } from 'zustand/middleware/immer'
import type { WritableDraft } from 'immer'
import {
  type EditorElement,
  type ElementAnimation,
  type ElementTree,
  type Camera,
  type Selection,
  MIN_ZOOM,
  MAX_ZOOM,
  screenToCanvas,
  canvasToScreen,
} from '../types/editor'
import {
  type BreakpointId,
  type BreakpointOverrides,
  DEFAULT_BREAKPOINTS,
  validateBreakpointWidth,
} from './breakpoints'

// Re-export helpers so consumers can import from store
export { screenToCanvas, canvasToScreen }

// ─── Tool ─────────────────────────────────────────────────────────────────────

export type Tool = 'select' | 'frame' | 'text' | 'image' | 'rectangle' | 'ellipse'

// ─── State shape ─────────────────────────────────────────────────────────────

export interface EditorState {
  // Element tree
  elements: ElementTree
  rootIds: string[]

  // Camera
  camera: Camera

  // Selection
  selection: Selection

  // Active tool / preview mode
  activeTool: Tool
  isPreviewMode: boolean

  // Modal state (blocks canvas interactions when a dialog is active)
  isModalOpen: boolean

  // Breakpoints
  activeBreakpoint: BreakpointId
  breakpointWidths: Record<BreakpointId, number>
  /** Per-breakpoint style overrides (delta from desktop base). Only tablet/mobile. */
  breakpointOverrides: Record<BreakpointId, BreakpointOverrides>
  /** Validation error for breakpoint width input */
  breakpointWidthError: string | null
}

// ─── Actions shape ───────────────────────────────────────────────────────────

export interface EditorActions {
  // Element CRUD
  addElement: (element: EditorElement) => void
  updateElement: (id: string, patch: Partial<EditorElement>) => void
  deleteElement: (id: string) => void
  deleteElements: (ids: string[]) => void

  // Camera
  setCamera: (camera: Partial<Camera>) => void
  zoomAt: (delta: number, originX: number, originY: number) => void
  pan: (dx: number, dy: number) => void

  // Selection
  selectElement: (id: string) => void
  selectElements: (ids: string[]) => void
  toggleSelectElement: (id: string) => void
  clearSelection: () => void
  setHovered: (id: string | null) => void

  // Tool / mode
  setActiveTool: (tool: Tool) => void
  setPreviewMode: (active: boolean) => void
  revertToSelect: () => void

  // Layer ordering
  reorderElement: (id: string, newIndex: number) => void

  // Rename element
  renameElement: (id: string, name: string) => void

  // Modal
  setModalOpen: (open: boolean) => void

  // Animations
  setElementAnimations: (id: string, animations: ElementAnimation[]) => void

  // Breakpoints
  setActiveBreakpoint: (id: BreakpointId) => void
  setBreakpointWidth: (id: BreakpointId, width: string | number) => void
  /** Save an override for the current (non-desktop) breakpoint. Ignores if desktop is active. */
  setBreakpointOverride: (elementId: string, patch: Record<string, unknown>) => void
  /** Clear a specific breakpoint's overrides for one element */
  clearBreakpointOverride: (breakpointId: BreakpointId, elementId: string) => void
}

export type EditorStore = EditorState & EditorActions

// ─── Initial state ────────────────────────────────────────────────────────────

const initialState: EditorState = {
  elements: {},
  rootIds: [],
  camera: { x: 0, y: 0, zoom: 1 },
  selection: { selectedIds: [], hoveredId: null },
  activeTool: 'select',
  isPreviewMode: false,
  isModalOpen: false,
  activeBreakpoint: 'desktop',
  breakpointWidths: {
    desktop: DEFAULT_BREAKPOINTS.desktop.width,
    tablet: DEFAULT_BREAKPOINTS.tablet.width,
    mobile: DEFAULT_BREAKPOINTS.mobile.width,
  },
  breakpointOverrides: {
    desktop: {},
    tablet: {},
    mobile: {},
  },
  breakpointWidthError: null,
}

// ─── Store creation ───────────────────────────────────────────────────────────

/**
 * The temporal middleware wraps the immer store so all immer-mutated state
 * changes are tracked for undo/redo.
 *
 * Stack: temporal(immer(stateCreator))
 * Access undo/redo via:  useEditorStore.temporal.getState().undo()
 */
export const useEditorStore = create<EditorStore>()(
  temporal(
    immer((set) => ({
      ...initialState,

      // ── Element CRUD ──────────────────────────────────────────────────────

      addElement: (element) => {
        set((state: WritableDraft<EditorStore>) => {
          state.elements[element.id] = element as WritableDraft<EditorElement>
          if (element.parentId === null) {
            state.rootIds.push(element.id)
          }
        })
      },

      updateElement: (id, patch) => {
        set((state: WritableDraft<EditorStore>) => {
          if (state.elements[id]) {
            Object.assign(state.elements[id], patch)
          }
        })
      },

      deleteElement: (id) => {
        set((state: WritableDraft<EditorStore>) => {
          delete state.elements[id]
          state.rootIds = state.rootIds.filter((rid) => rid !== id)
          state.selection.selectedIds = state.selection.selectedIds.filter(
            (sid) => sid !== id,
          )
          if (state.selection.hoveredId === id) {
            state.selection.hoveredId = null
          }
        })
      },

      deleteElements: (ids) => {
        set((state: WritableDraft<EditorStore>) => {
          for (const id of ids) {
            delete state.elements[id]
          }
          state.rootIds = state.rootIds.filter((rid) => !ids.includes(rid))
          state.selection.selectedIds = state.selection.selectedIds.filter(
            (sid) => !ids.includes(sid),
          )
          if (
            state.selection.hoveredId !== null &&
            ids.includes(state.selection.hoveredId)
          ) {
            state.selection.hoveredId = null
          }
        })
      },

      // ── Camera ────────────────────────────────────────────────────────────

      setCamera: (camera) => {
        set((state: WritableDraft<EditorStore>) => {
          if (camera.x !== undefined) state.camera.x = camera.x
          if (camera.y !== undefined) state.camera.y = camera.y
          if (camera.zoom !== undefined) {
            state.camera.zoom = Math.min(
              MAX_ZOOM,
              Math.max(MIN_ZOOM, camera.zoom),
            )
          }
        })
      },

      /**
       * Zoom toward/away from a given screen-space origin point.
       * delta > 0 = zoom in, delta < 0 = zoom out.
       */
      zoomAt: (delta, originX, originY) => {
        set((state: WritableDraft<EditorStore>) => {
          const factor = 1 + delta * 0.001
          const prevZoom = state.camera.zoom
          const newZoom = Math.min(
            MAX_ZOOM,
            Math.max(MIN_ZOOM, prevZoom * factor),
          )
          if (newZoom === prevZoom) return

          // Adjust translation so the origin point stays fixed on screen
          state.camera.x = originX - ((originX - state.camera.x) * newZoom) / prevZoom
          state.camera.y = originY - ((originY - state.camera.y) * newZoom) / prevZoom
          state.camera.zoom = newZoom
        })
      },

      pan: (dx, dy) => {
        set((state: WritableDraft<EditorStore>) => {
          state.camera.x += dx
          state.camera.y += dy
        })
      },

      // ── Selection ─────────────────────────────────────────────────────────

      selectElement: (id) => {
        set((state: WritableDraft<EditorStore>) => {
          state.selection.selectedIds = [id]
        })
      },

      selectElements: (ids) => {
        set((state: WritableDraft<EditorStore>) => {
          state.selection.selectedIds = [...ids]
        })
      },

      toggleSelectElement: (id) => {
        set((state: WritableDraft<EditorStore>) => {
          const idx = state.selection.selectedIds.indexOf(id)
          if (idx === -1) {
            state.selection.selectedIds.push(id)
          } else {
            state.selection.selectedIds.splice(idx, 1)
          }
        })
      },

      clearSelection: () => {
        set((state: WritableDraft<EditorStore>) => {
          state.selection.selectedIds = []
        })
      },

      setHovered: (id) => {
        set((state: WritableDraft<EditorStore>) => {
          state.selection.hoveredId = id
        })
      },

      // ── Tool / mode ───────────────────────────────────────────────────────

      setActiveTool: (tool) => {
        set((state: WritableDraft<EditorStore>) => {
          state.activeTool = tool
        })
      },

      setPreviewMode: (active) => {
        set((state: WritableDraft<EditorStore>) => {
          state.isPreviewMode = active
        })
      },

      revertToSelect: () => {
        set((state: WritableDraft<EditorStore>) => {
          state.activeTool = 'select'
        })
      },

      reorderElement: (id, newIndex) => {
        set((state: WritableDraft<EditorStore>) => {
          const currentIndex = state.rootIds.indexOf(id)
          if (currentIndex === -1) return
          state.rootIds.splice(currentIndex, 1)
          const clampedIndex = Math.max(0, Math.min(newIndex, state.rootIds.length))
          state.rootIds.splice(clampedIndex, 0, id)
        })
      },

      renameElement: (id, name) => {
        set((state: WritableDraft<EditorStore>) => {
          if (state.elements[id] && name.trim() !== '') {
            state.elements[id].name = name.trim()
          }
        })
      },

      setModalOpen: (open) => {
        set((state: WritableDraft<EditorStore>) => {
          state.isModalOpen = open
        })
      },

      // ── Animations ────────────────────────────────────────────────────────

      setElementAnimations: (id, animations) => {
        set((state: WritableDraft<EditorStore>) => {
          if (state.elements[id]) {
            state.elements[id].animations = animations as WritableDraft<ElementAnimation[]>
          }
        })
      },

      // ── Breakpoints ───────────────────────────────────────────────────────

      setActiveBreakpoint: (id) => {
        set((state: WritableDraft<EditorStore>) => {
          state.activeBreakpoint = id
        })
      },

      setBreakpointWidth: (id, width) => {
        set((state: WritableDraft<EditorStore>) => {
          const error = validateBreakpointWidth(width)
          if (error) {
            state.breakpointWidthError = error
            return
          }
          const num = typeof width === 'string' ? parseFloat(width) : width
          state.breakpointWidths[id] = num
          state.breakpointWidthError = null
        })
      },

      setBreakpointOverride: (elementId, patch) => {
        set((state: WritableDraft<EditorStore>) => {
          const bp = state.activeBreakpoint
          // Desktop is the base — never store overrides for it
          if (bp === 'desktop') return
          if (!state.breakpointOverrides[bp]) {
            state.breakpointOverrides[bp] = {}
          }
          if (!state.breakpointOverrides[bp][elementId]) {
            state.breakpointOverrides[bp][elementId] = {}
          }
          Object.assign(state.breakpointOverrides[bp][elementId], patch)
        })
      },

      clearBreakpointOverride: (breakpointId, elementId) => {
        set((state: WritableDraft<EditorStore>) => {
          if (state.breakpointOverrides[breakpointId]) {
            delete state.breakpointOverrides[breakpointId][elementId]
          }
        })
      },
    })),
    {
      // Only track element tree and camera for undo/redo (not selection/hover/tool)
      partialize: (state) => ({
        elements: state.elements,
        rootIds: state.rootIds,
        camera: state.camera,
      }),
      limit: 100,
    },
  ),
)
