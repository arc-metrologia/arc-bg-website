import { useLayoutEffect, useRef, useState } from 'react'
import type { BoxAlign } from '../types'

interface Props {
  width?: number
  align?: BoxAlign
  onChange(patch: { width?: number; align?: BoxAlign }): void
}

const clamp = (v: number) => Math.max(20, Math.min(100, Math.round(v / 5) * 5))

/**
 * Дръжка по ръба на съдържанието на секцията: влаченето сменя ширината (20–100 %, през 5 %).
 * Мери секцията в своя .ed-frame, затова стои вътре в рамката на блока.
 */
export default function BoxResize({ width, align = 'left', onChange }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ x: number; top: number; height: number } | null>(null)
  const [drag, setDrag] = useState(false)

  // Зоната на съдържанието в .wrap (без страничните отстъпи).
  const area = () => {
    const wrap = ref.current?.parentElement?.querySelector<HTMLElement>(':scope > section > .wrap')
    if (!wrap) return null
    const r = wrap.getBoundingClientRect()
    const cs = getComputedStyle(wrap)
    const left = r.left + parseFloat(cs.paddingLeft)
    const right = r.right - parseFloat(cs.paddingRight)
    return { wrap, left, right, top: r.top, height: r.height }
  }

  useLayoutEffect(() => {
    const measure = () => {
      const a = area()
      const frame = ref.current?.parentElement
      if (!a || !frame) return
      // Ръбът на съдържанието = най-десният (или най-левият при „вдясно“) край на децата на .wrap.
      const kids = [...a.wrap.children].map((c) => c.getBoundingClientRect()).filter((r) => r.width > 0)
      if (!kids.length) return
      const edge = align === 'right' ? Math.min(...kids.map((r) => r.left)) : Math.max(...kids.map((r) => r.right))
      const f = frame.getBoundingClientRect()
      setPos({ x: edge - f.left, top: a.top - f.top, height: a.height })
    }
    measure()
    const ro = new ResizeObserver(measure)
    const a = area()
    if (a) ro.observe(a.wrap)
    addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      removeEventListener('resize', measure)
    }
  }, [width, align])

  function move(e: React.PointerEvent) {
    const a = area()
    if (!a) return
    const full = a.right - a.left
    const pct =
      align === 'right' ? ((a.right - e.clientX) / full) * 100 : align === 'center' ? ((2 * Math.abs(e.clientX - (a.left + full / 2))) / full) * 100 : ((e.clientX - a.left) / full) * 100
    const next = clamp(pct)
    if (next !== width) onChange({ width: next, align })
  }

  return (
    <div ref={ref} className="ed-box-layer" aria-hidden={!pos}>
      {pos && (
        <div
          className={`ed-box-handle${drag ? ' on' : ''}`}
          style={{ left: pos.x, top: pos.top, height: pos.height }}
          role="slider"
          tabIndex={0}
          aria-label="Ширина на секцията"
          aria-valuemin={20}
          aria-valuemax={100}
          aria-valuenow={width ?? 100}
          title="Влачете, за да смените ширината"
          onPointerDown={(e) => {
            e.preventDefault()
            e.currentTarget.setPointerCapture(e.pointerId)
            setDrag(true)
          }}
          onPointerMove={(e) => drag && move(e)}
          onPointerUp={() => setDrag(false)}
          onKeyDown={(e) => {
            const d = e.key === 'ArrowRight' ? 5 : e.key === 'ArrowLeft' ? -5 : 0
            if (!d) return
            e.preventDefault()
            onChange({ width: clamp((width ?? 100) + (align === 'right' ? -d : d)), align })
          }}
        >
          {drag && <span>{width ?? 100}%</span>}
        </div>
      )}
    </div>
  )
}
