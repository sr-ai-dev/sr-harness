import { useEffect } from 'react'
import { useEditorStore } from '../../store/editorStore'

/**
 * KeyboardShortcuts — mounts a global keydown listener that handles all
 * editor keyboard shortcuts. Must be rendered inside the EditorLayout tree.
 *
 * Rules:
 * - In preview mode, only P and Escape work (exits preview)
 * - When a text input/textarea/contenteditable is focused, suppress all shortcuts
 *   (so typing into panels doesn't trigger tool switches etc.)
 */
export function KeyboardShortcuts() {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const store = useEditorStore.getState()
      const { isPreviewMode } = store

      // If preview mode: only P and Escape are active
      if (isPreviewMode) {
        if (e.key === 'p' || e.key === 'P') {
          e.preventDefault()
          store.setPreviewMode(false)
        } else if (e.key === 'Escape') {
          e.preventDefault()
          store.setPreviewMode(false)
        }
        return
      }

      // Suppress shortcuts when an input/textarea/select/contenteditable is focused
      const target = e.target as HTMLElement
      const isInputFocused =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable

      if (isInputFocused) return

      const isMac = navigator.platform.toUpperCase().includes('MAC')
      const metaOrCtrl = isMac ? e.metaKey : e.ctrlKey
      const selectedIds = store.selection.selectedIds

      // ── Preview toggle ───────────────────────────────────────────────────
      if (e.key === 'p' || e.key === 'P') {
        e.preventDefault()
        store.setPreviewMode(true)
        return
      }

      // ── Tool shortcuts ───────────────────────────────────────────────────
      if (!metaOrCtrl && !e.altKey && !e.shiftKey) {
        switch (e.key) {
          case 'v':
          case 'V':
            e.preventDefault()
            store.setActiveTool('select')
            return
          case 'f':
          case 'F':
            e.preventDefault()
            store.setActiveTool('frame')
            return
          case 't':
          case 'T':
            e.preventDefault()
            store.setActiveTool('text')
            return
          case 'r':
          case 'R':
            e.preventDefault()
            store.setActiveTool('rectangle')
            return
          case 'Delete':
          case 'Backspace':
            if (selectedIds.length > 0) {
              e.preventDefault()
              store.deleteElements([...selectedIds])
            }
            return
          case 'Escape':
            e.preventDefault()
            store.revertToSelect()
            store.clearSelection()
            return
        }
      }

      // ── Undo / Redo ──────────────────────────────────────────────────────
      if (metaOrCtrl && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        useEditorStore.temporal.getState().undo()
        return
      }
      if (metaOrCtrl && (e.key === 'Z' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        useEditorStore.temporal.getState().redo()
        return
      }

      // ── Clipboard ────────────────────────────────────────────────────────
      if (metaOrCtrl && e.key === 'c') {
        if (selectedIds.length > 0) {
          e.preventDefault()
          store.copyElements([...selectedIds])
        }
        return
      }
      if (metaOrCtrl && e.key === 'x') {
        if (selectedIds.length > 0) {
          e.preventDefault()
          store.cutElements([...selectedIds])
        }
        return
      }
      if (metaOrCtrl && e.key === 'v') {
        e.preventDefault()
        store.pasteElements()
        return
      }

      // ── Duplicate ────────────────────────────────────────────────────────
      if (metaOrCtrl && e.key === 'd') {
        if (selectedIds.length > 0) {
          e.preventDefault()
          store.duplicateElements([...selectedIds])
        }
        return
      }

      // ── Group ────────────────────────────────────────────────────────────
      if (metaOrCtrl && e.key === 'g' && !e.shiftKey) {
        if (selectedIds.length >= 2) {
          e.preventDefault()
          store.groupElements([...selectedIds])
        }
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return null
}
