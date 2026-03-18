interface RightPanelProps {
  selectedElement?: string | null
}

export function RightPanel({ selectedElement }: RightPanelProps) {
  return (
    <div
      data-testid="right-panel"
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        color: '#e0e0e0',
        fontSize: 12,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '8px 12px',
          borderBottom: '1px solid #333',
          color: '#888',
          fontSize: 11,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        Properties
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
        {selectedElement ? (
          <div data-testid="properties-content">
            <p style={{ color: '#888', margin: 0 }}>Element: {selectedElement}</p>
          </div>
        ) : (
          <p
            data-testid="properties-empty"
            style={{ color: '#555', margin: 0 }}
          >
            Select an element to edit its properties
          </p>
        )}
      </div>
    </div>
  )
}

export default RightPanel
