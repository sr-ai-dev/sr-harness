import type { ElementMap } from '../types'
import { useEditorStore } from './editorStore'

// ───────────────────────────────────────────────────────────────────────────
// Schema version — bump when serialised shape changes in a breaking way
// ───────────────────────────────────────────────────────────────────────────
export const SCHEMA_VERSION = 1

// ───────────────────────────────────────────────────────────────────────────
// Serialised project shape
// ───────────────────────────────────────────────────────────────────────────
export interface ProjectSnapshot {
  schemaVersion: number
  elements: ElementMap
  rootIds: string[]
}

// ───────────────────────────────────────────────────────────────────────────
// LocalStorage key
// ───────────────────────────────────────────────────────────────────────────
const STORAGE_KEY = 'framer-clone-project'

// ───────────────────────────────────────────────────────────────────────────
// Notification callback — consumers can subscribe to warnings/errors
// ───────────────────────────────────────────────────────────────────────────
export type NotificationLevel = 'warn' | 'error'
export type NotificationHandler = (level: NotificationLevel, message: string) => void

let notificationHandler: NotificationHandler = (level, message) => {
  if (level === 'warn') console.warn('[persistence]', message)
  else console.error('[persistence]', message)
}

export function setNotificationHandler(handler: NotificationHandler): void {
  notificationHandler = handler
}

function notify(level: NotificationLevel, message: string): void {
  notificationHandler(level, message)
}

// ───────────────────────────────────────────────────────────────────────────
// Build a snapshot from current store state
// ───────────────────────────────────────────────────────────────────────────
export function buildSnapshot(): ProjectSnapshot {
  const { elements, rootIds } = useEditorStore.getState()
  return {
    schemaVersion: SCHEMA_VERSION,
    elements: JSON.parse(JSON.stringify(elements)) as ElementMap,
    rootIds: [...rootIds],
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Schema validation
// ───────────────────────────────────────────────────────────────────────────
export interface ValidationResult {
  valid: boolean
  error?: string
}

export function validateSnapshot(data: unknown): ValidationResult {
  if (typeof data !== 'object' || data === null) {
    return { valid: false, error: 'Import data must be a JSON object' }
  }

  const obj = data as Record<string, unknown>

  if (typeof obj['schemaVersion'] !== 'number') {
    return { valid: false, error: 'Missing or invalid field: schemaVersion (must be a number)' }
  }

  if (obj['schemaVersion'] !== SCHEMA_VERSION) {
    return {
      valid: false,
      error: `Unsupported schema version: ${obj['schemaVersion']} (expected ${SCHEMA_VERSION})`,
    }
  }

  if (typeof obj['elements'] !== 'object' || obj['elements'] === null || Array.isArray(obj['elements'])) {
    return { valid: false, error: 'Missing or invalid field: elements (must be an object)' }
  }

  if (!Array.isArray(obj['rootIds'])) {
    return { valid: false, error: 'Missing or invalid field: rootIds (must be an array)' }
  }

  return { valid: true }
}

// ───────────────────────────────────────────────────────────────────────────
// Save to LocalStorage
// ───────────────────────────────────────────────────────────────────────────
export function saveToLocalStorage(): boolean {
  try {
    const snapshot = buildSnapshot()
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
    return true
  } catch (_err) {
    // Covers QuotaExceededError and SecurityError (private browsing)
    notify(
      'warn',
      'Could not save to LocalStorage (storage full or unavailable). ' +
        'Please use Export JSON to save a backup of your project.'
    )
    return false
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Load from LocalStorage (called on app startup)
// Returns true if state was restored, false otherwise
// ───────────────────────────────────────────────────────────────────────────
export function loadFromLocalStorage(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return false

    const data: unknown = JSON.parse(raw)
    const result = validateSnapshot(data)
    if (!result.valid) {
      notify('warn', `Ignoring stored project — ${result.error}`)
      return false
    }

    const snapshot = data as ProjectSnapshot
    useEditorStore.setState({
      elements: snapshot.elements,
      rootIds: snapshot.rootIds,
      selectedIds: [],
      past: [],
      future: [],
    })
    return true
  } catch {
    return false
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Export: trigger a file download in the browser
// ───────────────────────────────────────────────────────────────────────────
export function exportToJSON(filename = 'project.json'): void {
  const snapshot = buildSnapshot()
  const json = JSON.stringify(snapshot, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()

  URL.revokeObjectURL(url)
}

// ───────────────────────────────────────────────────────────────────────────
// Import: parse a JSON string and apply to store
// Returns a ValidationResult so callers can show a UI error on failure
// ───────────────────────────────────────────────────────────────────────────
export function importFromJSON(jsonString: string): ValidationResult {
  let data: unknown
  try {
    data = JSON.parse(jsonString)
  } catch {
    const result: ValidationResult = { valid: false, error: 'File is not valid JSON' }
    notify('error', result.error!)
    return result
  }

  const validation = validateSnapshot(data)
  if (!validation.valid) {
    notify('error', `Invalid project file — ${validation.error}`)
    return validation
  }

  const snapshot = data as ProjectSnapshot
  useEditorStore.setState({
    elements: snapshot.elements,
    rootIds: snapshot.rootIds,
    selectedIds: [],
    past: [],
    future: [],
  })

  return { valid: true }
}

// ───────────────────────────────────────────────────────────────────────────
// Auto-save: debounced subscriber attached to the store
// Returns an unsubscribe function
// ───────────────────────────────────────────────────────────────────────────
const AUTO_SAVE_DELAY_MS = 2000

export function startAutoSave(): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null

  const unsubscribe = useEditorStore.subscribe(() => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      saveToLocalStorage()
    }, AUTO_SAVE_DELAY_MS)
  })

  return () => {
    if (timer) clearTimeout(timer)
    unsubscribe()
  }
}
