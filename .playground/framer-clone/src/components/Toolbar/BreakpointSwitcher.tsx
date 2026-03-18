import { useEditorStore, BREAKPOINT_WIDTHS } from '../../store'
import type { Breakpoint } from '../../store'

const BREAKPOINTS: { id: Breakpoint; label: string; icon: string; width: number }[] = [
  { id: 'desktop', label: 'Desktop', icon: '🖥', width: BREAKPOINT_WIDTHS.desktop },
  { id: 'tablet', label: 'Tablet', icon: '⬜', width: BREAKPOINT_WIDTHS.tablet },
  { id: 'mobile', label: 'Mobile', icon: '📱', width: BREAKPOINT_WIDTHS.mobile },
]

export function BreakpointSwitcher() {
  const { breakpoint, setBreakpoint } = useEditorStore()

  return (
    <div
      data-testid="breakpoint-switcher"
      style={{ display: 'flex', alignItems: 'center', gap: 2 }}
    >
      {BREAKPOINTS.map((bp) => {
        const isActive = breakpoint === bp.id
        return (
          <button
            key={bp.id}
            data-testid={`breakpoint-${bp.id}`}
            onClick={() => setBreakpoint(bp.id)}
            title={`${bp.label} (${bp.width}px)`}
            aria-label={`${bp.label} ${bp.width}px`}
            aria-pressed={isActive}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '0 8px',
              height: 28,
              background: isActive ? '#0a84ff22' : 'transparent',
              border: isActive ? '1px solid #0a84ff66' : '1px solid transparent',
              borderRadius: 4,
              color: isActive ? '#0a84ff' : '#888',
              cursor: 'pointer',
              fontSize: 11,
              fontWeight: isActive ? 600 : 400,
              transition: 'background 0.1s, color 0.1s',
              whiteSpace: 'nowrap',
            }}
          >
            <span style={{ fontSize: 13 }}>{bp.icon}</span>
            <span>{bp.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export default BreakpointSwitcher
