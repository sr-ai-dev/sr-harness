import { useEditorStore } from '../../store'
import type { Element, FrameElement, TextElement } from '../../types'
import { COLOR_PRESETS, FONT_PRESETS, SPACING_PRESETS } from '../../data/presets'

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const sectionHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '6px 12px',
  borderBottom: '1px solid #333',
  color: '#888',
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  userSelect: 'none',
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '4px 12px',
  gap: 8,
}

const subLabelStyle: React.CSSProperties = {
  color: '#666',
  fontSize: 11,
  paddingBottom: 4,
}

const colorSwatchStyle = (color: string, disabled: boolean): React.CSSProperties => ({
  width: 24,
  height: 24,
  borderRadius: 4,
  backgroundColor: color,
  border: '1px solid #444',
  cursor: disabled ? 'not-allowed' : 'pointer',
  flexShrink: 0,
  opacity: disabled ? 0.4 : 1,
  outline: 'none',
})

const presetButtonStyle = (disabled: boolean): React.CSSProperties => ({
  background: '#2a2a2a',
  border: '1px solid #3a3a3a',
  borderRadius: 4,
  color: disabled ? '#555' : '#e0e0e0',
  fontSize: 11,
  padding: '3px 7px',
  cursor: disabled ? 'not-allowed' : 'pointer',
  whiteSpace: 'nowrap',
  flexShrink: 0,
})

const spacingButtonStyle = (disabled: boolean): React.CSSProperties => ({
  background: '#2a2a2a',
  border: '1px solid #3a3a3a',
  borderRadius: 4,
  color: disabled ? '#555' : '#e0e0e0',
  fontSize: 11,
  padding: '3px 8px',
  cursor: disabled ? 'not-allowed' : 'pointer',
  minWidth: 32,
  textAlign: 'center',
})

const disabledMessageStyle: React.CSSProperties = {
  padding: '8px 12px',
  color: '#555',
  fontSize: 11,
  fontStyle: 'italic',
}

// ─────────────────────────────────────────────────────────────────────────────
// StylePresets (main export)
// ─────────────────────────────────────────────────────────────────────────────
export function StylePresets() {
  const selectedIds = useEditorStore((s) => s.selectedIds)
  const elements = useEditorStore((s) => s.elements)
  const updateElement = useEditorStore((s) => s.updateElement)

  const selectedId = selectedIds[0] ?? null
  const element: Element | null = selectedId ? (elements[selectedId] ?? null) : null
  const disabled = element === null

  function applyColorPreset(color: string) {
    if (!selectedId || !element) return
    if (element.type === 'frame') {
      updateElement(selectedId, { backgroundColor: color } as Partial<FrameElement>)
    } else if (element.type === 'text') {
      updateElement(selectedId, { color } as Partial<TextElement>)
    }
  }

  function applyFontPreset(preset: { fontFamily: string; fontSize: number; fontWeight: number; lineHeight: number }) {
    if (!selectedId || !element) return
    if (element.type !== 'text') return
    updateElement(selectedId, {
      fontFamily: preset.fontFamily,
      fontSize: preset.fontSize,
      fontWeight: preset.fontWeight,
      lineHeight: preset.lineHeight,
    } as Partial<TextElement>)
  }

  function applySpacingPreset(value: number) {
    if (!selectedId || !element) return
    if (element.type === 'frame') {
      updateElement(selectedId, {
        gap: value,
        padding: { top: value, right: value, bottom: value, left: value },
      } as Partial<FrameElement>)
    }
  }

  return (
    <div data-testid="style-presets">
      {/* Header */}
      <div style={sectionHeaderStyle} data-testid="style-presets-header">
        <span>Style Presets</span>
      </div>

      {disabled && (
        <div style={disabledMessageStyle} data-testid="style-presets-disabled">
          Select an element to apply presets
        </div>
      )}

      {/* Color Palette */}
      <div style={{ paddingTop: 8, paddingBottom: 4 }} data-testid="style-presets-colors">
        <div style={{ ...rowStyle, ...subLabelStyle }}>Colors</div>
        <div style={{ ...rowStyle, flexWrap: 'wrap', gap: 6 }}>
          {COLOR_PRESETS.map((preset) => (
            <button
              key={preset.id}
              data-testid={`color-preset-${preset.id}`}
              title={preset.label}
              style={colorSwatchStyle(preset.value, disabled)}
              disabled={disabled}
              onClick={() => applyColorPreset(preset.value)}
              aria-label={preset.label}
            />
          ))}
        </div>
      </div>

      {/* Font Presets */}
      <div style={{ paddingTop: 4, paddingBottom: 4 }} data-testid="style-presets-fonts">
        <div style={{ ...rowStyle, ...subLabelStyle }}>Typography</div>
        <div style={{ ...rowStyle, flexWrap: 'wrap', gap: 4 }}>
          {FONT_PRESETS.map((preset) => (
            <button
              key={preset.id}
              data-testid={`font-preset-${preset.id}`}
              style={presetButtonStyle(disabled)}
              disabled={disabled}
              onClick={() => applyFontPreset(preset)}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Spacing Presets */}
      <div style={{ paddingTop: 4, paddingBottom: 8 }} data-testid="style-presets-spacing">
        <div style={{ ...rowStyle, ...subLabelStyle }}>Spacing</div>
        <div style={{ ...rowStyle, flexWrap: 'wrap', gap: 4 }}>
          {SPACING_PRESETS.map((preset) => (
            <button
              key={preset.id}
              data-testid={`spacing-preset-${preset.id}`}
              style={spacingButtonStyle(disabled)}
              disabled={disabled}
              onClick={() => applySpacingPreset(preset.value)}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default StylePresets
