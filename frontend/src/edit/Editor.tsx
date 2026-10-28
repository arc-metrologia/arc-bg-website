import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { api } from '../api'
import { EditContext, type EditApi } from '../site/edit-context'
import type { Block, Media, Me, Page, Payload } from '../types'
import { BLOCKS, CAROUSEL_SOURCES, LISTING_SOURCES, blockLabel } from './blockDefs'
import CarouselPages from './CarouselPages'
import MediaLibrary from './MediaLibrary'
import PageSettings from './PageSettings'
import '../styles/edit.css'

const RichEditorLazy = lazy(() => import('./RichEditor'))

function RichEditor(props: { html: string; onChange(html: string): void }) {
  return (
    <Suspense fallback={<div className="prose" dangerouslySetInnerHTML={{ __html: props.html }} />}>
      <RichEditorLazy {...props} />
    </Suspense>
  )
}

interface Picker {
  kind: Media['kind']
  multiple: boolean
  resolve(m: Media[]): void
}

interface Props {
  payload: Payload
  reload(): Promise<void>
  render(p: Payload): ReactNode
}

/** Режим на редакция върху самата страница. Зарежда се само за влезли редактори. */
export default function Editor({ payload, reload, render }: Props) {
  const [me, setMe] = useState<Me | null>(null)
  const [editing, setEditing] = useState(() => new URLSearchParams(location.search).has('edit'))
  const [draft, setDraft] = useState<Page>(payload.page!)
  const [extraMedia, setExtraMedia] = useState<Record<number, Media>>({})
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null)
  const [panel, setPanel] = useState<'settings' | 'revisions' | null>(null)
  const [picker, setPicker] = useState<Picker | null>(null)
  const dirtyRef = useRef(dirty)
  dirtyRef.current = dirty

  useEffect(() => {
    me_()
    async function me_() {
      setMe(await api<Me>('auth/me'))
    }
  }, [])

  // Нова страница от сървъра (навигация или след запис) — ако няма незапазени промени.
  useEffect(() => {
    if (!dirtyRef.current) setDraft(payload.page!)
  }, [payload.page])

  useEffect(() => {
    document.body.classList.toggle('editing', editing)
    return () => document.body.classList.remove('editing')
  }, [editing])

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) e.preventDefault()
    }
    addEventListener('beforeunload', warn)
    return () => removeEventListener('beforeunload', warn)
  }, [])

  const change = useCallback((fn: (p: Page) => Page) => {
    setDraft(fn)
    setDirty(true)
  }, [])

  const setBlocks = useCallback((fn: (b: Block[]) => Block[]) => change((p) => ({ ...p, blocks: fn(p.blocks) })), [change])

  const pickMedia = useCallback(
    (kind: Media['kind'], multiple = false) =>
      new Promise<Media[]>((resolve) => {
        setPicker({
          kind,
          multiple,
          resolve: (items) => {
            setExtraMedia((m) => ({ ...m, ...Object.fromEntries(items.map((x) => [x.id, x])) }))
            resolve(items)
          },
        })
      }),
    [],
  )

  const patchBlock = useCallback(
    (id: string, patch: Partial<Block>) => setBlocks((bs) => bs.map((b) => (b.id === id ? ({ ...b, ...patch } as Block) : b))),
    [setBlocks],
  )

  const api_: EditApi = useMemo(
    () => ({
      editing,
      setPage: (patch) => change((p) => ({ ...p, ...patch })),
      setBlock: (id, patch) => setBlocks((bs) => bs.map((b) => (b.id === id ? ({ ...b, ...patch } as Block) : b))),
      pickMedia,
      RichEditor,
      Frame: ({ block, index, children }) => {
        if (!editing) return children
        const move = (d: number) =>
          setBlocks((bs) => {
            const next = [...bs]
            const [x] = next.splice(index, 1)
            next.splice(index + d, 0, x)
            return next
          })
        return (
          <div className="ed-frame">
            <div className="ed-frame-bar">
              <span>{blockLabel(block.type)}</span>
              {block.type === 'listing' && (
                <select value={block.source} onChange={(e) => setBlocks((bs) => bs.map((b) => (b.id === block.id ? ({ ...b, source: e.target.value } as Block) : b)))} aria-label="Източник">
                  {LISTING_SOURCES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              )}
              {block.type === 'carousel' && (
                <select value={block.source} onChange={(e) => patchBlock(block.id, { source: e.target.value } as Partial<Block>)} aria-label="Какво показва слайдерът">
                  {CAROUSEL_SOURCES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              )}
              <button type="button" onClick={() => move(-1)} disabled={index === 0} aria-label="Премести нагоре">
                ↑
              </button>
              <button type="button" onClick={() => move(1)} aria-label="Премести надолу">
                ↓
              </button>
              <button
                type="button"
                onClick={() => confirm(`Да премахна ли секцията „${blockLabel(block.type)}“?`) && setBlocks((bs) => bs.filter((b) => b.id !== block.id))}
                aria-label="Премахни секцията"
              >
                ✕
              </button>
            </div>
            {block.type === 'carousel' && block.source === 'manual' && (
              <div className="wrap">
                <CarouselPages lang={draft.lang} pages={block.pages} onChange={(pages) => patchBlock(block.id, { pages } as Partial<Block>)} />
              </div>
            )}
            {children}
            <Inserter index={index + 1} />
          </div>
        )
      },
      Inserter: ({ index }) => (editing ? <Inserter index={index} /> : null),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editing, change, setBlocks, patchBlock, pickMedia, draft.lang],
  )

  function Inserter({ index }: { index: number }) {
    const [open, setOpen] = useState(false)
    return (
      <div className="ed-insert">
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}>
          + Добавете секция
        </button>
        {open && (
          <ul className="ed-insert-menu">
            {BLOCKS.map((b) => (
              <li key={b.type}>
                <button
                  type="button"
                  onClick={() => {
                    setBlocks((bs) => [...bs.slice(0, index), b.make(), ...bs.slice(index)])
                    setOpen(false)
                  }}
                >
                  <strong>{b.label}</strong>
                  <span>{b.hint}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  }

  async function save(status?: Page['status']) {
    // Текстовите полета записват при blur — даваме им шанс преди изпращането.
    ;(document.activeElement as HTMLElement | null)?.blur()
    await new Promise((r) => setTimeout(r, 0))
    setSaving(true)
    setMsg(null)
    try {
      const body = { ...draftRef.current, ...(status ? { status } : {}) }
      const saved = await api<Page>(`admin/pages/${draft.id}`, { method: 'PUT', body })
      setDirty(false)
      dirtyRef.current = false
      if (saved.url !== location.pathname) {
        location.href = saved.url + (editing ? '?edit' : '')
        return
      }
      setDraft(saved)
      await reload()
      setMsg({ text: status === 'published' ? 'Публикувано.' : status === 'draft' ? 'Скрито — вече е чернова.' : 'Запазено.' })
    } catch (e) {
      setMsg({ text: (e as Error).message, error: true })
    } finally {
      setSaving(false)
    }
  }
  const draftRef = useRef(draft)
  draftRef.current = draft

  const can = (p: string) => me?.user?.permissions.includes(p) ?? false
  const view: Payload = { ...payload, page: draft, media: { ...payload.media, ...extraMedia } }

  if (me && me.stage !== 'ok') return <>{render(payload)}</>

  return (
    <EditContext.Provider value={api_}>
      {render(view)}
      <div className="ed-bar" role="region" aria-label="Редакция на страницата">
        <span className={`ed-status ${draft.status}`}>{draft.status === 'published' ? 'Публикувана' : 'Чернова'}</span>
        <button type="button" className={editing ? 'on' : undefined} onClick={() => setEditing(!editing)}>
          {editing ? 'Преглед' : 'Редактирайте страницата'}
        </button>
        <button type="button" onClick={() => setPanel(panel === 'settings' ? null : 'settings')}>
          Настройки и SEO
        </button>
        <button type="button" onClick={() => setPanel(panel === 'revisions' ? null : 'revisions')}>
          Версии
        </button>
        <span className="ed-spacer" />
        {msg && (
          <span className={`ed-msg${msg.error ? ' err' : ''}`} role="status">
            {msg.text}
          </span>
        )}
        {dirty && <span className="ed-dirty">Незапазени промени</span>}
        <button type="button" className="primary" disabled={saving || !dirty} onClick={() => save()}>
          {saving ? 'Записване…' : 'Запазете'}
        </button>
        {can('publish') &&
          (draft.status === 'published' ? (
            <button type="button" disabled={saving} onClick={() => save('draft')}>
              Скрийте
            </button>
          ) : (
            <button type="button" className="accent" disabled={saving} onClick={() => save('published')}>
              Публикувайте
            </button>
          ))}
        <a href="/admin">Админ панел</a>
      </div>
      {panel === 'settings' && (
        <PageSettings page={draft} media={view.media} onChange={(patch) => change((p) => ({ ...p, ...patch }))} pickMedia={pickMedia} onClose={() => setPanel(null)} />
      )}
      {panel === 'revisions' && (
        <Revisions
          pageId={draft.id}
          onClose={() => setPanel(null)}
          onRestored={async () => {
            setDirty(false)
            dirtyRef.current = false
            await reload()
            setPanel(null)
          }}
        />
      )}
      {picker && (
        <div className="ed-modal" role="dialog" aria-modal="true" aria-label="Медийна библиотека" onClick={(e) => e.target === e.currentTarget && setPicker(null)}>
          <div className="ed-modal-box">
            <div className="ed-modal-head">
              <h2>Медийна библиотека</h2>
              <button type="button" onClick={() => setPicker(null)} aria-label="Затвори">
                ✕
              </button>
            </div>
            <MediaLibrary
              kind={picker.kind}
              multiple={picker.multiple}
              onSelect={(items) => {
                picker.resolve(items)
                setPicker(null)
              }}
            />
          </div>
        </div>
      )}
    </EditContext.Provider>
  )
}

function Revisions({ pageId, onClose, onRestored }: { pageId: number; onClose(): void; onRestored(): void }) {
  const [list, setList] = useState<{ id: number; created_at: string; user_name: string | null }[] | null>(null)
  useEffect(() => {
    api<typeof list>(`admin/pages/${pageId}/revisions`).then(setList)
  }, [pageId])
  return (
    <aside className="ed-drawer" aria-label="Версии">
      <div className="ed-modal-head">
        <h2>Предишни версии</h2>
        <button type="button" onClick={onClose} aria-label="Затвори">
          ✕
        </button>
      </div>
      <p className="ed-hint">Всяко записване пази предишното състояние. Възстановяването също се записва като нова версия, така че нищо не се губи.</p>
      {list === null ? (
        <p>Зареждане…</p>
      ) : list.length === 0 ? (
        <p>Още няма предишни версии.</p>
      ) : (
        <ul className="ed-revs">
          {list.map((r) => (
            <li key={r.id}>
              <span>
                {new Date(r.created_at.replace(' ', 'T')).toLocaleString('bg-BG')} · {r.user_name ?? 'системата'}
              </span>
              <button
                type="button"
                onClick={async () => {
                  if (!confirm('Да възстановя ли тази версия? Текущото съдържание ще бъде запазено като версия.')) return
                  await api(`admin/revisions/${r.id}/restore`, { method: 'POST' })
                  onRestored()
                }}
              >
                Възстановете
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  )
}
