// ─────────────────────────────────────────────────────────────────────────────
// Style Presets — design tokens for color palette, font, and spacing
// ─────────────────────────────────────────────────────────────────────────────

// ── Color Palette ────────────────────────────────────────────────────────────

export interface ColorPreset {
  id: string
  label: string
  value: string
}

export const COLOR_PRESETS: ColorPreset[] = [
  { id: 'primary-blue', label: 'Primary Blue', value: '#0a84ff' },
  { id: 'secondary-purple', label: 'Secondary Purple', value: '#bf5af2' },
  { id: 'success-green', label: 'Success Green', value: '#30d158' },
  { id: 'warning-orange', label: 'Warning Orange', value: '#ff9f0a' },
  { id: 'danger-red', label: 'Danger Red', value: '#ff453a' },
  { id: 'neutral-dark', label: 'Neutral Dark', value: '#1c1c1e' },
  { id: 'neutral-light', label: 'Neutral Light', value: '#f2f2f7' },
  { id: 'white', label: 'White', value: '#ffffff' },
]

// ── Font Presets ──────────────────────────────────────────────────────────────

export interface FontPreset {
  id: string
  label: string
  fontFamily: string
  fontSize: number
  fontWeight: number
  lineHeight: number
}

export const FONT_PRESETS: FontPreset[] = [
  {
    id: 'heading-large',
    label: 'Heading L',
    fontFamily: 'Inter, sans-serif',
    fontSize: 40,
    fontWeight: 700,
    lineHeight: 1.2,
  },
  {
    id: 'heading-medium',
    label: 'Heading M',
    fontFamily: 'Inter, sans-serif',
    fontSize: 28,
    fontWeight: 600,
    lineHeight: 1.3,
  },
  {
    id: 'heading-small',
    label: 'Heading S',
    fontFamily: 'Inter, sans-serif',
    fontSize: 20,
    fontWeight: 600,
    lineHeight: 1.4,
  },
  {
    id: 'body-large',
    label: 'Body L',
    fontFamily: 'Inter, sans-serif',
    fontSize: 16,
    fontWeight: 400,
    lineHeight: 1.6,
  },
  {
    id: 'body-medium',
    label: 'Body M',
    fontFamily: 'Inter, sans-serif',
    fontSize: 14,
    fontWeight: 400,
    lineHeight: 1.5,
  },
  {
    id: 'body-small',
    label: 'Body S',
    fontFamily: 'Inter, sans-serif',
    fontSize: 12,
    fontWeight: 400,
    lineHeight: 1.4,
  },
]

// ── Spacing Presets ───────────────────────────────────────────────────────────

export interface SpacingPreset {
  id: string
  label: string
  value: number
}

export const SPACING_PRESETS: SpacingPreset[] = [
  { id: 'spacing-4', label: '4', value: 4 },
  { id: 'spacing-8', label: '8', value: 8 },
  { id: 'spacing-12', label: '12', value: 12 },
  { id: 'spacing-16', label: '16', value: 16 },
  { id: 'spacing-24', label: '24', value: 24 },
  { id: 'spacing-32', label: '32', value: 32 },
]
