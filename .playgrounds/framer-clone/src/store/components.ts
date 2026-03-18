import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { WritableDraft } from 'immer'
import { nanoid } from 'nanoid'
import type { EditorElement } from '../types/editor'

// ─── Component Types ──────────────────────────────────────────────────────────

/** A master component: stores the canonical element definition */
export interface MasterComponent {
  id: string
  name: string
  /** The full element snapshot (kind, dimensions, fill, etc.) */
  element: EditorElement
}

/**
 * An instance of a master component.
 * Only stores property overrides; inherits everything else from the master.
 */
export interface ComponentInstance {
  instanceId: string
  masterId: string
  /** Only the properties that differ from the master */
  overrides: Partial<EditorElement>
}

// ─── State & Actions ─────────────────────────────────────────────────────────

export interface ComponentState {
  /** masterId → MasterComponent */
  components: Record<string, MasterComponent>
  /** instanceId → ComponentInstance (instanceId matches the element id in EditorStore) */
  instances: Record<string, ComponentInstance>
}

export interface ComponentActions {
  /** Convert an element to a master component. Returns the new master id. */
  createMaster: (element: EditorElement, name?: string) => string

  /**
   * Create an instance element object for a given master.
   * Does NOT add to EditorStore — caller must do that.
   * Returns the instance element (merged master + empty overrides) and registers it.
   */
  createInstance: (masterId: string, overrides?: Partial<EditorElement>) => EditorElement | null

  /** Update a property on an instance — stores it as an override */
  setInstanceOverride: (instanceId: string, patch: Partial<EditorElement>) => void

  /** Reset one or more overrides on an instance back to master values */
  resetInstanceOverride: (instanceId: string, keys: (keyof EditorElement)[]) => void

  /**
   * Propagate a master property change to all instances.
   * Skips properties already overridden per instance.
   */
  propagateMasterChange: (masterId: string, patch: Partial<EditorElement>) => void

  /** Update master element snapshot */
  updateMaster: (masterId: string, patch: Partial<EditorElement>) => void

  /**
   * Delete a master component.
   * Returns the list of instance ids that were detached (caller must convert them in EditorStore).
   */
  deleteMaster: (masterId: string) => string[]

  /** Unregister an instance (e.g. when its element is deleted from EditorStore) */
  unregisterInstance: (instanceId: string) => void

  /**
   * Get the effective (resolved) element for an instance:
   * master element merged with overrides.
   */
  resolveInstance: (instanceId: string) => EditorElement | null
}

export type ComponentStore = ComponentState & ComponentActions

// ─── Store creation ───────────────────────────────────────────────────────────

export const useComponentStore = create<ComponentStore>()(
  immer((set, get) => ({
    components: {},
    instances: {},

    createMaster: (element, name) => {
      const masterId = nanoid()
      const masterName = name ?? element.name ?? 'Component'
      set((state: WritableDraft<ComponentStore>) => {
        state.components[masterId] = {
          id: masterId,
          name: masterName,
          element: { ...element } as WritableDraft<EditorElement>,
        }
      })
      return masterId
    },

    createInstance: (masterId, overrides = {}) => {
      const master = get().components[masterId]
      if (!master) return null

      const instanceId = nanoid()
      const instanceElement = {
        ...master.element,
        ...overrides,
        id: instanceId,
        name: `${master.name} Instance`,
      } as EditorElement

      set((state: WritableDraft<ComponentStore>) => {
        state.instances[instanceId] = {
          instanceId,
          masterId,
          overrides: { ...overrides } as WritableDraft<Partial<EditorElement>>,
        }
      })

      return instanceElement
    },

    setInstanceOverride: (instanceId, patch) => {
      set((state: WritableDraft<ComponentStore>) => {
        const inst = state.instances[instanceId]
        if (!inst) return
        Object.assign(inst.overrides, patch)
      })
    },

    resetInstanceOverride: (instanceId, keys) => {
      set((state: WritableDraft<ComponentStore>) => {
        const inst = state.instances[instanceId]
        if (!inst) return
        for (const key of keys) {
          delete (inst.overrides as Record<string, unknown>)[key as string]
        }
      })
    },

    propagateMasterChange: (masterId, patch) => {
      const state = get()
      const affectedInstances = Object.values(state.instances).filter(
        (inst) => inst.masterId === masterId,
      )

      set((draft: WritableDraft<ComponentStore>) => {
        // Update master snapshot
        if (draft.components[masterId]) {
          Object.assign(draft.components[masterId].element, patch)
        }
        // For each instance, only apply patch keys that are NOT already overridden
        for (const inst of affectedInstances) {
          const draftInst = draft.instances[inst.instanceId]
          if (!draftInst) continue
          for (const [key, value] of Object.entries(patch)) {
            if (!(key in draftInst.overrides)) {
              // Not overridden — we can propagate
              // (the resolved value will reflect master's new value)
              void value // propagation is implicit via resolveInstance reading master
            }
          }
        }
      })
    },

    updateMaster: (masterId, patch) => {
      set((state: WritableDraft<ComponentStore>) => {
        if (state.components[masterId]) {
          Object.assign(state.components[masterId].element, patch)
        }
      })
    },

    deleteMaster: (masterId) => {
      const state = get()
      const detachedIds = Object.values(state.instances)
        .filter((inst) => inst.masterId === masterId)
        .map((inst) => inst.instanceId)

      set((draft: WritableDraft<ComponentStore>) => {
        delete draft.components[masterId]
        for (const id of detachedIds) {
          delete draft.instances[id]
        }
      })

      return detachedIds
    },

    unregisterInstance: (instanceId) => {
      set((state: WritableDraft<ComponentStore>) => {
        delete state.instances[instanceId]
      })
    },

    resolveInstance: (instanceId) => {
      const state = get()
      const inst = state.instances[instanceId]
      if (!inst) return null
      const master = state.components[inst.masterId]
      if (!master) return null
      return {
        ...master.element,
        ...inst.overrides,
        id: instanceId,
      } as EditorElement
    },
  })),
)

