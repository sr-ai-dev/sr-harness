/**
 * style-presets.test.tsx
 *
 * Tests for R15: StylePresets component.
 * Covers:
 *   R15-S1: Frame selected → color preset applies to backgroundColor
 *   R15-S2: Text selected → font preset applies fontFamily/size/weight/lineHeight
 *   R15-S3: Font preset only overrides preset fields, preserves other styles
 *   R15-S4: No selection → presets visible but disabled
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useEditorStore } from '../store'
import { StylePresets } from '../components/RightPanel/StylePresets'
import { COLOR_PRESETS, FONT_PRESETS } from '../data/presets'
import type { FrameElement, TextElement } from '../types'

// ─────────────────────────────────────────────────────────────────────────────
// Test factories
// ─────────────────────────────────────────────────────────────────────────────
function makeFrame(id: string, overrides: Partial<FrameElement> = {}): FrameElement {
  return {
    id,
    type: 'frame',
    x: 100,
    y: 100,
    width: 200,
    height: 150,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    name: `Frame ${id}`,
    parentId: null,
    children: [],
    zIndex: 0,
    backgroundColor: '#ffffff',
    borderRadius: 0,
    borderWidth: 0,
    borderColor: '#000000',
    overflow: 'visible',
    layoutMode: 'none',
    gap: 0,
    padding: { top: 0, right: 0, bottom: 0, left: 0 },
    ...overrides,
  }
}

function makeText(id: string, overrides: Partial<TextElement> = {}): TextElement {
  return {
    id,
    type: 'text',
    x: 50,
    y: 50,
    width: 120,
    height: 32,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    name: `Text ${id}`,
    parentId: null,
    children: [],
    zIndex: 0,
    content: 'Hello',
    fontSize: 16,
    fontFamily: 'Inter, sans-serif',
    fontWeight: 400,
    fontStyle: 'normal',
    textAlign: 'left',
    color: '#e0e0e0',
    lineHeight: 1.5,
    letterSpacing: 0,
    textDecoration: 'none',
    ...overrides,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Reset store before each test
// ─────────────────────────────────────────────────────────────────────────────
beforeEach(() => {
  useEditorStore.setState({
    elements: {},
    rootIds: [],
    selectedIds: [],
    past: [],
    future: [],
    breakpoint: 'desktop',
    customComponents: [],
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('StylePresets', () => {
  // R15-S4: No selection — presets visible but disabled
  it('R15-S4: shows disabled state and message when no element is selected', () => {
    render(<StylePresets />)

    // Panel is rendered
    expect(screen.getByTestId('style-presets')).toBeTruthy()

    // Disabled message shown
    expect(screen.getByTestId('style-presets-disabled')).toBeTruthy()

    // All color swatches are disabled
    const primaryBlue = screen.getByTestId(`color-preset-${COLOR_PRESETS[0].id}`)
    expect(primaryBlue).toBeDisabled()

    // All font preset buttons are disabled
    const headingL = screen.getByTestId(`font-preset-${FONT_PRESETS[0].id}`)
    expect(headingL).toBeDisabled()

    // All spacing preset buttons are disabled
    const spacing4 = screen.getByTestId('spacing-preset-spacing-4')
    expect(spacing4).toBeDisabled()
  })

  // R15-S1: Frame selected → color preset updates backgroundColor
  it('R15-S1: applying color preset to a Frame updates backgroundColor', () => {
    const frame = makeFrame('f1', { backgroundColor: '#ffffff' })
    useEditorStore.setState({
      elements: { f1: frame },
      rootIds: ['f1'],
      selectedIds: ['f1'],
    })

    render(<StylePresets />)

    // Presets should be enabled
    const primaryBluePreset = COLOR_PRESETS.find((p) => p.id === 'primary-blue')!
    const swatchBtn = screen.getByTestId(`color-preset-${primaryBluePreset.id}`)
    expect(swatchBtn).not.toBeDisabled()

    fireEvent.click(swatchBtn)

    // Store should have updated backgroundColor
    const updated = useEditorStore.getState().elements['f1'] as FrameElement
    expect(updated.backgroundColor).toBe(primaryBluePreset.value)
  })

  // R15-S2: Text selected → font preset applies fontFamily/size/weight/lineHeight
  it('R15-S2: applying font preset to a Text element updates typography fields', () => {
    const text = makeText('t1', {
      fontSize: 14,
      fontFamily: 'Arial',
      fontWeight: 400,
      lineHeight: 1.5,
    })
    useEditorStore.setState({
      elements: { t1: text },
      rootIds: ['t1'],
      selectedIds: ['t1'],
    })

    render(<StylePresets />)

    const headingLPreset = FONT_PRESETS.find((p) => p.id === 'heading-large')!
    const presetBtn = screen.getByTestId(`font-preset-${headingLPreset.id}`)
    expect(presetBtn).not.toBeDisabled()

    fireEvent.click(presetBtn)

    const updated = useEditorStore.getState().elements['t1'] as TextElement
    expect(updated.fontFamily).toBe(headingLPreset.fontFamily)
    expect(updated.fontSize).toBe(headingLPreset.fontSize)
    expect(updated.fontWeight).toBe(headingLPreset.fontWeight)
    expect(updated.lineHeight).toBe(headingLPreset.lineHeight)
  })

  // R15-S3: Font preset only overrides preset fields, preserves other styles
  it('R15-S3: applying font preset preserves non-preset fields (color, textAlign, etc.)', () => {
    const text = makeText('t1', {
      fontSize: 14,
      fontFamily: 'Arial',
      fontWeight: 400,
      lineHeight: 1.5,
      color: '#ff0000',
      textAlign: 'center',
      letterSpacing: 2,
      textDecoration: 'underline',
    })
    useEditorStore.setState({
      elements: { t1: text },
      rootIds: ['t1'],
      selectedIds: ['t1'],
    })

    render(<StylePresets />)

    const bodyMPreset = FONT_PRESETS.find((p) => p.id === 'body-medium')!
    fireEvent.click(screen.getByTestId(`font-preset-${bodyMPreset.id}`))

    const updated = useEditorStore.getState().elements['t1'] as TextElement
    // Preset fields updated
    expect(updated.fontSize).toBe(bodyMPreset.fontSize)
    expect(updated.fontFamily).toBe(bodyMPreset.fontFamily)
    expect(updated.fontWeight).toBe(bodyMPreset.fontWeight)
    expect(updated.lineHeight).toBe(bodyMPreset.lineHeight)

    // Non-preset fields preserved
    expect(updated.color).toBe('#ff0000')
    expect(updated.textAlign).toBe('center')
    expect(updated.letterSpacing).toBe(2)
    expect(updated.textDecoration).toBe('underline')
  })

  // Additional: color presets are visible (rendered) even when disabled
  it('renders all color presets as buttons regardless of selection state', () => {
    render(<StylePresets />)
    for (const preset of COLOR_PRESETS) {
      expect(screen.getByTestId(`color-preset-${preset.id}`)).toBeTruthy()
    }
  })

  // Additional: font presets are all rendered
  it('renders all font presets as buttons regardless of selection state', () => {
    render(<StylePresets />)
    for (const preset of FONT_PRESETS) {
      expect(screen.getByTestId(`font-preset-${preset.id}`)).toBeTruthy()
    }
  })
})
