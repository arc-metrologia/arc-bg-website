import { createElement, useState, type ElementType, type ReactNode } from 'react'
import { useEdit } from './edit-context'
import Img from './Img'
import type { Media } from '../types'

interface TextProps {
  as?: ElementType
  value: string
  onChange(v: string): void
  placeholder?: string
  className?: string
  multiline?: boolean
}

/** Текст, който в режим на редакция се редактира директно на страницата. */
export function Text({ as = 'span', value, onChange, placeholder, className, multiline }: TextProps) {
  const { editing } = useEdit()
  if (!editing) return value ? createElement(as, { className }, value) : null
  return createElement(as, {
    className: `${className ?? ''} ed-text`.trim(),
    contentEditable: 'plaintext-only',
    suppressContentEditableWarning: true,
    'data-placeholder': placeholder,
    spellCheck: true,
    onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => {
      if (e.key === 'Enter' && !multiline) {
        e.preventDefault()
        e.currentTarget.blur()
      }
    },
    onBlur: (e: React.FocusEvent<HTMLElement>) => {
      const v = e.currentTarget.innerText.replace(/ /g, ' ').trim()
      if (v !== value) onChange(v)
    },
    children: value,
  })
}

/** Форматиран текст (заглавия, списъци, таблици, връзки). HTML-ът е почистен от сървъра. */
export function Rich({ html, onChange }: { html: string; onChange(html: string): void }) {
  const { editing, RichEditor } = useEdit()
  if (editing) return <RichEditor html={html} onChange={onChange} />
  return <div className="prose" dangerouslySetInnerHTML={{ __html: html }} />
}

interface ImageSlotProps {
  media: Media | undefined
  onPick(m: Media): void
  sizes?: string
  eager?: boolean
  label?: string
  children?: ReactNode
}

export function ImageSlot({ media, onPick, sizes, eager, label = 'Изберете изображение', children }: ImageSlotProps) {
  const { editing, pickMedia } = useEdit()
  const img = <Img media={media} sizes={sizes} eager={eager} />
  if (!editing) return media ? (children ?? img) : null
  return (
    <div className="ed-slot">
      {media ? (children ?? img) : <div className="ed-slot-empty">{label}</div>}
      <button type="button" className="ed-chip"         onClick={async () => {
          const [m] = await pickMedia('image')
          if (m) onPick(m)
        }}
      >
        {media ? 'Смени изображението' : label}
      </button>
    </div>
  )
}

/** Бутони за подреждане/изтриване на елемент от списък — видими само при редакция. */
export function ItemTools<T>({ list, index, onChange }: { list: T[]; index: number; onChange(list: T[]): void }) {
  const { editing } = useEdit()
  if (!editing) return null
  const move = (d: number) => {
    const next = [...list]
    const [x] = next.splice(index, 1)
    next.splice(index + d, 0, x)
    onChange(next)
  }
  return (
    <span className="ed-item-tools">
      {index > 0 && (
        <button type="button" onClick={() => move(-1)} aria-label="Премести нагоре">
          ↑
        </button>
      )}
      {index < list.length - 1 && (
        <button type="button" onClick={() => move(1)} aria-label="Премести надолу">
          ↓
        </button>
      )}
      <button type="button" onClick={() => onChange(list.filter((_, i) => i !== index))} aria-label="Премахни">
        ✕
      </button>
    </span>
  )
}

export function AddItem({ onClick, label }: { onClick(): void; label: string }) {
  const { editing } = useEdit()
  if (!editing) return null
  return (
    <button type="button" className="ed-add-item" onClick={onClick}>
      + {label}
    </button>
  )
}

/**
 * Ъглова дръжка за размер на снимка. measure() превръща позицията на мишката в процент
 * (връща null, ако размерът не важи, напр. на телефон).
 */
export function ScaleHandle({ value, min = 20, max = 100, measure, onChange }: {
  value: number
  min?: number
  max?: number
  measure(x: number, handle: HTMLElement): number | null
  onChange(v: number): void
}) {
  const [drag, setDrag] = useState(false)
  const clamp = (v: number) => Math.max(min, Math.min(max, Math.round(v / 5) * 5))
  return (
    <span
      className={`ed-scale${drag ? ' on' : ''}`}
      role="slider"
      tabIndex={0}
      aria-label="Размер на снимката"
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      title="Влачете, за да смените размера на снимката"
      onPointerDown={(e) => {
        e.preventDefault()
        e.currentTarget.setPointerCapture(e.pointerId)
        setDrag(true)
      }}
      onPointerMove={(e) => {
        if (!drag) return
        const raw = measure(e.clientX, e.currentTarget)
        if (raw === null) return
        const v = clamp(raw)
        if (v !== value) onChange(v)
      }}
      onPointerUp={() => setDrag(false)}
      onKeyDown={(e) => {
        const d = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 5 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -5 : 0
        if (!d) return
        e.preventDefault()
        onChange(clamp(value + d))
      }}
    >
      {drag && <b>{value}%</b>}
    </span>
  )
}
