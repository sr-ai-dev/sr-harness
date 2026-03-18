import { test, expect } from '@playwright/test'
import type { TextElement } from '../src/types/editor'

// Helper: get store state via window.__editorStore
async function getStore(page: import('@playwright/test').Page) {
  return page.evaluate(() => window.__editorStore.getState())
}

// Helper: seed a text element with a given font size
async function seedTextElement(
  page: import('@playwright/test').Page,
  opts: { id: string; fontSize: number },
) {
  await page.evaluate(({ id, fontSize }: { id: string; fontSize: number }) => {
    const el: TextElement = {
      id,
      kind: 'text',
      name: 'Test Text',
      x: 100,
      y: 100,
      width: 200,
      height: 40,
      rotation: 0,
      opacity: 1,
      visible: true,
      locked: false,
      parentId: null,
      childIds: [],
      content: 'Hello',
      fontSize,
      fontFamily: 'Inter, sans-serif',
      fontWeight: 400,
      color: '#000000',
      textAlign: 'left',
      lineHeight: 1.5,
    }
    window.__editorStore.getState().addElement(el)
  }, opts)
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  // Reset to clean state
  await page.evaluate(() => {
    window.__editorStore.setState({
      elements: {},
      rootIds: [],
      selection: { selectedIds: [], hoveredId: null },
      activeBreakpoint: 'desktop',
      breakpointWidths: { desktop: 1440, tablet: 768, mobile: 375 },
      breakpointOverrides: { desktop: {}, tablet: {}, mobile: {} },
      breakpointWidthError: null,
    })
  })
})

// ─── R6-S1: switch-tablet ─────────────────────────────────────────────────────
// Given: Desktop breakpoint active
// When: User switches to Tablet
// Then: Viewport resizes to 768px, tablet overrides applied

test('switch-tablet: switching to tablet resizes viewport to 768px', async ({ page }) => {
  // Verify initial state is desktop
  const initialState = await getStore(page)
  expect(initialState.activeBreakpoint).toBe('desktop')

  // Switch to tablet via breakpoint button
  await page.getByTestId('breakpoint-tablet').click()

  // Verify store state updated
  const state = await getStore(page)
  expect(state.activeBreakpoint).toBe('tablet')
  expect(state.breakpointWidths.tablet).toBe(768)

  // Verify breakpoint container has correct width
  const container = page.getByTestId('breakpoint-container')
  await expect(container).toHaveAttribute('data-breakpoint', 'tablet')
  await expect(container).toHaveAttribute('data-breakpoint-width', '768')
})

// ─── R6-S2: override-isolation ────────────────────────────────────────────────
// Given: Mobile breakpoint, Text has no mobile override
// When: User changes font size to 14px (via store action)
// Then: Override stored under mobile only, desktop unchanged

test('override-isolation: mobile override does not affect desktop base', async ({ page }) => {
  const EL_ID = 'test-text-1'
  await seedTextElement(page, { id: EL_ID, fontSize: 16 })

  // Switch to mobile
  await page.evaluate(() => window.__editorStore.getState().setActiveBreakpoint('mobile'))

  // Set breakpoint override for fontSize in mobile
  await page.evaluate(
    ({ id, size }: { id: string; size: number }) => {
      window.__editorStore.getState().setBreakpointOverride(id, { fontSize: size })
    },
    { id: EL_ID, size: 14 },
  )

  // Verify: mobile override exists with 14px
  const state = await getStore(page)
  const mobileOverride = state.breakpointOverrides.mobile[EL_ID]
  expect(mobileOverride).toBeDefined()
  expect(mobileOverride.fontSize).toBe(14)

  // Verify: desktop base element still has original fontSize 16
  const desktopEl = state.elements[EL_ID] as TextElement
  expect(desktopEl.fontSize).toBe(16)

  // Verify: tablet has no override for this element
  expect(state.breakpointOverrides.tablet[EL_ID]).toBeUndefined()
})

// ─── R6-S3: inheritance ───────────────────────────────────────────────────────
// Given: Element has tablet override but no mobile override
// When: User switches to mobile
// Then: Element inherits from desktop (base), not tablet

