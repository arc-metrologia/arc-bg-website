import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { TYPE_LABELS } from '../edit/blockDefs'
import { loadPages, type PageRef } from '../edit/PageLinkInput'
import type { Me } from '../types'
import { NewPage } from './pages'

const DEVICES = [
  { key: 'desktop', label: 'Компютър', width: '100%' },
  { key: 'tablet', label: 'Таблет', width: '820px' },
  { key: 'phone', label: 'Телефон', width: '390px' },
] as const

// Подреждане като дърво: „produkti“, „produkti/x“, „produkti-y“ (сегментите се сравняват поотделно).
const treeKey = (p: PageRef) => p.path.split('/').join('\u0001')

/** Визуален редактор в админа: дърво на страниците вляво, самата страница (в режим на редакция) вдясно. */
export default function PageEditor({ me }: { me: Me }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [pages, setPages] = useState<PageRef[]>([])
  const [lang, setLang] = useState<'bg' | 'en'>('bg')
  const [q, setQ] = useState('')
  const [device, setDevice] = useState<(typeof DEVICES)[number]['key']>('desktop')
  const [creating, setCreating] = useState<{ parent: string } | null>(null)
  const [src, setSrc] = useState('')
  const dirty = useRef(false)
  const shownId = useRef<number | null>(null)
  const current = pages.find((p) => p.id === Number(id))

  const refresh = (fresh = true) => loadPages(fresh).then(setPages)
  useEffect(() => {
    refresh(false)
  }, [])

  // Току-що създадена страница: още я няма в списъка.
  useEffect(() => {
    setCreating(null)
    if (id && !pages.some((p) => p.id === Number(id))) refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // Избор от дървото → зареждаме страницата в рамката. Навигация вътре в рамката само обновява избора.
  useEffect(() => {
    if (!current) return
    setLang(current.lang)
    if (shownId.current !== current.id) {
      shownId.current = current.id
      setSrc(`${current.url}?edit&embed`)
    }
  }, [current])

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== location.origin || !e.data || typeof e.data !== 'object') return
      if (e.data.type === 'arc-page') {
        dirty.current = !!e.data.dirty
        if (e.data.id !== shownId.current) {
          shownId.current = e.data.id
          navigate(`/admin/pages/${e.data.id}`, { replace: true })
        }
      }
      if (e.data.type === 'arc-saved') refresh()
    }
    addEventListener('message', onMsg)
    return () => removeEventListener('message', onMsg)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const open = (pid: number) => {
    if (pid === shownId.current) return
    if (dirty.current && !confirm('Има незапазени промени на отворената страница. Да ги изоставя ли?')) return
    dirty.current = false
    navigate(`/admin/pages/${pid}`)
  }

  const tree = useMemo(
    () =>
      pages
        .filter((p) => p.lang === lang)
        .filter((p) => !q || `${p.title} ${p.url}`.toLowerCase().includes(q.toLowerCase()))
        .sort((a, b) => (treeKey(a) < treeKey(b) ? -1 : 1)),
    [pages, lang, q],
  )
  const canAll = me.user!.permissions.includes('content')
  const width = DEVICES.find((d) => d.key === device)!.width

  return (
    <div className="adm-pe">
      <aside className="adm-pe-tree" aria-label="Страници">
        <div className="adm-pe-tree-head">
          <div className="adm-tabs" role="tablist" aria-label="Език">
            {(['bg', 'en'] as const).map((l) => (
              <button key={l} type="button" role="tab" aria-selected={lang === l} onClick={() => setLang(l)}>
                {l === 'bg' ? 'Български' : 'English'}
              </button>
            ))}
          </div>
          <input type="search" placeholder="Търсене" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Търсене на страница" />
          <button type="button" className="adm-btn primary small" onClick={() => setCreating({ parent: '' })}>
            + Нова страница
          </button>
        </div>
        <ul>
          {tree.map((p) => {
            const depth = p.path === '' ? 0 : p.path.split('/').length
            return (
              <li key={p.id} className={p.id === current?.id ? 'on' : undefined} style={{ paddingLeft: `${8 + depth * 14}px` }}>
                <button type="button" className="adm-pe-node" onClick={() => open(p.id)} title={p.url}>
                  <span className={`adm-dot ${p.status}`} aria-label={p.status === 'published' ? 'Публикувана' : 'Чернова'} />
                  <span className="adm-pe-title">{p.path === '' ? `Начална страница` : p.title}</span>
                  <span className="adm-pe-type">{TYPE_LABELS[p.type]}</span>
                </button>
                {canAll && (
                  <button type="button" className="adm-pe-add" title={`Нова подстраница на „${p.title}“`} aria-label={`Нова подстраница на „${p.title}“`} onClick={() => setCreating({ parent: p.path })}>
                    +
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      </aside>
      <section className="adm-pe-main">
        {creating ? (
          <div className="adm-pe-new">
            <NewPage key={creating.parent} me={me} lang={lang} parent={creating.parent} onCancel={() => setCreating(null)} />
          </div>
        ) : current ? (
          <>
            <div className="adm-pe-bar">
              <strong>{current.title}</strong>
              <span className="adm-url">{current.url}</span>
              <span className="adm-pe-spacer" />
              <div className="adm-tabs" role="tablist" aria-label="Размер на екрана">
                {DEVICES.map((d) => (
                  <button key={d.key} type="button" role="tab" aria-selected={device === d.key} onClick={() => setDevice(d.key)}>
                    {d.label}
                  </button>
                ))}
              </div>
              <a className="adm-btn small" href={current.url} target="_blank" rel="noopener">
                Отворете на сайта ↗
              </a>
            </div>
            <div className="adm-pe-canvas">
              {src && <iframe key={src} src={src} title={`Редакция: ${current.title}`} style={{ width }} />}
            </div>
          </>
        ) : (
          <div className="adm-pe-empty">
            <h1>Страници</h1>
            <p>Изберете страница отляво, за да я редактирате визуално: текст, снимки, видео, таблици, бутони и подредба на секциите.</p>
            <p>
              С <strong>+</strong> до дадена страница добавяте подстраница към нея. Менюто на сайта се подрежда в <Link to="/admin/settings">Фирма и меню</Link>, а цветовете във{' '}
              <Link to="/admin/appearance">Външен вид</Link>.
            </p>
          </div>
        )}
      </section>
    </div>
  )
}
