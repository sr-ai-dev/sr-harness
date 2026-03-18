import { useState, useCallback } from 'react'
import { Toolbar } from './Toolbar'
import { LeftPanel } from './LeftPanel'
import { RightPanel } from './RightPanel'
import { ToastNotifications } from './ToastNotifications'
import { KeyboardShortcuts } from './KeyboardShortcuts'
import { ContextMenu, type ContextMenuState } from './ContextMenu'
import { Canvas } from '../canvas/Canvas'
import { useEditorStore } from '../../store/editorStore'

export function EditorLayout() {
  const isPreviewMode = useEditorStore((s) => s.isPreviewMode)

  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    targetId: null,
  })

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const store = useEditorStore.getState()
    const selectedIds = store.selection.selectedIds
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      targetId: selectedIds.length === 1 ? selectedIds[0] : null,
    })
  }, [])

  const closeContextMenu = useCallback(() => {
    setContextMenu((prev) => ({ ...prev, visible: false }))
  }, [])

  return (
    <div
      data-testid="editor-layout"
      className="flex flex-col w-full h-full bg-[#000000] text-white"
      style={{ fontFamily: '"Inter", ui-sans-serif, system-ui, sans-serif' }}
      onContextMenu={handleContextMenu}
    >
      {/* Keyboard shortcut handler (no DOM output) */}
      <KeyboardShortcuts />

      {/* Top Toolbar - always rendered but hidden in preview mode */}
      <Toolbar />

      {/* Main content: left panel + canvas + right panel */}
      <div className="flex flex-1 overflow-hidden">
        {!isPreviewMode && <LeftPanel />}
        <Canvas />
        {!isPreviewMode && <RightPanel />}
      </div>

      {/* Context menu (portal-like, fixed position) */}
      <ContextMenu menu={contextMenu} onClose={closeContextMenu} />

      {/* Toast notifications */}
      <ToastNotifications />
    </div>
  )
}
