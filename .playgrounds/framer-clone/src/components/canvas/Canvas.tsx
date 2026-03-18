import { useEffect, useRef } from 'react'
import { useEditorStore } from '../../store/editorStore'
import type {
  EditorElement,
  FrameElement,
  TextElement,
  ImageElement,
  RectangleElement,
  EllipseElement,
} from '../../types'

// ─── Element sub-components ──────────────────────────────────────────────────

function FrameNode({ el }: { el: FrameElement }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: el.x,
        top: el.y,
        width: el.width,
        height: el.height,
        background: el.fill,
        borderRadius: el.borderRadius,
        opacity: el.opacity,
        overflow: el.clipContent ? 'hidden' : 'visible',
        transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
        visibility: el.visible ? 'visible' : 'hidden',
      }}
    />
  )
}

function TextNode({ el }: { el: TextElement }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: el.x,
        top: el.y,
        width: el.width,
        height: el.height,
        color: el.color,
        fontSize: el.fontSize,
        fontFamily: el.fontFamily,
        fontWeight: el.fontWeight,
        textAlign: el.textAlign,
        lineHeight: el.lineHeight,
        opacity: el.opacity,
        transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
        visibility: el.visible ? 'visible' : 'hidden',
        pointerEvents: 'none',
        userSelect: 'none',
        whiteSpace: 'pre-wrap',
      }}
    >
      {el.content}
    </div>
  )
}

function ImageNode({ el }: { el: ImageElement }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: el.x,
        top: el.y,
        width: el.width,
        height: el.height,
        opacity: el.opacity,
        transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
        visibility: el.visible ? 'visible' : 'hidden',
        overflow: 'hidden',
      }}
    >
      {el.src && (
        <img
          src={el.src}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: el.objectFit }}
          draggable={false}
        />
      )}
    </div>
  )
}

function RectangleNode({ el }: { el: RectangleElement }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: el.x,
        top: el.y,
        width: el.width,
        height: el.height,
        background: el.fill,
        borderRadius: el.borderRadius,
        border: el.strokeWidth > 0 ? `${el.strokeWidth}px solid ${el.stroke}` : undefined,
        opacity: el.opacity,
        transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
        visibility: el.visible ? 'visible' : 'hidden',
      }}
    />
  )
}

function EllipseNode({ el }: { el: EllipseElement }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: el.x,
        top: el.y,
        width: el.width,
        height: el.height,
        background: el.fill,
        borderRadius: '50%',
        border: el.strokeWidth > 0 ? `${el.strokeWidth}px solid ${el.stroke}` : undefined,
        opacity: el.opacity,
        transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
        visibility: el.visible ? 'visible' : 'hidden',
      }}
    />
  )
}

function ElementNode({ el }: { el: EditorElement }) {
  switch (el.kind) {
    case 'frame':
      return <FrameNode el={el as FrameElement} />
    case 'text':
      return <TextNode el={el as TextElement} />
    case 'image':
      return <ImageNode el={el as ImageElement} />
    case 'rectangle':
      return <RectangleNode el={el as RectangleElement} />
    case 'ellipse':
      return <EllipseNode el={el as EllipseElement} />
    default:
      return null
  }
}

// ─── Canvas component ─────────────────────────────────────────────────────────

export function Canvas() {
  const activeTool = useEditorStore((s) => s.activeTool)
  const revertToSelect = useEditorStore((s) => s.revertToSelect)
  const camera = useEditorStore((s) => s.camera)
  const elements = useEditorStore((s) => s.elements)
  const isModalOpen = useEditorStore((s) => s.isModalOpen)
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
      } else if (mod && e.key === 'z' && e.shiftKey) {
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
    // Block zoom when a modal is active
    if (isModalOpen) return
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
      data-modal-open={isModalOpen ? 'true' : 'false'}
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
        {Object.values(elements).map((el) => (
          <div
            key={el.id}
            data-testid={`element-${el.id}`}
            data-element-id={el.id}
            data-element-kind={el.kind}
            data-x={el.x}
            data-y={el.y}
          >
            <ElementNode el={el} />
          </div>
        ))}
      </div>

      {/* Zoom level display */}
      <div
        data-testid="zoom-display"
        className="absolute bottom-4 right-4 text-white text-xs opacity-60 pointer-events-none select-none"
      >
        {Math.round(camera.zoom * 100)}%
      </div>
    </main>
  )
}
