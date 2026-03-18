import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useEditorStore } from '../store'
import {
  SCHEMA_VERSION,
  buildSnapshot,
  validateSnapshot,
  saveToLocalStorage,
  loadFromLocalStorage,
  importFromJSON,
  exportToJSON,
  startAutoSave,
  setNotificationHandler,
} from '../store/persistence'
import type { FrameElement } from '../types'

// ───────────────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────────────
function makeFrame(id: string): FrameElement {
  return {
    id,
    type: 'frame',
    x: 10,
    y: 20,
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

function resetStore() {
  useEditorStore.setState({
    elements: {},
    rootIds: [],
    selectedIds: [],
    past: [],
    future: [],
  })
}

// ───────────────────────────────────────────────────────────────────────────
// Mock localStorage
// ───────────────────────────────────────────────────────────────────────────
function createLocalStorageMock() {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      store = {}
    }),
    get length() {
      return Object.keys(store).length
    },
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
    _store: () => store,
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Tests
// ───────────────────────────────────────────────────────────────────────────
describe('persistence', () => {
  let localStorageMock: ReturnType<typeof createLocalStorageMock>

  beforeEach(() => {
    resetStore()
    localStorageMock = createLocalStorageMock()
    Object.defineProperty(globalThis, 'localStorage', {
      value: localStorageMock,
      writable: true,
      configurable: true,
    })
    // Reset notification handler to silent default for each test
    setNotificationHandler(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ── R6-S1: Auto-save / save to LocalStorage ──────────────────────────────
  describe('R6-S1 — save to LocalStorage', () => {
    it('persists current store state to localStorage', () => {
      const frame = makeFrame('el-1')
      useEditorStore.getState().addElement(frame)

      const saved = saveToLocalStorage()

      expect(saved).toBe(true)
      expect(localStorageMock.setItem).toHaveBeenCalled()

      const raw = localStorageMock.setItem.mock.calls[0][1] as string
      const parsed = JSON.parse(raw)
      expect(parsed.schemaVersion).toBe(SCHEMA_VERSION)
      expect(parsed.elements['el-1']).toBeDefined()
      expect(parsed.rootIds).toContain('el-1')
    })

    it('loadFromLocalStorage restores persisted state on startup', () => {
      const frame = makeFrame('el-2')
      useEditorStore.getState().addElement(frame)
      saveToLocalStorage()

      // Clear store to simulate fresh startup
      resetStore()
      expect(useEditorStore.getState().elements).toEqual({})

      const loaded = loadFromLocalStorage()
      expect(loaded).toBe(true)
      expect(useEditorStore.getState().elements['el-2']).toBeDefined()
      expect(useEditorStore.getState().rootIds).toContain('el-2')
    })

    it('returns false when localStorage has nothing saved', () => {
      const loaded = loadFromLocalStorage()
      expect(loaded).toBe(false)
    })

    it('auto-save subscribes and triggers saveToLocalStorage after debounce', async () => {
      vi.useFakeTimers()
      const stopAutoSave = startAutoSave()

      const frame = makeFrame('el-auto')
      useEditorStore.getState().addElement(frame)

      // Should not have saved yet (debounce)
      expect(localStorageMock.setItem).not.toHaveBeenCalled()

      // Advance timer past debounce window
      await vi.advanceTimersByTimeAsync(2500)

      expect(localStorageMock.setItem).toHaveBeenCalled()

      stopAutoSave()
      vi.useRealTimers()
    })
  })

  // ── R6-S2: Export JSON ───────────────────────────────────────────────────
  describe('R6-S2 — export JSON file download', () => {
    it('creates a Blob URL and triggers anchor download with project state', () => {
      const frame = makeFrame('el-export')
      useEditorStore.getState().addElement(frame)

      // Mock browser download APIs
      const createObjectURL = vi.fn(() => 'blob:mock-url')
      const revokeObjectURL = vi.fn()
      const clickMock = vi.fn()

      Object.defineProperty(globalThis, 'URL', {
        value: { createObjectURL, revokeObjectURL },
        writable: true,
        configurable: true,
      })

      const anchorEl = { href: '', download: '', click: clickMock } as unknown as HTMLAnchorElement
      vi.spyOn(document, 'createElement').mockReturnValue(anchorEl)

      exportToJSON('my-project.json')

      expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
      expect(anchorEl.download).toBe('my-project.json')
      expect(clickMock).toHaveBeenCalled()
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
    })

    it('exported JSON contains complete project state', () => {
      const frame = makeFrame('el-check')
      useEditorStore.getState().addElement(frame)

      let capturedBlob: Blob | null = null
      Object.defineProperty(globalThis, 'URL', {
        value: {
          createObjectURL: vi.fn((b: Blob) => {
            capturedBlob = b
            return 'blob:x'
          }),
          revokeObjectURL: vi.fn(),
        },
        writable: true,
        configurable: true,
      })
      vi.spyOn(document, 'createElement').mockReturnValue({
        href: '',
        download: '',
        click: vi.fn(),
      } as unknown as HTMLAnchorElement)

      exportToJSON()

      expect(capturedBlob).not.toBeNull()
      return capturedBlob!.text().then((text) => {
        const parsed = JSON.parse(text)
        expect(parsed.schemaVersion).toBe(SCHEMA_VERSION)
        expect(parsed.elements['el-check']).toBeDefined()
      })
    })
  })

  // ── R6-S3: Import JSON ───────────────────────────────────────────────────
  describe('R6-S3 — import JSON loads project', () => {
    it('loads elements from a valid JSON string and updates the store', () => {
      const snapshot = {
        schemaVersion: SCHEMA_VERSION,
        elements: { 'imported-1': makeFrame('imported-1') },
        rootIds: ['imported-1'],
      }

      const result = importFromJSON(JSON.stringify(snapshot))

      expect(result.valid).toBe(true)
      expect(useEditorStore.getState().elements['imported-1']).toBeDefined()
      expect(useEditorStore.getState().rootIds).toContain('imported-1')
    })

    it('clears previous state when importing', () => {
      // Pre-populate store
      useEditorStore.getState().addElement(makeFrame('old-el'))
      expect(useEditorStore.getState().elements['old-el']).toBeDefined()

      const snapshot = {
        schemaVersion: SCHEMA_VERSION,
        elements: { 'new-el': makeFrame('new-el') },
        rootIds: ['new-el'],
      }

      importFromJSON(JSON.stringify(snapshot))

      expect(useEditorStore.getState().elements['old-el']).toBeUndefined()
      expect(useEditorStore.getState().elements['new-el']).toBeDefined()
    })
  })

  // ── R6-S4: Invalid JSON error ────────────────────────────────────────────
  describe('R6-S4 — invalid JSON import shows error, does not affect project', () => {
    it('returns invalid result and shows error for malformed JSON', () => {
      const notifications: string[] = []
      setNotificationHandler((_level, msg) => notifications.push(msg))

      useEditorStore.getState().addElement(makeFrame('safe-el'))
      const stateBefore = JSON.stringify(useEditorStore.getState().elements)

      const result = importFromJSON('not valid json }{')

      expect(result.valid).toBe(false)
      expect(result.error).toBeTruthy()
      expect(notifications.length).toBeGreaterThan(0)

      // Store must be unchanged
      expect(JSON.stringify(useEditorStore.getState().elements)).toBe(stateBefore)
    })
  })

  // ── R6-S5: LocalStorage full / unavailable ───────────────────────────────
  describe('R6-S5 — localStorage full shows warning', () => {
    it('returns false and fires a warning notification when localStorage.setItem throws', () => {
      const warnings: string[] = []
      setNotificationHandler((level, msg) => {
        if (level === 'warn') warnings.push(msg)
      })

      localStorageMock.setItem.mockImplementation(() => {
        const err = new Error('QuotaExceededError')
        err.name = 'QuotaExceededError'
        throw err
      })

      const result = saveToLocalStorage()

      expect(result).toBe(false)
      expect(warnings.length).toBeGreaterThan(0)
      expect(warnings[0]).toMatch(/LocalStorage/i)
      expect(warnings[0]).toMatch(/Export JSON/i)
    })
  })

  // ── R6-S6: Schema validation errors ─────────────────────────────────────
  describe('R6-S6 — valid JSON with invalid schema shows specific error', () => {
    it('rejects when schemaVersion is missing', () => {
      const notifications: string[] = []
      setNotificationHandler((_level, msg) => notifications.push(msg))

      useEditorStore.getState().addElement(makeFrame('keep-me'))
      const stateBefore = JSON.stringify(useEditorStore.getState().elements)

      // Valid JSON but no schemaVersion
      const result = importFromJSON(JSON.stringify({ elements: {}, rootIds: [] }))

      expect(result.valid).toBe(false)
      expect(result.error).toMatch(/schemaVersion/i)
      expect(notifications.length).toBeGreaterThan(0)
      expect(JSON.stringify(useEditorStore.getState().elements)).toBe(stateBefore)
    })

    it('rejects when elements field is missing', () => {
      const result = importFromJSON(
        JSON.stringify({ schemaVersion: SCHEMA_VERSION, rootIds: [] })
      )
      expect(result.valid).toBe(false)
      expect(result.error).toMatch(/elements/i)
    })

    it('rejects when rootIds field is missing', () => {
      const result = importFromJSON(
        JSON.stringify({ schemaVersion: SCHEMA_VERSION, elements: {} })
      )
      expect(result.valid).toBe(false)
      expect(result.error).toMatch(/rootIds/i)
    })

    it('rejects when schemaVersion does not match expected', () => {
      const result = importFromJSON(
        JSON.stringify({ schemaVersion: 999, elements: {}, rootIds: [] })
      )
      expect(result.valid).toBe(false)
      expect(result.error).toMatch(/schema version/i)
    })

    it('rejects when rootIds is not an array', () => {
      const result = importFromJSON(
        JSON.stringify({ schemaVersion: SCHEMA_VERSION, elements: {}, rootIds: 'not-array' })
      )
      expect(result.valid).toBe(false)
      expect(result.error).toMatch(/rootIds/i)
    })
  })

  // ── Security: prototype pollution ────────────────────────────────────────
  describe('security — prototype pollution prevention', () => {
    it('does not pollute Object.prototype when __proto__ key is present in element data', () => {
      // Craft a JSON string that contains __proto__ at element level.
      // JSON.parse with __proto__ as a key does NOT set the prototype, but
      // it will appear as an own enumerable key; our sanitiser must strip it.
      const malicious = `{
        "schemaVersion": ${SCHEMA_VERSION},
        "elements": {
          "el-attack": {
            "id": "el-attack",
            "type": "frame",
            "x": 0, "y": 0, "width": 100, "height": 100,
            "rotation": 0, "opacity": 1, "visible": true, "locked": false,
            "name": "attack", "parentId": null, "children": [], "zIndex": 0,
            "backgroundColor": "#fff", "borderRadius": 0, "borderWidth": 0,
            "borderColor": "#000", "overflow": "visible", "layoutMode": "none",
            "gap": 0, "padding": {"top":0,"right":0,"bottom":0,"left":0},
            "__proto__": {"polluted": true}
          }
        },
        "rootIds": ["el-attack"]
      }`

      const before = (Object.prototype as Record<string, unknown>)['polluted']

      const result = importFromJSON(malicious)

      expect(result.valid).toBe(true)
      // Object.prototype must not have been mutated
      expect((Object.prototype as Record<string, unknown>)['polluted']).toBe(before)

      // The stored element must not carry the __proto__ own key
      const stored = useEditorStore.getState().elements['el-attack'] as unknown as Record<string, unknown>
      expect(Object.prototype.hasOwnProperty.call(stored, '__proto__')).toBe(false)
    })

    it('filters out elements with unknown types and keeps valid ones', () => {
      const snapshot = {
        schemaVersion: SCHEMA_VERSION,
        elements: {
          'valid-el': makeFrame('valid-el'),
          'evil-el': {
            id: 'evil-el',
            type: 'evil-script', // unknown type — should be rejected
            x: 0, y: 0, width: 10, height: 10,
          },
        },
        rootIds: ['valid-el', 'evil-el'],
      }

      const warnings: string[] = []
      setNotificationHandler((level, msg) => {
        if (level === 'warn') warnings.push(msg)
      })

      const result = importFromJSON(JSON.stringify(snapshot))

      expect(result.valid).toBe(true)
      // Valid element is kept
      expect(useEditorStore.getState().elements['valid-el']).toBeDefined()
      // Unknown-type element is filtered out
      expect(useEditorStore.getState().elements['evil-el']).toBeUndefined()
      // A warning must have been emitted
      expect(warnings.some((w) => w.includes('evil-el'))).toBe(true)
    })
  })

  describe('R6-S6 continued — valid JSON with invalid schema', () => {
    it('validateSnapshot helper returns valid for correct shape', () => {
      const good = {
        schemaVersion: SCHEMA_VERSION,
        elements: { 'x': makeFrame('x') },
        rootIds: ['x'],
      }
      expect(validateSnapshot(good)).toEqual({ valid: true })
    })

    it('buildSnapshot captures current store state', () => {
      const frame = makeFrame('snap-el')
      useEditorStore.getState().addElement(frame)

      const snap = buildSnapshot()
      expect(snap.schemaVersion).toBe(SCHEMA_VERSION)
      expect(snap.elements['snap-el']).toBeDefined()
      expect(snap.rootIds).toContain('snap-el')
    })
  })
})
