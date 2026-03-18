import { useRef, useState } from 'react'
import { useEditorStore, type Tool } from '../../store/editorStore'
import { exportProjectJSON, importProjectJSON } from '../../store/persistence'
import type { BreakpointId } from '../../store/breakpoints'

interface ToolItem {
  id: Tool
  label: string
  shortcut: string
  icon: string
}

const TOOLS: ToolItem[] = [
  { id: 'select', label: 'Select', shortcut: 'V', icon: 'S' },
  { id: 'frame', label: 'Frame', shortcut: 'F', icon: 'F' },
  { id: 'text', label: 'Text', shortcut: 'T', icon: 'T' },
  { id: 'image', label: 'Image', shortcut: 'I', icon: 'Im' },
  { id: 'rectangle', label: 'Rectangle', shortcut: 'R', icon: 'R' },
  { id: 'ellipse', label: 'Ellipse', shortcut: 'E', icon: 'El' },
]

// ─── Breakpoint Switcher ──────────────────────────────────────────────────────

const BREAKPOINT_ITEMS: { id: BreakpointId; label: string; shortLabel: string }[] = [
  { id: 'desktop', label: 'Desktop (1440px)', shortLabel: 'D' },
  { id: 'tablet', label: 'Tablet (768px)', shortLabel: 'T' },
  { id: 'mobile', label: 'Mobile (375px)', shortLabel: 'M' },
]

function BreakpointSwitcher() {
  const activeBreakpoint = useEditorStore((s) => s.activeBreakpoint)
  const breakpointWidths = useEditorStore((s) => s.breakpointWidths)
  const breakpointWidthError = useEditorStore((s) => s.breakpointWidthError)
  const setActiveBreakpoint = useEditorStore((s) => s.setActiveBreakpoint)
  const setBreakpointWidth = useEditorStore((s) => s.setBreakpointWidth)

  const [editingWidth, setEditingWidth] = useState<BreakpointId | null>(null)
  const [draftWidth, setDraftWidth] = useState('')

  const handleWidthFocus = (id: BreakpointId) => {
    setEditingWidth(id)
    setDraftWidth(String(breakpointWidths[id]))
  }

  const handleWidthBlur = () => {
    if (editingWidth) {
      setBreakpointWidth(editingWidth, draftWidth)
    }
    setEditingWidth(null)
  }

  const handleWidthKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (editingWidth) {
        setBreakpointWidth(editingWidth, draftWidth)
      }
      setEditingWidth(null)
    } else if (e.key === 'Escape') {
      setEditingWidth(null)
    }
  }

  return (
    <div className="flex items-center gap-1" data-testid="breakpoint-switcher">
      {BREAKPOINT_ITEMS.map(({ id, label, shortLabel }) => (
        <div key={id} className="flex items-center gap-1">
          <button
            data-testid={`breakpoint-${id}`}
            aria-label={label}
            title={label}
            onClick={() => setActiveBreakpoint(id)}
            className={[
              'px-2 h-7 rounded text-xs font-medium transition-colors',
              activeBreakpoint === id
                ? 'bg-[rgb(0,153,255)] text-white'
                : 'text-[#9ca3af] hover:text-white hover:bg-[#2a2a2a]',
            ].join(' ')}
          >
            {shortLabel}
          </button>
          {activeBreakpoint === id && (
            <div className="flex items-center gap-1">
              <input
                type="number"
                data-testid={`breakpoint-width-${id}`}
                value={editingWidth === id ? draftWidth : breakpointWidths[id]}
                min={1}
                max={10000}
                onFocus={() => handleWidthFocus(id)}
                onChange={(e) => {
                  setDraftWidth(e.target.value)
                }}
                onBlur={handleWidthBlur}
                onKeyDown={handleWidthKeyDown}
                className="w-16 bg-[#2a2a2a] text-xs text-white outline-none rounded px-2 py-1"
              />
              <span className="text-[10px] text-[#6b7280]">px</span>
            </div>
          )}
        </div>
      ))}
      {breakpointWidthError && (
        <span
          data-testid="breakpoint-width-error"
          className="text-[10px] text-red-400 ml-1"
        >
          {breakpointWidthError}
        </span>
      )}
    </div>
  )
}

interface ToolbarProps {
  onPreviewClick?: () => void
}

export function Toolbar({ onPreviewClick }: ToolbarProps) {
  const { activeTool, isPreviewMode, setActiveTool, setPreviewMode } = useEditorStore()
  const importInputRef = useRef<HTMLInputElement>(null)

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, toolId: Tool) => {
    if (e.key === 'Enter' || e.key === ' ') {
      setActiveTool(toolId)
    }
  }

  const handlePreview = () => {
    setPreviewMode(!isPreviewMode)
    onPreviewClick?.()
  }

  const handleImportChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    importProjectJSON(file).catch(() => {
      // Error toast already pushed inside importProjectJSON
    })
    // Reset input so the same file can be re-selected
    e.target.value = ''
  }

  return (
    <header
      data-testid="toolbar"
      className="flex items-center justify-between h-12 px-4 border-b border-[#3a3a3a] bg-[#000000]"
      style={{ display: isPreviewMode ? 'none' : 'flex' }}
    >
      {/* Center: Breakpoint switcher */}
      <BreakpointSwitcher />

      {/* Left: Tool icons */}
      <div className="flex items-center gap-1" role="toolbar" aria-label="Drawing tools">
        {TOOLS.map((tool) => (
          <button
            key={tool.id}
            data-testid={`tool-${tool.id}`}
            data-tool={tool.id}
            aria-label={`${tool.label} (${tool.shortcut})`}
            aria-pressed={activeTool === tool.id}
            onClick={() => setActiveTool(tool.id)}
            onKeyDown={(e) => handleKeyDown(e, tool.id)}
            title={`${tool.label} (${tool.shortcut})`}
            className={[
              'relative flex items-center justify-center w-8 h-8 rounded text-xs font-medium transition-colors',
              activeTool === tool.id
                ? 'bg-[rgb(0,153,255)] text-white'
                : 'text-[#9ca3af] hover:text-white hover:bg-[#2a2a2a]',
            ].join(' ')}
          >
            {tool.icon}
            {activeTool === tool.id && (
              <span
                data-testid="active-indicator"
                className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-white"
              />
            )}
          </button>
        ))}
      </div>

      {/* Right: Import / Export / Preview buttons */}
      <div className="flex items-center gap-2">
        {/* Hidden file input for import */}
        <input
          ref={importInputRef}
          type="file"
          accept=".json,application/json"
          data-testid="import-file-input"
          style={{ display: 'none' }}
          onChange={handleImportChange}
        />

        <button
          data-testid="import-button"
          onClick={() => importInputRef.current?.click()}
          className="px-3 h-7 rounded text-xs font-medium text-[#9ca3af] hover:text-white hover:bg-[#2a2a2a] transition-colors"
          title="Import project JSON"
        >
          Import
        </button>

        <button
          data-testid="export-button"
          onClick={exportProjectJSON}
          className="px-3 h-7 rounded text-xs font-medium text-[#9ca3af] hover:text-white hover:bg-[#2a2a2a] transition-colors"
          title="Export project JSON"
        >
          Export
        </button>

        <button
          data-testid="preview-button"
          onClick={handlePreview}
          className="px-3 h-7 rounded text-xs font-medium bg-[rgb(0,153,255)] text-white hover:bg-[rgba(0,153,255,0.8)] transition-colors"
        >
          Preview
        </button>
      </div>
    </header>
  )
}
