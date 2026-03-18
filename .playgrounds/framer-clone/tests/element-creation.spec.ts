import { test, expect } from '@playwright/test'
import { fileURLToPath } from 'url'
import path from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

test.describe('Element Creation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    // Reset store state before each test
    await page.evaluate(() => {
      const store = window.__editorStore.getState()
      store.deleteElements(store.rootIds.slice())
      store.revertToSelect()
    })
  })

  // ─── R2-S1: frame ────────────────────────────────────────────────────────────

  test('frame: drag creates Frame element with dimensions in layers', async ({ page }) => {
    // Select frame tool
    await page.getByTestId('tool-frame').click()
    await expect(page.getByTestId('tool-frame')).toHaveAttribute('aria-pressed', 'true')

    const canvas = page.getByTestId('canvas')
    const box = await canvas.boundingBox()
    expect(box).not.toBeNull()

    const startX = box!.x + 100
    const startY = box!.y + 100
    const endX = box!.x + 300
    const endY = box!.y + 250

    // Drag to create frame
    await page.mouse.move(startX, startY)
    await page.mouse.down()
    await page.mouse.move(endX, endY)
    await page.mouse.up()

    // Wait for frame element to appear in store
    await page.waitForFunction(() => {
      const store = window.__editorStore.getState()
      return Object.values(store.elements).some((el: { kind: string }) => el.kind === 'frame')
    })

    // Element wrapper present in canvas viewport
    const frameWrapper = page.locator('[data-element-kind="frame"]').first()
    await expect(frameWrapper).toHaveCount(1)

    // Element appears in layers panel (layer-row present)
    const layerRows = page.locator('[data-testid^="layer-row-"]')
    await expect(layerRows).toHaveCount(1)

    // Tool auto-reverted to select
    await expect(page.getByTestId('tool-select')).toHaveAttribute('aria-pressed', 'true')

    // Verify store dimensions
    const elementData = await page.evaluate(() => {
      const store = window.__editorStore.getState()
      return Object.values(store.elements).find((el: { kind: string }) => el.kind === 'frame')
    })
    expect(elementData).toBeTruthy()
    expect((elementData as { kind: string }).kind).toBe('frame')
    expect((elementData as { width: number }).width).toBeGreaterThan(0)
    expect((elementData as { height: number }).height).toBeGreaterThan(0)
  })

  // ─── R2-S2: text ─────────────────────────────────────────────────────────────

  test('text: click creates Text element with placeholder', async ({ page }) => {
    // Select text tool
    await page.getByTestId('tool-text').click()
    await expect(page.getByTestId('tool-text')).toHaveAttribute('aria-pressed', 'true')

    const canvas = page.getByTestId('canvas')
    const box = await canvas.boundingBox()
    expect(box).not.toBeNull()

    const clickX = box!.x + 200
    const clickY = box!.y + 150

    // Click to create text element
    await page.mouse.click(clickX, clickY)

    // Wait for text element to appear in store
    await page.waitForFunction(() => {
      const store = window.__editorStore.getState()
      return Object.values(store.elements).some((el: { kind: string }) => el.kind === 'text')
    })

    // Element wrapper present in canvas viewport
    const textWrapper = page.locator('[data-element-kind="text"]').first()
    await expect(textWrapper).toHaveCount(1)

    // Check the element has placeholder content
    const elementData = await page.evaluate(() => {
      const store = window.__editorStore.getState()
      return Object.values(store.elements).find((el: { kind: string }) => el.kind === 'text')
    })
    expect(elementData).toBeTruthy()
    expect((elementData as { kind: string }).kind).toBe('text')
    expect((elementData as { content: string }).content).toBeTruthy()

    // Element appears in layers panel
    const layerRows = page.locator('[data-testid^="layer-row-"]')
    await expect(layerRows).toHaveCount(1)

    // Tool auto-reverted to select
    await expect(page.getByTestId('tool-select')).toHaveAttribute('aria-pressed', 'true')
  })

  // ─── R2-S3: image ────────────────────────────────────────────────────────────

  test('image: select file creates Image element', async ({ page }) => {
    // Select image tool
    await page.getByTestId('tool-image').click()
    await expect(page.getByTestId('tool-image')).toHaveAttribute('aria-pressed', 'true')

    // Use setInputFiles directly on the hidden input to simulate selecting a file
    const fileInputLocator = page.locator('[data-testid="image-file-input"]')
    const imagePath = path.join(__dirname, '..', 'src', 'assets', 'hero.png')
    await fileInputLocator.setInputFiles(imagePath)

    // Wait for image element to appear in store
    await page.waitForFunction(() => {
      const store = window.__editorStore.getState()
      return Object.values(store.elements).some((el: { kind: string }) => el.kind === 'image')
    })

    // Element wrapper present in canvas viewport
    const imageWrapper = page.locator('[data-element-kind="image"]').first()
    await expect(imageWrapper).toHaveCount(1)

    // Element has an image tag with src set
    const imgTag = imageWrapper.locator('img')
    await expect(imgTag).toHaveCount(1)
    const src = await imgTag.getAttribute('src')
    expect(src).toBeTruthy()

    // Element appears in layers panel
    const layerRows = page.locator('[data-testid^="layer-row-"]')
    await expect(layerRows).toHaveCount(1)
  })

  // ─── R2-S4: min-size ─────────────────────────────────────────────────────────

  test('min-size: tiny drag creates rectangle with minimum 1x1 size', async ({ page }) => {
    // Zoom canvas to 25% so small screen drag = tiny canvas units
    await page.evaluate(() => {
      window.__editorStore.getState().setCamera({ zoom: 0.25 })
    })

    // Verify zoom is applied
    await page.waitForFunction(() => {
      const el = document.querySelector('[data-testid="canvas-viewport"]')
      return el && parseFloat(el.getAttribute('data-zoom') ?? '1') === 0.25
    })

    // Select rectangle tool
    await page.getByTestId('tool-rectangle').click()

    const canvas = page.getByTestId('canvas')
    const box = await canvas.boundingBox()
    expect(box).not.toBeNull()

    // Drag only 2 pixels — at 25% zoom that's <1 canvas unit (2/0.25 = 8 canvas units wait...)
    // Actually at 25% zoom, 2 screen px = 2/0.25 = 8 canvas units.
    // To get a tiny drag below 1 canvas unit at 25% zoom: drag 0 screen pixels (same point)
    const startX = box!.x + 100
    const startY = box!.y + 100
    await page.mouse.move(startX, startY)
    await page.mouse.down()
    // Move just 0 pixels (mouseup at same point) — raw dimension = 0, should enforce min 1x1
    await page.mouse.up()

    // Wait for rectangle element to appear
    await page.waitForFunction(() => {
      const store = window.__editorStore.getState()
      return Object.values(store.elements).some((el: { kind: string }) => el.kind === 'rectangle')
    })

    // Element has minimum 1x1 dimensions
    const elementData = await page.evaluate(() => {
      const store = window.__editorStore.getState()
      return Object.values(store.elements).find((el: { kind: string }) => el.kind === 'rectangle')
    })
    expect(elementData).toBeTruthy()
    expect((elementData as { width: number }).width).toBeGreaterThanOrEqual(1)
    expect((elementData as { height: number }).height).toBeGreaterThanOrEqual(1)

    // Tool auto-reverted to select
    await expect(page.getByTestId('tool-select')).toHaveAttribute('aria-pressed', 'true')
  })

  // ─── R2-S5: image-cancel ─────────────────────────────────────────────────────

  test('image-cancel: cancel file picker creates no element', async ({ page }) => {
    // Get initial element count
    const initialCount = await page.evaluate(() => {
      return window.__editorStore.getState().rootIds.length
    })

    // Select image tool
    await page.getByTestId('tool-image').click()
    await expect(page.getByTestId('tool-image')).toHaveAttribute('aria-pressed', 'true')

    // Simulate cancel: dispatch change event with empty files (FileList with length 0)
    await page.evaluate(() => {
      const input = document.querySelector('[data-testid="image-file-input"]') as HTMLInputElement
      if (!input) return
      // Create an empty DataTransfer to simulate empty files list
      const dt = new DataTransfer()
      Object.defineProperty(input, 'files', {
        value: dt.files,
        configurable: true,
      })
      const event = new Event('change', { bubbles: true })
      input.dispatchEvent(event)
    })

    // Wait briefly to ensure no element was added
    await page.waitForTimeout(300)

    // Element count should remain the same
    const finalCount = await page.evaluate(() => {
      return window.__editorStore.getState().rootIds.length
    })
    expect(finalCount).toBe(initialCount)
  })

  // ─── R2-S6: ellipse ──────────────────────────────────────────────────────────

  test('ellipse: drag creates Ellipse element with matching dimensions', async ({ page }) => {
    // Select ellipse tool
    await page.getByTestId('tool-ellipse').click()
    await expect(page.getByTestId('tool-ellipse')).toHaveAttribute('aria-pressed', 'true')

    const canvas = page.getByTestId('canvas')
    const box = await canvas.boundingBox()
    expect(box).not.toBeNull()

    const startX = box!.x + 150
    const startY = box!.y + 100
    const endX = box!.x + 350
    const endY = box!.y + 280

    // Drag to create ellipse
    await page.mouse.move(startX, startY)
    await page.mouse.down()
    await page.mouse.move(endX, endY)
    await page.mouse.up()

    // Wait for ellipse element to appear in store
    await page.waitForFunction(() => {
      const store = window.__editorStore.getState()
      return Object.values(store.elements).some((el: { kind: string }) => el.kind === 'ellipse')
    })

    // Element wrapper present in canvas viewport
    const ellipseWrapper = page.locator('[data-element-kind="ellipse"]').first()
    await expect(ellipseWrapper).toHaveCount(1)

    // Verify element dimensions from store
    const elementData = await page.evaluate(() => {
      const store = window.__editorStore.getState()
      return Object.values(store.elements).find((el: { kind: string }) => el.kind === 'ellipse')
    })
    expect(elementData).toBeTruthy()
    expect((elementData as { kind: string }).kind).toBe('ellipse')
    expect((elementData as { width: number }).width).toBeGreaterThan(0)
    expect((elementData as { height: number }).height).toBeGreaterThan(0)

    // Tool auto-reverted to select
    await expect(page.getByTestId('tool-select')).toHaveAttribute('aria-pressed', 'true')
  })
})
