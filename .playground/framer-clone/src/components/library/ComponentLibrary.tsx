import type { DragEvent } from 'react'
import { CATEGORIES, COMPONENT_TYPES, getComponentsByCategory } from './componentTypes'
import type { ComponentType } from './componentTypes'
import { useEditorStore } from '../../store'
import type { CustomComponent } from '../../store'

// Key used for dataTransfer to pass component id from library to canvas
export const DRAG_DATA_KEY = 'application/x-component-id'

interface ComponentCardProps {
  component: ComponentType
  onDragStart?: (e: DragEvent<HTMLDivElement>, component: ComponentType) => void
}

function ComponentCard({ component, onDragStart }: ComponentCardProps) {
  const handleDragStart = (e: DragEvent<HTMLDivElement>) => {
    // Set the component id in dataTransfer so the canvas drop handler can read it
    if (e.dataTransfer) {
      e.dataTransfer.setData(DRAG_DATA_KEY, component.id)
      e.dataTransfer.setData('text/plain', component.id)
      e.dataTransfer.effectAllowed = 'copy'
    }
    onDragStart?.(e, component)
  }

  return (
    <div
      className="component-card"
      draggable
      onDragStart={handleDragStart}
      data-component-id={component.id}
      data-component-name={component.name}
      data-component-category={component.category}
      title={component.name}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 8px',
        marginBottom: 2,
        borderRadius: 4,
        cursor: 'grab',
        userSelect: 'none',
        fontSize: 12,
        color: '#e0e0e0',
        background: 'transparent',
      }}
    >
      <span className="component-icon" style={{ color: '#888', fontSize: 10, width: 14, textAlign: 'center', flexShrink: 0 }}>
        {component.icon}
      </span>
      <span className="component-name">{component.name}</span>
    </div>
  )
}

interface CustomComponentCardProps {
  customComponent: CustomComponent
}

function CustomComponentCard({ customComponent }: CustomComponentCardProps) {
  const handleDragStart = (e: DragEvent<HTMLDivElement>) => {
    if (e.dataTransfer) {
      e.dataTransfer.setData(DRAG_DATA_KEY, `custom:${customComponent.id}`)
      e.dataTransfer.setData('text/plain', `custom:${customComponent.id}`)
      e.dataTransfer.effectAllowed = 'copy'
    }
  }

  return (
    <div
      className="component-card"
      draggable
      onDragStart={handleDragStart}
      data-component-id={customComponent.id}
      data-component-name={customComponent.name}
      data-component-category="Custom"
      title={customComponent.name}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 8px',
        marginBottom: 2,
        borderRadius: 4,
        cursor: 'grab',
        userSelect: 'none',
        fontSize: 12,
        color: '#e0e0e0',
        background: 'transparent',
      }}
    >
      <span className="component-icon" style={{ color: '#888', fontSize: 10, width: 14, textAlign: 'center', flexShrink: 0 }}>
        ◈
      </span>
      <span className="component-name">{customComponent.name}</span>
    </div>
  )
}

interface ComponentLibraryProps {
  onDragStart?: (e: DragEvent<HTMLDivElement>, component: ComponentType) => void
}

export function ComponentLibrary({ onDragStart }: ComponentLibraryProps) {
  const customComponents = useEditorStore((s) => s.customComponents)

  return (
    <div
      className="component-library"
      data-testid="component-library"
      style={{ padding: '8px 0' }}
    >
      {CATEGORIES.map((category) => (
        <div
          key={category}
          className="component-category"
          data-testid={`category-${category.toLowerCase()}`}
          style={{ marginBottom: 8 }}
        >
          <h3
            className="category-title"
            style={{
              margin: 0,
              padding: '4px 8px 4px',
              fontSize: 10,
              fontWeight: 600,
              color: '#888',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            {category}
          </h3>
          <div className="category-components">
            {getComponentsByCategory(category).map((component) => (
              <ComponentCard
                key={component.id}
                component={component}
                onDragStart={onDragStart}
              />
            ))}
          </div>
        </div>
      ))}

      {/* Custom components category — shown only when custom components exist */}
      {customComponents.length > 0 && (
        <div
          className="component-category"
          data-testid="category-custom"
          style={{ marginBottom: 8 }}
        >
          <h3
            className="category-title"
            style={{
              margin: 0,
              padding: '4px 8px 4px',
              fontSize: 10,
              fontWeight: 600,
              color: '#888',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Custom
          </h3>
          <div className="category-components">
            {customComponents.map((cc) => (
              <CustomComponentCard key={cc.id} customComponent={cc} />
            ))}
          </div>
        </div>
      )}

      <div data-testid="total-components" style={{ display: 'none' }}>
        {COMPONENT_TYPES.length}
      </div>
    </div>
  )
}

export default ComponentLibrary
