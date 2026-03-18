import { useEffect, useRef, useCallback } from 'react'
import { useEditorStore } from '../../store/editorStore'
import type {
  EditorElement,
  FrameElement,
  TextElement,
  ImageElement,
  RectangleElement,
  EllipseElement,
} from '../../types'
import { screenToCanvas } from '../../store/editorStore'

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

// ─── ID generator ─────────────────────────────────────────────────────────────

function generateId(): string {
  return `el-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
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
  const addElement = useEditorStore((s) => s.addElement)

  const isPanning = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })

  // Drag state for shape creation
  const isDragging = useRef(false)
  const dragStart = useRef<{ x: number; y: number } | null>(null)

  // Hidden file input for image tool
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Ref to canvas element for bounding box calculations
  const canvasRef = useRef<HTMLElement>(null)

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

  const getCanvasRect = useCallback((): DOMRect | null => {
    return canvasRef.current?.getBoundingClientRect() ?? null
  }, [])

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

  const handleMouseDown = (e: React.MouseEvent<HTMLElement>) => {
    lastPos.current = { x: e.clientX, y: e.clientY }

    if (isPanning.current) return

    const dragTools = ['frame', 'rectangle', 'ellipse']
    if (dragTools.includes(activeTool)) {
      const rect = getCanvasRect()
      if (!rect) return
      const screenX = e.clientX - rect.left
      const screenY = e.clientY - rect.top
      const canvasPos = screenToCanvas(screenX, screenY, camera)
      isDragging.current = true
      dragStart.current = canvasPos
      e.stopPropagation()
    }
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    if (isPanning.current && e.buttons === 1) {
      pan(e.clientX - lastPos.current.x, e.clientY - lastPos.current.y)
      lastPos.current = { x: e.clientX, y: e.clientY }
    }
  }

  const handleMouseUp = (e: React.MouseEvent<HTMLElement>) => {
    if (!isDragging.current || dragStart.current === null) return

    isDragging.current = false
    const start = dragStart.current
    dragStart.current = null

    const rect = getCanvasRect()
    if (!rect) return

    const screenX = e.clientX - rect.left
    const screenY = e.clientY - rect.top
    const endPos = screenToCanvas(screenX, screenY, camera)

    const rawWidth = endPos.x - start.x
    const rawHeight = endPos.y - start.y

    // Normalize: top-left corner + absolute dimensions
    const x = rawWidth >= 0 ? start.x : endPos.x
    const y = rawHeight >= 0 ? start.y : endPos.y
    const width = Math.max(1, Math.abs(rawWidth))
    const height = Math.max(1, Math.abs(rawHeight))

    const id = generateId()
    const base = {
      id,
      x,
      y,
      width,
      height,
      rotation: 0,
      opacity: 1,
      visible: true,
      locked: false,
      parentId: null,
      childIds: [],
    }

    if (activeTool === 'frame') {
      const el: FrameElement = {
        ...base,
        kind: 'frame',
        name: 'Frame',
        fill: '#ffffff',
        borderRadius: 0,
        clipContent: false,
      }
      addElement(el)
    } else if (activeTool === 'rectangle') {
      const el: RectangleElement = {
        ...base,
        kind: 'rectangle',
        name: 'Rectangle',
        fill: '#d1d5db',
        stroke: '#000000',
        strokeWidth: 0,
        borderRadius: 0,
      }
      addElement(el)
    } else if (activeTool === 'ellipse') {
      const el: EllipseElement = {
        ...base,
        kind: 'ellipse',
        name: 'Ellipse',
        fill: '#d1d5db',
        stroke: '#000000',
        strokeWidth: 0,
      }
      addElement(el)
    }

    revertToSelect()
  }

  const handleClick = (e: React.MouseEvent<HTMLElement>) => {
    // Drag tools are handled on mouseup; skip here to avoid double-handling
    const dragTools = ['frame', 'rectangle', 'ellipse']
    if (dragTools.includes(activeTool)) return

    if (activeTool === 'text') {
      const rect = getCanvasRect()
      if (!rect) return
      const screenX = e.clientX - rect.left
      const screenY = e.clientY - rect.top
      const canvasPos = screenToCanvas(screenX, screenY, camera)

      const el: TextElement = {
        id: generateId(),
        kind: 'text',
        name: 'Text',
        x: canvasPos.x,
        y: canvasPos.y,
        width: 200,
        height: 40,
        rotation: 0,
        opacity: 1,
        visible: true,
        locked: false,
        parentId: null,
        childIds: [],
        content: 'Type something...',
        fontSize: 16,
        fontFamily: 'Inter, sans-serif',
        fontWeight: 400,
        color: '#000000',
        textAlign: 'left',
        lineHeight: 1.5,
      }
      addElement(el)
      revertToSelect()
    } else if (activeTool === 'image') {
      // Open file picker
      fileInputRef.current?.click()
    } else {
      // select tool or others
      revertToSelect()
    }
  }

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) {
      // User cancelled — no-op, just revert tool
      revertToSelect()
      // Reset input value so the same file can be picked again
      e.target.value = ''
      return
    }

    const reader = new FileReader()
    reader.onload = (ev) => {
      const src = ev.target?.result as string
      if (!src) {
        revertToSelect()
        return
      }

      // Place image in center of visible canvas area
      const rect = getCanvasRect()
      const centerScreenX = rect ? rect.width / 2 : 400
      const centerScreenY = rect ? rect.height / 2 : 300
      const canvasPos = screenToCanvas(centerScreenX, centerScreenY, camera)

      const el: ImageElement = {
        id: generateId(),
        kind: 'image',
        name: 'Image',
        x: canvasPos.x - 100,
        y: canvasPos.y - 75,
        width: 200,
        height: 150,
        rotation: 0,
        opacity: 1,
        visible: true,
        locked: false,
        parentId: null,
        childIds: [],
        src,
        objectFit: 'cover',
      }
      addElement(el)
      revertToSelect()
    }
    reader.readAsDataURL(file)

    // Reset input value
    e.target.value = ''
  }

  const transformStyle = `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`

  return (
    <main
      ref={canvasRef as React.RefObject<HTMLElement>}
      data-testid="canvas"
      data-modal-open={isModalOpen ? 'true' : 'false'}
      onClick={handleClick}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      className="flex-1 h-full relative overflow-hidden bg-[#111111]"
      style={{ cursor: activeTool === 'select' ? 'default' : 'crosshair' }}
    >
      {/* Hidden file input for image tool */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        data-testid="image-file-input"
        style={{ display: 'none' }}
        onChange={handleImageFileChange}
      />

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
