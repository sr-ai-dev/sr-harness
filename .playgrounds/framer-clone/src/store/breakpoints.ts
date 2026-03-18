// ─── Breakpoint Types ─────────────────────────────────────────────────────────

export type BreakpointId = 'desktop' | 'tablet' | 'mobile'

export interface Breakpoint {
  id: BreakpointId
  label: string
  width: number
}

export const DEFAULT_BREAKPOINTS: Record<BreakpointId, Breakpoint> = {
  desktop: { id: 'desktop', label: 'Desktop', width: 1440 },
  tablet: { id: 'tablet', label: 'Tablet', width: 768 },
  mobile: { id: 'mobile', label: 'Mobile', width: 375 },
}

/**
 * Per-breakpoint overrides: map of elementId → partial element properties.
 * Only non-desktop breakpoints store overrides (delta from base desktop styles).
 * Mobile inherits from desktop base only — never from tablet overrides.
 */
export type BreakpointOverrides = Record<string, Record<string, unknown>>

/**
 * Resolve effective element properties for a given breakpoint.
 * - desktop: returns base element unchanged
 * - tablet/mobile: merges base with that breakpoint's overrides (if any)
 * - mobile does NOT inherit from tablet overrides
 */
export function resolveElementForBreakpoint<T extends Record<string, unknown>>(
  baseElement: T,
  breakpointId: BreakpointId,
  overrides: Record<BreakpointId, BreakpointOverrides>,
): T {
  if (breakpointId === 'desktop') return baseElement
  const elementId = baseElement.id as string
  const bpOverrides = overrides[breakpointId]?.[elementId]
  if (!bpOverrides) return baseElement
  return { ...baseElement, ...bpOverrides }
}

/**
 * Validate a breakpoint width value.
 * Returns an error message string if invalid, or null if valid.
 */
export function validateBreakpointWidth(value: string | number): string | null {
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num) || !isFinite(num)) {
    return 'Width must be a valid number'
  }
  if (num <= 0) {
    return 'Width must be greater than 0'
  }
  if (num > 10000) {
    return 'Width must be 10000 or less'
  }
  return null
}
