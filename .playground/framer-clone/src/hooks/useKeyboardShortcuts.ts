import { useEffect, useRef } from 'react'
import { useEditorStore } from '../store'
import type { Element } from '../types'

// Offset applied to paste/duplicate operations so pasted elements don't overlap
const PASTE_OFFSET = 20

/**
 * Returns true when the keyboard event originated from a text-editable target.
 * Shortcuts are suppressed in these cases to avoid interfering with normal typing.
 */
function isTextEditingTarget(target: EventTarget | null): boolean {
  if (!target) return false
  const el = target as HTMLElement
  const tag = el.tagName?.toLowerCase()
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true
  if (el.isContentEditable) return true
  return false
}

/**
 * Deep-clones an element and assigns a new id, optionally re-parenting it.
 * All descendant ids are also re-mapped so the subtree is self-consistent.
 */
function cloneElementTree(
  element: Element,
  allElements: Record<string, Element>,
  newParentId: string | null,
  offset: { x: number; y: number }
): Element[] {
  const idMap = new Map<string, string>()

  const collectIds = (el: Element) => {
    idMap.set(el.id, `${el.id}_copy_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`)
    for (const childId of el.children) {
      const child = allElements[childId]
      if (child) collectIds(child)
    }
  }
  collectIds(element)

  const cloneEl = (el: Element, parentId: string | null, applyOffset: boolean): Element => {
    const newId = idMap.get(el.id)!
    const newChildren = el.children
      .filter((cid) => allElements[cid])
      .map((cid) => idMap.get(cid)!)

    const cloned: Element = {
      ...(JSON.parse(JSON.stringify(el)) as Element),
      id: newId,
      parentId,
      children: newChildren,
      x: applyOffset ? el.x + offset.x : el.x,
      y: applyOffset ? el.y + offset.y : el.y,
    }

    return cloned
  }

  const result: Element[] = []

  const traverse = (el: Element, parentId: string | null, applyOffset: boolean) => {
    const cloned = cloneEl(el, parentId, applyOffset)
    result.push(cloned)
    for (const childId of el.children) {
      const child = allElements[childId]
      if (child) traverse(child, cloned.id, false)
    }
  }

  traverse(element, newParentId, true)
  return result
}

/**
 * useKeyboardShortcuts — registers document-level keyboard shortcuts for
 * common editing actions. Must be mounted once at the editor root.
 *
 * Supported shortcuts:
 *   Delete / Backspace    — delete selected elements
 *   Cmd/Ctrl + C          — copy selected elements to internal clipboard
 *   Cmd/Ctrl + V          — paste from internal clipboard with offset
 *   Cmd/Ctrl + X          — cut (copy then delete)
 *   Cmd/Ctrl + D          — duplicate in-place with offset
 *   Cmd/Ctrl + A          — select all root elements
 *   Escape                — deselect all
 *
 * Shortcuts are suppressed when a text-editable element is focused.
 */
export function useKeyboardShortcuts() {
  const store = useEditorStore

  // Internal clipboard stored in a ref — not persisted to the Zustand store
  // so it doesn't pollute undo history.
  const clipboardRef = useRef<Element[]>([])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Suppress shortcuts during text editing
      if (isTextEditingTarget(e.target)) return

      const meta = e.metaKey || e.ctrlKey
      const key = e.key

      const {
        selectedIds,
        elements,
        rootIds,
        multiSelect,
        deselectAll,
      } = store.getState()

      // ── Delete / Backspace ────────────────────────────────────────────
      if ((key === 'Delete' || key === 'Backspace') && !meta) {
        if (selectedIds.length === 0) return
        e.preventDefault()
        // Remove all selected elements (iterate copy since removal mutates selectedIds)
        const toRemove = [...selectedIds]
        for (const id of toRemove) {
          store.getState().removeElement(id)
        }
        return
      }

      // ── Escape — deselect all ─────────────────────────────────────────
      if (key === 'Escape') {
        deselectAll()
        return
      }

      if (!meta) return

      // ── Cmd+A — select all root elements ─────────────────────────────
      if (key === 'a' || key === 'A') {
        e.preventDefault()
        if (rootIds.length > 0) {
          multiSelect([...rootIds])
        }
        return
      }

      // ── Cmd+C — copy ─────────────────────────────────────────────────
      if (key === 'c' || key === 'C') {
        e.preventDefault()
        if (selectedIds.length === 0) return
        const copied: Element[] = []
        for (const id of selectedIds) {
          const el = elements[id]
          if (el) copied.push(JSON.parse(JSON.stringify(el)) as Element)
        }
        clipboardRef.current = copied
        return
      }

      // ── Cmd+X — cut (copy then delete) ───────────────────────────────
      if (key === 'x' || key === 'X') {
        e.preventDefault()
        if (selectedIds.length === 0) return
        const copied: Element[] = []
        for (const id of selectedIds) {
          const el = elements[id]
          if (el) copied.push(JSON.parse(JSON.stringify(el)) as Element)
        }
        clipboardRef.current = copied
        const toRemove = [...selectedIds]
        for (const id of toRemove) {
          store.getState().removeElement(id)
        }
        return
      }

      // ── Cmd+V — paste ─────────────────────────────────────────────────
      if (key === 'v' || key === 'V') {
        e.preventDefault()
        if (clipboardRef.current.length === 0) return
        const newIds: string[] = []
        for (const el of clipboardRef.current) {
          // Only paste root-level clipboard items (their children are included in subtree)
          if (el.parentId !== null) continue
          const cloned = cloneElementTree(
            el,
            store.getState().elements,
            null,
            { x: PASTE_OFFSET, y: PASTE_OFFSET }
          )
          for (const clonedEl of cloned) {
            store.getState().addElement(clonedEl)
          }
          if (cloned.length > 0) newIds.push(cloned[0].id)
        }
        if (newIds.length > 0) multiSelect(newIds)
        return
      }

      // ── Cmd+D — duplicate ─────────────────────────────────────────────
      if (key === 'd' || key === 'D') {
        e.preventDefault()
        if (selectedIds.length === 0) return
        const newIds: string[] = []
        for (const id of selectedIds) {
          const el = store.getState().elements[id]
          if (!el) continue
          const cloned = cloneElementTree(
            el,
            store.getState().elements,
            el.parentId,
            { x: PASTE_OFFSET, y: PASTE_OFFSET }
          )
          for (const clonedEl of cloned) {
            store.getState().addElement(clonedEl)
          }
          if (cloned.length > 0) newIds.push(cloned[0].id)
        }
        if (newIds.length > 0) multiSelect(newIds)
        return
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [store])
}
