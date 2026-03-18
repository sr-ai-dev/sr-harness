import { useEffect, useRef } from 'react'
import { useEditorStore } from '../../store/editorStore'
import type { RectangleElement } from '../../types'

export function Canvas() {
  const activeTool = useEditorStore((s) => s.activeTool)
  const revertToSelect = useEditorStore((s) => s.revertToSelect)
  const camera = useEditorStore((s) => s.camera)
  const elements = useEditorStore((s) => s.elements)
  const zoomAt = useEditorStore((s) => s.zoomAt)
  const pan = useEditorStore((s) => s.pan)

  const isPanning = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })

  // Undo / Redo keyboard shortcuts
  useEffect(() => {
    const { undo, redo } = useEditorStore.temporal.getState()
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      } else if (mod && (e.key === 'z') && e.shiftKey) {
        e.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Track spacebar for pan mode
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) isPanning.current = true
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') isPanning.current = false
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  const handleCanvasClick = () => {
    if (activeTool !== 'select') {
      revertToSelect()
    }
  }

  const handleWheel = (e: React.WheelEvent<HTMLElement>) => {
    e.preventDefault()
    const rect = e.currentTarget.getBoundingClientRect()
    const originX = e.clientX - rect.left
    const originY = e.clientY - rect.top
    // Negative deltaY = scroll up = zoom in
    zoomAt(-e.deltaY, originX, originY)
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    lastPos.current = { x: e.clientX, y: e.clientY }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning.current && e.buttons === 1) {
      pan(e.clientX - lastPos.current.x, e.clientY - lastPos.current.y)
      lastPos.current = { x: e.clientX, y: e.clientY }
    }
  }

  const transformStyle = `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`

  return (
    <main
      data-testid="canvas"
      onClick={handleCanvasClick}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      className="flex-1 h-full relative overflow-hidden bg-[#111111]"
      style={{ cursor: activeTool === 'select' ? 'default' : 'crosshair' }}
    >
      {/* Canvas viewport with CSS transform for zoom/pan */}
      <div
        data-testid="canvas-viewport"
        data-zoom={camera.zoom}
        data-translate-x={camera.x}
        data-translate-y={camera.y}
        style={{ transform: transformStyle, transformOrigin: '0 0' }}
        className="absolute top-0 left-0 w-full h-full"
      >
        {Object.values(elements).map((el) => {
          const rect = el as RectangleElement
          return (
            <div
              key={el.id}
              data-testid={`element-${el.id}`}
              data-element-id={el.id}
              data-x={el.x}
              data-y={el.y}
              style={{
                position: 'absolute',
                left: el.x,
                top: el.y,
                width: el.width,
                height: el.height,
                background: 'fill' in rect ? rect.fill : '#888',
                opacity: el.opacity,
              }}
            />
          )
        })}
      </div>

      {/* Debug zoom display */}
      <div
        data-testid="zoom-display"
        className="absolute bottom-4 right-4 text-white text-xs opacity-60 pointer-events-none select-none"
      >
        {Math.round(camera.zoom * 100)}%
      </div>
    </main>
  )
}
