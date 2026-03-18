import { useState, useEffect, useRef } from 'react'
import { useEditorStore } from '../../store'
import type { Element } from '../../types'

// ─────────────────────────────────────────────────────────────────────────────
// Icon map for element types
// ─────────────────────────────────────────────────────────────────────────────
const TYPE_ICONS: Record<string, string> = {
  frame: '▢',
  text: 'T',
  image: '⬜',
  button: '⬡',
  input: '▭',
  video: '▶',
  icon: '✦',
  divider: '─',
}

// ─────────────────────────────────────────────────────────────────────────────
// LayerRow: single row in the tree
// ─────────────────────────────────────────────────────────────────────────────
interface LayerRowProps {
  element: Element
  depth: number
  isExpanded: boolean
  isSelected: boolean
  onToggleExpand: (id: string) => void
  onSelect: (id: string) => void
  onDragStart: (e: React.DragEvent, id: string) => void
  onDragOver: (e: React.DragEvent, id: string) => void
  onDrop: (e: React.DragEvent, id: string) => void
}

function LayerRow({
  element,
  depth,
  isExpanded,
  isSelected,
  onToggleExpand,
  onSelect,
  onDragStart,
  onDragOver,
  onDrop,
}: LayerRowProps) {
  const hasChildren = element.children.length > 0
  const icon = TYPE_ICONS[element.type] ?? '?'
  const indentPx = depth * 16

  return (
    <div
      data-testid={`layer-row-${element.id}`}
      data-layer-id={element.id}
      draggable
      onDragStart={(e) => onDragStart(e, element.id)}
      onDragOver={(e) => onDragOver(e, element.id)}
      onDrop={(e) => onDrop(e, element.id)}
      onClick={() => onSelect(element.id)}
      style={{
        display: 'flex',
        alignItems: 'center',
        paddingLeft: indentPx + 8,
        paddingRight: 8,
        paddingTop: 4,
        paddingBottom: 4,
        cursor: 'pointer',
        backgroundColor: isSelected ? '#0a84ff22' : 'transparent',
        borderLeft: isSelected ? '2px solid #0a84ff' : '2px solid transparent',
        userSelect: 'none',
        fontSize: 12,
        color: '#e0e0e0',
      }}
    >
      {/* Expand/Collapse toggle */}
      <span
        data-testid={`layer-toggle-${element.id}`}
        onClick={(e) => {
          e.stopPropagation()
          if (hasChildren) onToggleExpand(element.id)
        }}
        style={{
          width: 14,
          display: 'inline-block',
          color: '#888',
          cursor: hasChildren ? 'pointer' : 'default',
          flexShrink: 0,
        }}
      >
        {hasChildren ? (isExpanded ? '▾' : '▸') : ''}
      </span>

      {/* Type icon */}
      <span
        style={{
          marginRight: 6,
          color: '#888',
          fontSize: 10,
          width: 12,
          textAlign: 'center',
          flexShrink: 0,
        }}
      >
        {icon}
      </span>

      {/* Element name */}
      <span
        style={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flex: 1,
        }}
      >
        {element.name}
      </span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Recursive tree renderer
// ─────────────────────────────────────────────────────────────────────────────
interface TreeNodeProps {
  id: string
  depth: number
  expandedIds: Set<string>
  selectedIds: string[]
  onToggleExpand: (id: string) => void
  onSelect: (id: string) => void
  onDragStart: (e: React.DragEvent, id: string) => void
  onDragOver: (e: React.DragEvent, id: string) => void
  onDrop: (e: React.DragEvent, id: string) => void
}

function TreeNode({
  id,
  depth,
  expandedIds,
  selectedIds,
  onToggleExpand,
  onSelect,
  onDragStart,
  onDragOver,
  onDrop,
}: TreeNodeProps) {
  const element = useEditorStore((s) => s.elements[id])
  if (!element) return null

  const isExpanded = expandedIds.has(id)
  const isSelected = selectedIds.includes(id)

  return (
    <>
      <LayerRow
        element={element}
        depth={depth}
        isExpanded={isExpanded}
        isSelected={isSelected}
        onToggleExpand={onToggleExpand}
        onSelect={onSelect}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDrop={onDrop}
      />
      {isExpanded &&
        element.children.map((childId) => (
          <TreeNode
            key={childId}
            id={childId}
            depth={depth + 1}
            expandedIds={expandedIds}
            selectedIds={selectedIds}
            onToggleExpand={onToggleExpand}
            onSelect={onSelect}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDrop={onDrop}
          />
        ))}
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// LayersPanel: main export
// ─────────────────────────────────────────────────────────────────────────────
export function LayersPanel() {
  const rootIds = useEditorStore((s) => s.rootIds)
  const elements = useEditorStore((s) => s.elements)
  const selectedIds = useEditorStore((s) => s.selectedIds)
  const selectElement = useEditorStore((s) => s.selectElement)
  const reorderElement = useEditorStore((s) => s.reorderElement)

  // Track expanded nodes
  // Initialize with all container elements that have children expanded
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    const initial = new Set<string>()
    Object.values(elements).forEach((el) => {
      if (el.children.length > 0) initial.add(el.id)
    })
    return initial
  })

  // Auto-expand newly added container elements
  useEffect(() => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      let changed = false
      Object.values(elements).forEach((el) => {
        if (el.children.length > 0 && !next.has(el.id)) {
          next.add(el.id)
          changed = true
        }
      })
      return changed ? next : prev
    })
  }, [elements])

  // Drag state
  const dragIdRef = useRef<string | null>(null)

  const handleToggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleSelect = (id: string) => {
    selectElement(id)
  }

  const handleDragStart = (e: React.DragEvent, id: string) => {
    dragIdRef.current = id
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', id)
  }

  const handleDragOver = (e: React.DragEvent, _id: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    const sourceId = dragIdRef.current
    dragIdRef.current = null

    if (!sourceId || sourceId === targetId) return

    const sourceEl = elements[sourceId]
    const targetEl = elements[targetId]
    if (!sourceEl || !targetEl) return

    // Only reorder within the same parent
    if (sourceEl.parentId !== targetEl.parentId) return

    // Determine the sibling array
    const siblings =
      sourceEl.parentId === null
        ? rootIds
        : elements[sourceEl.parentId]?.children ?? []

    const fromIndex = siblings.indexOf(sourceId)
    const toIndex = siblings.indexOf(targetId)
    if (fromIndex === -1 || toIndex === -1) return

    reorderElement(sourceId, fromIndex, toIndex)
  }

  // Empty state
  if (rootIds.length === 0) {
    return (
      <div data-testid="layers-panel">
        <div
          data-testid="layers-panel-empty"
          style={{
            padding: '24px 16px',
            color: '#888',
            fontSize: 12,
            textAlign: 'center',
          }}
        >
          No layers yet. Add elements to the canvas to see them here.
        </div>
      </div>
    )
  }

  return (
    <div data-testid="layers-panel">
      <div data-testid="layers-panel-tree" style={{ paddingTop: 4 }}>
        {rootIds.map((id) => (
          <TreeNode
            key={id}
            id={id}
            depth={0}
            expandedIds={expandedIds}
            selectedIds={selectedIds}
            onToggleExpand={handleToggleExpand}
            onSelect={handleSelect}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          />
        ))}
      </div>
    </div>
  )
}

export default LayersPanel
