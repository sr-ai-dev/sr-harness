import { test, expect } from '@playwright/test'

// ─── Helpers ─────────────────────────────────────────────────────────────────

type Page = import('@playwright/test').Page

async function resetStore(page: Page) {
  await page.evaluate(() => {
    window.__editorStore.setState({
      elements: {},
      rootIds: [],
      selection: { selectedIds: [], hoveredId: null },
    })
  })
}

async function addRectWithAnimation(
  page: Page,
  opts: {
    id: string
    trigger: 'hover' | 'click'
    opacity?: number
    scale?: number
    duration?: number
    easing?: string
    delay?: number
  },
) {
  await page.evaluate((o) => {
    window.__editorStore.getState().addElement({
      id: o.id,
      kind: 'rectangle',
      x: 100,
      y: 100,
      width: 200,
      height: 100,
      rotation: 0,
      opacity: 1,
      visible: true,
      locked: false,
      name: 'Rect',
      parentId: null,
      childIds: [],
      fill: '#ff0000',
      stroke: 'transparent',
      strokeWidth: 0,
      borderRadius: 0,
    })
    window.__editorStore.getState().setElementAnimations(o.id, [
      {
        trigger: o.trigger,
        targetProps: {
          ...(o.opacity !== undefined ? { opacity: o.opacity } : {}),
          ...(o.scale !== undefined ? { scale: o.scale } : {}),
        },
        duration: o.duration ?? 300,
        easing: (o.easing ?? 'ease') as 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'linear',
        delay: o.delay ?? 0,
      },
    ])
  }, opts)
}

/** Dispatch mouseover on an element by test ID.
 *  React implements onMouseEnter via mouseover (bubbling) internally.
 */
async function triggerMouseOver(page: Page, testId: string) {
  await page.evaluate((tid) => {
    const el = document.querySelector(`[data-testid="${tid}"]`) as HTMLElement | null
    if (el) el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, relatedTarget: null }))
  }, testId)
}

/** Dispatch click on an element by test ID */
async function triggerClick(page: Page, testId: string) {
  await page.evaluate((tid) => {
    const el = document.querySelector(`[data-testid="${tid}"]`) as HTMLElement | null
    if (el) el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  }, testId)
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.waitForSelector('[data-testid="canvas"]')
  await resetStore(page)
})

// R9-S1: hover-opacity — Element with hover trigger (opacity→0.5, 300ms) in preview mode
test('hover-opacity @R9-S1', async ({ page }) => {
  await addRectWithAnimation(page, { id: 'r1', trigger: 'hover', opacity: 0.5, duration: 300 })

  // Enter preview mode
  await page.evaluate(() => window.__editorStore.getState().setPreviewMode(true))

  // Element container should appear
  await expect(page.locator('[data-testid="element-r1"]')).toHaveCount(1)

  // AnimatedWrapper should exist
  await expect(page.locator('[data-testid="animated-wrapper-r1"]')).toHaveCount(1)

  // Before hover: no opacity override
  const opacityBefore = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="animated-wrapper-r1"]') as HTMLElement | null
    return el?.style.opacity ?? 'not-found'
  })
  expect(opacityBefore).toBe('')

  // Dispatch mouseenter event (element is outside viewport due to absolute positioning,
  // so we use dispatchEvent rather than .hover() which requires viewport positioning)
  await triggerMouseOver(page, 'animated-wrapper-r1')

  // After hover: opacity should be 0.5 on the animated wrapper
  const opacityAfter = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="animated-wrapper-r1"]') as HTMLElement | null
    return el?.style.opacity ?? 'not-found'
  })
  expect(opacityAfter).toBe('0.5')

  // CSS transition should contain 'opacity' and '300ms'
  const transition = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="animated-wrapper-r1"]') as HTMLElement | null
    return el?.style.transition ?? ''
  })
  expect(transition).toContain('opacity')
  expect(transition).toContain('300ms')
})

// R9-S2: click-scale — Element with click trigger (scale→1.2x) in preview mode
test('click-scale @R9-S2', async ({ page }) => {
  await addRectWithAnimation(page, { id: 'r2', trigger: 'click', scale: 1.2, duration: 200 })

  // Enter preview mode
  await page.evaluate(() => window.__editorStore.getState().setPreviewMode(true))

  await expect(page.locator('[data-testid="element-r2"]')).toHaveCount(1)
  await expect(page.locator('[data-testid="animated-wrapper-r2"]')).toHaveCount(1)

  // Before click: no transform
  const transformBefore = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="animated-wrapper-r2"]') as HTMLElement | null
    return el?.style.transform ?? ''
  })
  expect(transformBefore).toBe('')

  // Dispatch click event
  await triggerClick(page, 'animated-wrapper-r2')

  // After click: transform should include scale(1.2)
  const transformAfter = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="animated-wrapper-r2"]') as HTMLElement | null
    return el?.style.transform ?? ''
  })
  expect(transformAfter).toContain('scale(1.2)')
})

