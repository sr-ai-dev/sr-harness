import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useEditorStore, BREAKPOINT_WIDTHS } from '../store'
import { BreakpointSwitcher } from '../components/Toolbar/BreakpointSwitcher'
import { Canvas } from '../components/Canvas'

// Reset the store between tests
beforeEach(() => {
  useEditorStore.setState({
    elements: {},
    rootIds: [],
    selectedIds: [],
    past: [],
    future: [],
    breakpoint: 'desktop',
  })
})

describe('BreakpointSwitcher', () => {
  it('renders all three breakpoint buttons', () => {
    render(<BreakpointSwitcher />)
    expect(screen.getByTestId('breakpoint-desktop')).toBeTruthy()
    expect(screen.getByTestId('breakpoint-tablet')).toBeTruthy()
    expect(screen.getByTestId('breakpoint-mobile')).toBeTruthy()
  })

  it('defaults to desktop breakpoint (aria-pressed=true on desktop button)', () => {
    render(<BreakpointSwitcher />)
    const desktopBtn = screen.getByTestId('breakpoint-desktop')
    expect(desktopBtn.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByTestId('breakpoint-tablet').getAttribute('aria-pressed')).toBe('false')
    expect(screen.getByTestId('breakpoint-mobile').getAttribute('aria-pressed')).toBe('false')
  })

  it('updates store breakpoint when tablet button is clicked (R5-S1)', () => {
    render(<BreakpointSwitcher />)
    const tabletBtn = screen.getByTestId('breakpoint-tablet')
    fireEvent.click(tabletBtn)
    expect(useEditorStore.getState().breakpoint).toBe('tablet')
  })

  it('updates store breakpoint when mobile button is clicked (R5-S2)', () => {
    render(<BreakpointSwitcher />)
    const mobileBtn = screen.getByTestId('breakpoint-mobile')
    fireEvent.click(mobileBtn)
    expect(useEditorStore.getState().breakpoint).toBe('mobile')
  })

  it('reflects active breakpoint in aria-pressed after click', () => {
    render(<BreakpointSwitcher />)
    fireEvent.click(screen.getByTestId('breakpoint-tablet'))
    expect(screen.getByTestId('breakpoint-tablet').getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByTestId('breakpoint-desktop').getAttribute('aria-pressed')).toBe('false')
  })
})

describe('Canvas viewport — breakpoint widths', () => {
  it('renders viewport with desktop width (1440px) by default', () => {
    render(<Canvas />)
    const viewport = screen.getByTestId('canvas-viewport')
    expect(viewport.getAttribute('data-breakpoint')).toBe('desktop')
    expect(viewport.getAttribute('data-viewport-width')).toBe(String(BREAKPOINT_WIDTHS.desktop))
  })

  it('resizes viewport to 768px when breakpoint is tablet (R5-S1)', () => {
    useEditorStore.setState({ breakpoint: 'tablet' })
    render(<Canvas />)
    const viewport = screen.getByTestId('canvas-viewport')
    expect(viewport.getAttribute('data-breakpoint')).toBe('tablet')
    expect(viewport.getAttribute('data-viewport-width')).toBe('768')
  })

  it('resizes viewport to 375px on empty canvas without error (R5-S2)', () => {
    // Canvas is empty (no elements), switching to mobile should not error
    useEditorStore.setState({ breakpoint: 'mobile', elements: {}, rootIds: [] })
    render(<Canvas />)
    const viewport = screen.getByTestId('canvas-viewport')
    expect(viewport.getAttribute('data-breakpoint')).toBe('mobile')
    expect(viewport.getAttribute('data-viewport-width')).toBe('375')
  })

  it('uses exact 375px width for mobile breakpoint', () => {
    useEditorStore.setState({ breakpoint: 'mobile' })
    render(<Canvas />)
    const viewport = screen.getByTestId('canvas-viewport')
    expect(Number(viewport.getAttribute('data-viewport-width'))).toBe(375)
  })
})

describe('BREAKPOINT_WIDTHS constants', () => {
  it('has correct width values', () => {
    expect(BREAKPOINT_WIDTHS.desktop).toBe(1440)
    expect(BREAKPOINT_WIDTHS.tablet).toBe(768)
    expect(BREAKPOINT_WIDTHS.mobile).toBe(375)
  })
})

describe('Store setBreakpoint action', () => {
  it('updates breakpoint state via setBreakpoint', () => {
    const { setBreakpoint } = useEditorStore.getState()
    setBreakpoint('mobile')
    expect(useEditorStore.getState().breakpoint).toBe('mobile')
    setBreakpoint('tablet')
    expect(useEditorStore.getState().breakpoint).toBe('tablet')
    setBreakpoint('desktop')
    expect(useEditorStore.getState().breakpoint).toBe('desktop')
  })
})
