import { useEffect, useState } from 'react'
import { api } from '../api'
import type { PageType } from '../types'
import { TYPE_LABELS } from './blockDefs'

interface Row {
  id: number
  type: PageType
  title: string
  url: string
  status: string
}

/** Ръчен подбор на страници за слайдера: търсене, добавяне, подреждане. */
export default function CarouselPages({ lang, pages, onChange }: { lang: string; pages: number[]; onChange(p: number[]): void }) {
  const [all, setAll] = useState<Row[]>([])
  const [q, setQ] = useState('')
  useEffect(() => {
    api<Row[]>(`admin/pages?lang=${lang}`).then(setAll)
  }, [lang])
  const byId = new Map(all.map((r) => [r.id, r]))
  const suggestions = all.filter((r) => !pages.includes(r.id) && r.status === 'published' && r.title.toLowerCase().includes(q.toLowerCase())).slice(0, 8)
  const move = (i: number, d: number) => {
    const next = [...pages]
    const [x] = next.splice(i, 1)
    next.splice(i + d, 0, x)
    onChange(next)
  }
  return (
    <div className="ed-carousel-pages">
      <strong>Страници в слайдера</strong>
      <ol>
        {pages.map((id, i) => (
          <li key={id}>
            <span>
              {byId.get(id)?.title ?? `#${id}`} <small>{byId.get(id) && TYPE_LABELS[byId.get(id)!.type]}</small>
            </span>
            <span className="ed-item-tools">
              <button type="button" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Нагоре">
                ↑
              </button>
              <button type="button" disabled={i === pages.length - 1} onClick={() => move(i, 1)} aria-label="Надолу">
                ↓
              </button>
              <button type="button" onClick={() => onChange(pages.filter((x) => x !== id))} aria-label="Премахни">
                ✕
              </button>
            </span>
          </li>
        ))}
      </ol>
      <input type="search" placeholder="Търсете продукт или новина за добавяне…" value={q} onChange={(e) => setQ(e.target.value)} />
      {q && (
        <ul className="ed-suggest">
          {suggestions.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => {
                  onChange([...pages, r.id])
                  setQ('')
                }}
              >
                {r.title} <small>{TYPE_LABELS[r.type]} · {r.url}</small>
              </button>
            </li>
          ))}
          {!suggestions.length && <li className="ed-hint">Няма публикувани страници с това заглавие.</li>}
        </ul>
      )}
      <p className="ed-hint">Промените в списъка се виждат в слайдера след „Запазете“.</p>
    </div>
  )
}