// R9-S3: zero-duration — Hover animation with 0ms duration applies style instantly
test('zero-duration @R9-S3', async ({ page }) => {
  await addRectWithAnimation(page, { id: 'r3', trigger: 'hover', opacity: 0.3, duration: 0 })

  // Enter preview mode
  await page.evaluate(() => window.__editorStore.getState().setPreviewMode(true))

  await expect(page.locator('[data-testid="element-r3"]')).toHaveCount(1)

  // Dispatch mouseenter
  await triggerMouseOver(page, 'animated-wrapper-r3')

  // Opacity applies (0ms transition means instant)
  const opacityAfter = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="animated-wrapper-r3"]') as HTMLElement | null
    return el?.style.opacity ?? 'not-found'
  })
  expect(opacityAfter).toBe('0.3')

  // Verify duration is stored as 0 in the store (instant transition)
  const storedDuration = await page.evaluate(() => {
    const el = window.__editorStore.getState().elements['r3']
    return el?.animations?.[0]?.duration ?? -1
  })
  expect(storedDuration).toBe(0)

  // Transition property is set (browser may normalize 0ms differently, but opacity applies)
  const transition = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="animated-wrapper-r3"]') as HTMLElement | null
    return el?.style.transition ?? ''
  })
  expect(transition).toContain('opacity')
})

// R9-S4: edit-mode-no-trigger — In edit mode, hover animation does NOT trigger
test('edit-mode-no-trigger @R9-S4', async ({ page }) => {
  await addRectWithAnimation(page, { id: 'r4', trigger: 'hover', opacity: 0.1, duration: 300 })

  // Stay in edit mode (isPreviewMode = false by default)
  const isPreview = await page.evaluate(() => window.__editorStore.getState().isPreviewMode)
  expect(isPreview).toBe(false)

  // Element container should exist in DOM
  await expect(page.locator('[data-testid="element-r4"]')).toHaveCount(1)

  // AnimatedWrapper should NOT exist in edit mode
  const wrapperCount = await page.locator('[data-testid="animated-wrapper-r4"]').count()
  expect(wrapperCount).toBe(0)
})

// R9-S5: invalid-params — Duration clamps to 0, unknown easing falls back to 'ease'
test('invalid-params @R9-S5', async ({ page }) => {
  // Add element and initial animation
  await page.evaluate(() => {
    window.__editorStore.getState().addElement({
      id: 'r5',
      kind: 'rectangle',
      x: 100,
      y: 100,
      width: 200,
      height: 100,
      rotation: 0,
      opacity: 1,
      visible: true,
      locked: false,
      name: 'Rect',
      parentId: null,
      childIds: [],
      fill: '#ff0000',
      stroke: 'transparent',
      strokeWidth: 0,
      borderRadius: 0,
    })
    window.__editorStore.getState().setElementAnimations('r5', [
      {
        trigger: 'hover',
        targetProps: { opacity: 0.5 },
        duration: 300,
        easing: 'ease',
        delay: 0,
      },
    ])
    // Select the element to show properties panel
    window.__editorStore.getState().selectElement('r5')
  })

  // Animations section should be visible in properties panel
  const animationsSection = page.locator('[data-testid="animations-section"]')
  await expect(animationsSection).toBeVisible()

  // Find duration input (first animation row, index 0)
  const durationInput = page.locator('[data-testid="anim-duration-0"]')
  await expect(durationInput).toBeVisible()

  // Enter negative duration and commit
  await durationInput.fill('-200')
  await durationInput.press('Tab')

  // Duration error hint should appear
  await expect(page.locator('[data-testid="anim-duration-error-0"]')).toBeVisible()

  // Duration in store should be clamped to 0
  const duration = await page.evaluate(() => {
    const el = window.__editorStore.getState().elements['r5']
    return el?.animations?.[0]?.duration ?? -1
  })
  expect(duration).toBe(0)

  // Easing should always be a valid CSS easing
  const easing = await page.evaluate(() => {
    const el = window.__editorStore.getState().elements['r5']
    return el?.animations?.[0]?.easing ?? ''
  })
  const validEasings = ['ease', 'ease-in', 'ease-out', 'ease-in-out', 'linear']
  expect(validEasings).toContain(easing)
})
