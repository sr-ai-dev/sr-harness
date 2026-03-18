import { useState } from 'react'
import { useEditorStore } from '../../store/editorStore'
import type { EditorElement } from '../../types/editor'
import {
  type ElementAnimation,
  type AnimationTrigger,
  type AnimationEasing,
  VALID_EASINGS,
} from '../../types/editor'

// ─── Validation helpers ───────────────────────────────────────────────────────

/** Clamp duration to >= 0 */
function clampDuration(val: number): number {
  return Math.max(0, val)
}

/** Fall back unknown easing to 'ease' */
function sanitizeEasing(val: string): AnimationEasing {
  if ((VALID_EASINGS as string[]).includes(val)) return val as AnimationEasing
  return 'ease'
}

// ─── AnimationRow ─────────────────────────────────────────────────────────────

interface AnimationRowProps {
  anim: ElementAnimation
  index: number
  onChange: (index: number, updated: ElementAnimation) => void
  onRemove: (index: number) => void
}

function AnimationRow({ anim, index, onChange, onRemove }: AnimationRowProps) {
  // local validation state for hints
  const [durationError, setDurationError] = useState<string | null>(null)
  const [easingError, setEasingError] = useState<string | null>(null)

  const handleTriggerChange = (trigger: AnimationTrigger) => {
    onChange(index, { ...anim, trigger })
  }

  const handleDurationChange = (raw: string) => {
    const n = parseFloat(raw)
    if (isNaN(n)) return
    const clamped = clampDuration(n)
    if (n < 0) {
      setDurationError('Duration clamped to 0')
    } else {
      setDurationError(null)
    }
    onChange(index, { ...anim, duration: clamped })
  }

  const handleEasingChange = (raw: string) => {
    const sanitized = sanitizeEasing(raw)
    if (raw !== sanitized) {
      setEasingError(`Unknown easing "${raw}" — falling back to "ease"`)
    } else {
      setEasingError(null)
    }
    onChange(index, { ...anim, easing: sanitized })
  }

  const handleDelayChange = (raw: string) => {
    const n = parseFloat(raw)
    if (!isNaN(n)) onChange(index, { ...anim, delay: Math.max(0, n) })
  }

  const handleOpacityChange = (raw: string) => {
    const n = parseFloat(raw)
    if (!isNaN(n)) {
      onChange(index, {
        ...anim,
        targetProps: { ...anim.targetProps, opacity: Math.min(1, Math.max(0, n)) },
      })
    }
  }

  const handleScaleChange = (raw: string) => {
    const n = parseFloat(raw)
    if (!isNaN(n)) {
      onChange(index, { ...anim, targetProps: { ...anim.targetProps, scale: n } })
    }
  }

  return (
    <div
      data-testid={`animation-row-${index}`}
      className="mb-3 p-2 bg-[#1a1a1a] rounded border border-[#3a3a3a]"
    >
      {/* Trigger selector */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] text-[#9ca3af] w-16 shrink-0">Trigger</span>
        <select
          data-testid={`anim-trigger-${index}`}
          value={anim.trigger}
          onChange={(e) => handleTriggerChange(e.target.value as AnimationTrigger)}
          className="flex-1 bg-[#2a2a2a] text-xs text-white outline-none rounded px-2 py-1"
        >
          <option value="hover">hover</option>
          <option value="click">click</option>
        </select>
        <button
          data-testid={`anim-remove-${index}`}
          onClick={() => onRemove(index)}
          className="text-[#6b7280] hover:text-[#ef4444] text-xs"
          aria-label="Remove animation"
        >
          ×
        </button>
      </div>

      {/* Duration */}
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[10px] text-[#9ca3af] w-16 shrink-0">Duration</span>
        <input
          type="number"
          data-testid={`anim-duration-${index}`}
          value={anim.duration}
          min={0}
          onChange={(e) => handleDurationChange(e.target.value)}
          className="flex-1 bg-[#2a2a2a] text-xs text-white outline-none rounded px-2 py-1"
        />
        <span className="text-[10px] text-[#9ca3af]">ms</span>
      </div>
      {durationError && (
        <div data-testid={`anim-duration-error-${index}`} className="text-[10px] text-[#f59e0b] mb-1 ml-[72px]">
          {durationError}
        </div>
      )}

      {/* Easing */}
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[10px] text-[#9ca3af] w-16 shrink-0">Easing</span>
        <select
          data-testid={`anim-easing-${index}`}
          value={anim.easing}
          onChange={(e) => handleEasingChange(e.target.value)}
          className="flex-1 bg-[#2a2a2a] text-xs text-white outline-none rounded px-2 py-1"
        >
          {VALID_EASINGS.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
      </div>
      {easingError && (
        <div data-testid={`anim-easing-error-${index}`} className="text-[10px] text-[#f59e0b] mb-1 ml-[72px]">
          {easingError}
        </div>
      )}

      {/* Delay */}
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[10px] text-[#9ca3af] w-16 shrink-0">Delay</span>
        <input
          type="number"
          data-testid={`anim-delay-${index}`}
          value={anim.delay}
          min={0}
          onChange={(e) => handleDelayChange(e.target.value)}
          className="flex-1 bg-[#2a2a2a] text-xs text-white outline-none rounded px-2 py-1"
        />
        <span className="text-[10px] text-[#9ca3af]">ms</span>
      </div>

      {/* Target: Opacity */}
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[10px] text-[#9ca3af] w-16 shrink-0">Opacity</span>
        <input
          type="number"
          data-testid={`anim-opacity-${index}`}
          value={anim.targetProps.opacity ?? ''}
          min={0}
          max={1}
          step={0.1}
          placeholder="—"
          onChange={(e) => handleOpacityChange(e.target.value)}
          className="flex-1 bg-[#2a2a2a] text-xs text-white outline-none rounded px-2 py-1 placeholder-[#4b5563]"
        />
      </div>

      {/* Target: Scale */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-[#9ca3af] w-16 shrink-0">Scale</span>
        <input
          type="number"
          data-testid={`anim-scale-${index}`}
          value={anim.targetProps.scale ?? ''}
          min={0}
          step={0.1}
          placeholder="—"
          onChange={(e) => handleScaleChange(e.target.value)}
          className="flex-1 bg-[#2a2a2a] text-xs text-white outline-none rounded px-2 py-1 placeholder-[#4b5563]"
        />
        <span className="text-[10px] text-[#9ca3af]">×</span>
      </div>
    </div>
  )
}

// ─── AnimationsSection ────────────────────────────────────────────────────────

interface AnimationsSectionProps {
  el: EditorElement
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-[#3a3a3a] pb-3 mb-3">
      <div className="text-[10px] font-semibold text-[#6b7280] uppercase tracking-wider mb-2">
        {title}
      </div>
      {children}
    </div>
  )
}

export function AnimationsSection({ el }: AnimationsSectionProps) {
  const setElementAnimations = useEditorStore((s) => s.setElementAnimations)
  const animations: ElementAnimation[] = el.animations ?? []

  const handleChange = (index: number, updated: ElementAnimation) => {
    const next = animations.map((a, i) => (i === index ? updated : a))
    setElementAnimations(el.id, next)
  }

  const handleRemove = (index: number) => {
    const next = animations.filter((_, i) => i !== index)
    setElementAnimations(el.id, next)
  }

  const handleAdd = () => {
    const newAnim: ElementAnimation = {
      trigger: 'hover',
      targetProps: { opacity: 0.5 },
      duration: 300,
      easing: 'ease',
      delay: 0,
    }
    setElementAnimations(el.id, [...animations, newAnim])
  }

  return (
    <Section title="Animations">
      <div data-testid="animations-section">
        {animations.map((anim, i) => (
          <AnimationRow
            key={i}
            anim={anim}
            index={i}
            onChange={handleChange}
            onRemove={handleRemove}
          />
        ))}
        <button
          data-testid="add-animation-btn"
          onClick={handleAdd}
          className="w-full text-xs text-[#0099ff] bg-[#1a2a3a] hover:bg-[#1a3a4a] rounded px-2 py-1 mt-1"
        >
          + Add Animation
        </button>
      </div>
    </Section>
  )
}
