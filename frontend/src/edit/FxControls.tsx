import { useEffect, useRef, useState } from 'react'
import type { ImageFx } from '../types'

const EFFECTS = [
  { value: undefined, label: 'Без' },
  { value: 'glow', label: 'Сияние', color: 'var(--amber)' },
  { value: 'shadow', label: 'Сянка', color: '#000000' },
  { value: 'outline', label: 'Контур', color: '#ffffff' },
] as const

const COLORS = [
  { value: 'var(--amber)', label: 'Акцентен' },
  { value: 'var(--petrol-soft)', label: 'Светъл основен' },
  { value: 'var(--petrol)', label: 'Основен' },
  { value: '#ffffff', label: 'Бял' },
  { value: '#000000', label: 'Черен' },
]

/** Бутон „✦ Ефект“ в лентата на секцията: сияние, сянка или контур около снимката. */
export default function FxControls({ fx, onChange }: { fx: ImageFx; onChange(fx: ImageFx): void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const set = (patch: ImageFx) => onChange({ ...fx, ...patch })
  const size = fx.effectSize ?? 24
  return (
    <div className="ed-fx" ref={ref}>
      <button type="button" className={fx.effect ? 'on' : undefined} aria-expanded={open} onClick={() => setOpen(!open)} title="Сияние, сянка или контур около снимката">
        ✦ Ефект
      </button>
      {open && (
        <div className="ed-fx-pop" role="dialog" aria-label="Ефект върху снимката">
          <div className="ed-fx-row" role="group" aria-label="Вид">
            {EFFECTS.map((e) => (
              <button
                key={e.label}
                type="button"
                className={fx.effect === e.value ? 'on' : undefined}
                aria-pressed={fx.effect === e.value}
                onClick={() =>
                  e.value
                    ? set({ effect: e.value, effectColor: fx.effectColor ?? e.color, effectSize: size })
                    : onChange({ effect: undefined, effectColor: undefined, effectSize: undefined })
                }
              >
                {e.label}
              </button>
            ))}
          </div>
          {fx.effect && (
            <>
              <div className="ed-fx-row" role="group" aria-label="Цвят">
                {COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    className={`ed-swatch${fx.effectColor === c.value ? ' on' : ''}`}
                    style={{ background: c.value }}
                    title={c.label}
                    aria-label={`Цвят: ${c.label}`}
                    aria-pressed={fx.effectColor === c.value}
                    onClick={() => set({ effectColor: c.value })}
                  />
                ))}
                <label className="ed-swatch custom" title="Друг цвят">
                  <input
                    type="color"
                    aria-label="Друг цвят"
                    value={/^#[0-9a-f]{6}$/i.test(fx.effectColor ?? '') ? fx.effectColor : '#f0b323'}
                    onChange={(e) => set({ effectColor: e.target.value.toLowerCase() })}
                  />
                </label>
              </div>
              <label className="ed-fx-size">
                Сила: {size}px
                <input type="range" min={2} max={80} value={size} onChange={(e) => set({ effectSize: +e.target.value })} />
              </label>
            </>
          )}
        </div>
      )}
    </div>
  )
}