test('inheritance: mobile inherits from desktop base, not from tablet override', async ({
  page,
}) => {
  const EL_ID = 'test-text-2'
  await seedTextElement(page, { id: EL_ID, fontSize: 20 })

  // Set tablet override to 12px
  await page.evaluate(
    ({ id, size }: { id: string; size: number }) => {
      window.__editorStore.getState().setActiveBreakpoint('tablet')
      window.__editorStore.getState().setBreakpointOverride(id, { fontSize: size })
    },
    { id: EL_ID, size: 12 },
  )

  // Switch to mobile (no mobile override exists for this element)
  await page.evaluate(() => window.__editorStore.getState().setActiveBreakpoint('mobile'))

  const state = await getStore(page)

  // Mobile has no override for this element
  expect(state.breakpointOverrides.mobile[EL_ID]).toBeUndefined()

  // Tablet override exists
  expect(state.breakpointOverrides.tablet[EL_ID]).toBeDefined()
  expect(state.breakpointOverrides.tablet[EL_ID].fontSize).toBe(12)

  // Desktop base element is still 20
  const baseEl = state.elements[EL_ID] as TextElement
  expect(baseEl.fontSize).toBe(20)

  // The resolved element on mobile should reflect desktop base (20), NOT tablet (12)
  const resolvedFontSize = await page.evaluate(
    ({ id }: { id: string }) => {
      const s = window.__editorStore.getState()
      // activeBreakpoint is 'mobile'; no mobile override → should fall back to base
      const bp = s.activeBreakpoint
      const bpOverrides = s.breakpointOverrides[bp]?.[id]
      const base = s.elements[id] as import('../src/types/editor').TextElement
      return bpOverrides?.fontSize ?? base.fontSize
    },
    { id: EL_ID },
  )
  // Should be 20 (desktop base), NOT 12 (tablet override)
  expect(resolvedFontSize).toBe(20)
})

// ─── R6-S4: round-trip ────────────────────────────────────────────────────────
// Given: Tablet breakpoint, property modified
// When: User switches to desktop
// Then: Desktop unchanged, tablet override preserved

test('round-trip: switching back to desktop preserves desktop value and tablet override', async ({
  page,
}) => {
  const EL_ID = 'test-text-3'
  await seedTextElement(page, { id: EL_ID, fontSize: 18 })

  // Switch to tablet and set override
  await page.evaluate(
    ({ id, size }: { id: string; size: number }) => {
      window.__editorStore.getState().setActiveBreakpoint('tablet')
      window.__editorStore.getState().setBreakpointOverride(id, { fontSize: size })
    },
    { id: EL_ID, size: 10 },
  )

  // Verify tablet override set
  let state = await getStore(page)
  expect(state.breakpointOverrides.tablet[EL_ID]?.fontSize).toBe(10)
  expect((state.elements[EL_ID] as TextElement).fontSize).toBe(18)

  // Switch back to desktop
  await page.evaluate(() => window.__editorStore.getState().setActiveBreakpoint('desktop'))

  state = await getStore(page)

  // Desktop base still unchanged (18)
  expect((state.elements[EL_ID] as TextElement).fontSize).toBe(18)

  // Tablet override still preserved (10)
  expect(state.breakpointOverrides.tablet[EL_ID]?.fontSize).toBe(10)

  // Active breakpoint is desktop
  expect(state.activeBreakpoint).toBe('desktop')
})

// ─── R6-S5: invalid-width ─────────────────────────────────────────────────────
// Given: Breakpoint width input focused
// When: User enters -100 or 'abc'
// Then: Value rejected, breakpoint unchanged, validation error shown

test('invalid-width: invalid breakpoint width is rejected with error', async ({ page }) => {
  // Switch to tablet so the width input is visible
  await page.getByTestId('breakpoint-tablet').click()

  const widthInput = page.getByTestId('breakpoint-width-tablet')
  await expect(widthInput).toBeVisible()

  // Try entering a negative number (-100) via store action (bypasses input type=number restriction)
  await page.evaluate(() => {
    window.__editorStore.getState().setBreakpointWidth('tablet', -100)
  })

  // Verify breakpoint width unchanged (still 768) — negative rejected
  const stateAfterNegative = await getStore(page)
  expect(stateAfterNegative.breakpointWidths.tablet).toBe(768)

  // Verify error set in store
  expect(stateAfterNegative.breakpointWidthError).toBeTruthy()

  // Verify error shown in UI
  const errorEl = page.getByTestId('breakpoint-width-error')
  await expect(errorEl).toBeVisible()

  // Try entering 'abc' (non-numeric — NaN after parseFloat) via store action
  await page.evaluate(() => {
    window.__editorStore.getState().setBreakpointWidth('tablet', 'abc')
  })

  const stateAfterAbc = await getStore(page)
  // Width still 768
  expect(stateAfterAbc.breakpointWidths.tablet).toBe(768)
  // Error still set
  expect(stateAfterAbc.breakpointWidthError).toBeTruthy()
})
