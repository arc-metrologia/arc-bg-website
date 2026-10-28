import { useEffect, useRef, useState } from 'react'
import { api, upload } from '../api'
import type { Media } from '../types'

const ACCEPT: Record<string, string> = {
  image: 'image/jpeg,image/png,image/webp,image/gif',
  video: 'video/mp4,video/webm',
  file: 'application/pdf',
  all: 'image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,application/pdf',
}

const KIND_LABEL = { image: 'Снимки', video: 'Видео', file: 'PDF' }

interface Props {
  kind?: Media['kind']
  multiple?: boolean
  onSelect?(items: Media[]): void
  canDelete?: boolean
}

/** Медийна библиотека: качване (вкл. drag & drop), alt текстове, избор. Използва се в редактора и в админ панела. */
export default function MediaLibrary({ kind, multiple, onSelect, canDelete }: Props) {
  const [items, setItems] = useState<Media[]>([])
  const [filter, setFilter] = useState<Media['kind'] | ''>(kind ?? '')
  const [selected, setSelected] = useState<number[]>([])
  const [active, setActive] = useState<Media | null>(null)
  const [queue, setQueue] = useState<{ name: string; pct: number; error?: string }[]>([])
  const [query, setQuery] = useState('')
  const [drag, setDrag] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    api<Media[]>(`admin/media${filter ? `?kind=${filter}` : ''}`).then(setItems)
  }, [filter])

  async function send(files: FileList | File[]) {
    const list = Array.from(files)
    setQueue(list.map((f) => ({ name: f.name, pct: 0 })))
    for (const [i, f] of list.entries()) {
      try {
        const m = await upload<Media>(f, (pct) => setQueue((q) => q.map((x, j) => (j === i ? { ...x, pct } : x))))
        setItems((prev) => [m, ...prev])
        setQueue((q) => q.map((x, j) => (j === i ? { ...x, pct: 100 } : x)))
        if (list.length === 1) setActive(m)
        if (onSelect) setSelected((s) => (multiple ? [...s, m.id] : [m.id]))
      } catch (e) {
        setQueue((q) => q.map((x, j) => (j === i ? { ...x, error: (e as Error).message } : x)))
      }
    }
  }

  async function saveMeta(m: Media) {
    const saved = await api<Media>(`admin/media/${m.id}`, { method: 'PUT', body: { altBg: m.altBg, altEn: m.altEn, title: m.title } })
    setItems((prev) => prev.map((x) => (x.id === saved.id ? saved : x)))
    setActive(saved)
  }

  async function remove(m: Media) {
    if (!confirm(`Да изтрия ли „${m.title || m.name}“? Страниците, които го използват, ще останат без него.`)) return
    await api(`admin/media/${m.id}`, { method: 'DELETE' })
    setItems((prev) => prev.filter((x) => x.id !== m.id))
    setActive(null)
  }

  const shown = items.filter((m) => !query || `${m.title} ${m.name} ${m.altBg}`.toLowerCase().includes(query.toLowerCase()))
  const missingAlt = items.filter((m) => m.kind === 'image' && !m.altBg).length

  return (
    <div
      className={`ml${drag ? ' drag' : ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        setDrag(true)
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDrag(false)
        if (e.dataTransfer.files.length) send(e.dataTransfer.files)
      }}
    >
      <div className="ml-bar">
        <button type="button" className="adm-btn primary" onClick={() => input.current?.click()}>
          Качете файлове
        </button>
        <input ref={input} type="file" hidden multiple accept={ACCEPT[kind ?? 'all']} onChange={(e) => e.target.files && send(e.target.files)} />
        <span className="ml-drop-hint">или ги пуснете тук. Снимките се оптимизират автоматично.</span>
        {!kind && (
          <select value={filter} onChange={(e) => setFilter(e.target.value as Media['kind'])} aria-label="Тип">
            <option value="">Всички</option>
            {Object.entries(KIND_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        )}
        <input type="search" placeholder="Търсене" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      {missingAlt > 0 && <p className="ml-warn">{missingAlt} снимки нямат алтернативен текст. Той описва снимката за незрящи потребители, Google и AI асистентите.</p>}
      {queue.length > 0 && (
        <ul className="ml-queue">
          {queue.map((q, i) => (
            <li key={i} className={q.error ? 'err' : undefined}>
              {q.name} — {q.error ?? (q.pct < 100 ? `${q.pct}%` : 'готово')}
            </li>
          ))}
        </ul>
      )}
      <div className="ml-body">
        <ul className="ml-grid">
          {shown.map((m) => (
            <li key={m.id} className={`${selected.includes(m.id) ? 'sel' : ''} ${active?.id === m.id ? 'act' : ''}`}>
              <button
                type="button"
                onClick={() => {
                  setActive(m)
                  if (onSelect) setSelected((s) => (multiple ? (s.includes(m.id) ? s.filter((x) => x !== m.id) : [...s, m.id]) : [m.id]))
                }}
                onDoubleClick={() => onSelect && !multiple && onSelect([m])}
              >
                {m.kind === 'image' ? <img src={m.variants[0]?.url ?? m.url} alt="" loading="lazy" /> : <span className="ml-file">{m.kind === 'video' ? 'Видео' : 'PDF'}</span>}
                <span className="ml-name">{m.title || m.name}</span>
                {m.kind === 'image' && !m.altBg && <span className="ml-flag">без alt</span>}
              </button>
            </li>
          ))}
          {!shown.length && <li className="ml-empty">Няма файлове. Качете първия с бутона горе.</li>}
        </ul>
        {active && (
          <aside className="ml-side" key={active.id}>
            {active.kind === 'image' && <img src={active.variants[0]?.url ?? active.url} alt="" />}
            <p className="ml-meta">
              {active.width ? `${active.width}×${active.height} px · ` : ''}
              {(active.size / 1024).toFixed(0)} KB
            </p>
            <label>
              Заглавие
              <input defaultValue={active.title} onChange={(e) => (active.title = e.target.value)} />
            </label>
            {active.kind === 'image' && (
              <>
                <label>
                  Алтернативен текст (BG)
                  <textarea defaultValue={active.altBg} rows={2} placeholder="Какво се вижда на снимката, напр. „Трикоординатна машина HEXAGON Global в лаборатория“" onChange={(e) => (active.altBg = e.target.value)} />
                </label>
                <label>
                  Алтернативен текст (EN)
                  <textarea defaultValue={active.altEn} rows={2} onChange={(e) => (active.altEn = e.target.value)} />
                </label>
              </>
            )}
            <div className="ml-actions">
              <button type="button" className="adm-btn" onClick={() => saveMeta(active)}>
                Запазете описанието
              </button>
              <a className="adm-btn" href={active.url} target="_blank" rel="noreferrer">
                Отвори
              </a>
              {canDelete && (
                <button type="button" className="adm-btn danger" onClick={() => remove(active)}>
                  Изтрийте
                </button>
              )}
            </div>
          </aside>
        )}
      </div>
      {onSelect && (
        <div className="ml-foot">
          <button type="button" className="adm-btn primary" disabled={!selected.length} onClick={() => onSelect(items.filter((m) => selected.includes(m.id)))}>
            {multiple ? `Добавете избраните (${selected.length})` : 'Използвайте избраното'}
          </button>
        </div>
      )}
    </div>
  )
}
