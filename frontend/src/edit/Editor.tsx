import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { api } from '../api'
import { EditContext, type EditApi } from '../site/edit-context'
import { SIZABLE } from '../site/box'
import type { Block, BoxAlign, Media, Me, Page, Payload } from '../types'
import { BLOCKS, CAROUSEL_SOURCES, LISTING_SOURCES, blockLabel } from './blockDefs'
import BoxResize from './BoxResize'
import CarouselPages from './CarouselPages'
import FxControls from './FxControls'
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

/** Редакторът е вграден в /admin/pages (iframe): съобщава на админа коя страница е отворена и кога е записана. */
const EMBED = window.parent !== window && new URLSearchParams(location.search).has('embed')
const notify = (msg: { type: 'arc-page' | 'arc-saved'; id: number; dirty?: boolean }) => EMBED && window.parent.postMessage(msg, location.origin)

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
    notify({ type: 'arc-page', id: draft.id, dirty })
  }, [draft.id, dirty])

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
        // Влачене на секция за „⠿“ и пускане върху друга (горната или долната ѝ половина).
        const DND = 'application/x-arc-block'
        const half = (e: React.DragEvent<HTMLElement>) => {
          const r = e.currentTarget.getBoundingClientRect()
          return e.clientY > r.top + r.height / 2 ? 'after' : 'before'
        }
        const clearDrop = (el: HTMLElement) => el.classList.remove('drop-before', 'drop-after')
        const sized = SIZABLE.includes(block.type)
        const setAlign = (align: BoxAlign) => patchBlock(block.id, { align, width: block.width ?? 60 })
        return (
          <div
            className="ed-frame"
            onDragOver={(e) => {
              if (!e.dataTransfer.types.includes(DND)) return
              e.preventDefault()
              e.dataTransfer.dropEffect = 'move'
              const h = half(e)
              e.currentTarget.classList.toggle('drop-before', h === 'before')
              e.currentTarget.classList.toggle('drop-after', h === 'after')
            }}
            onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && clearDrop(e.currentTarget)}
            onDrop={(e) => {
              const raw = e.dataTransfer.getData(DND)
              clearDrop(e.currentTarget)
              if (raw === '') return
              e.preventDefault()
              const from = Number(raw)
              const to = index + (half(e) === 'after' ? 1 : 0)
              if (to === from || to === from + 1) return
              setBlocks((bs) => {
                const next = [...bs]
                const [x] = next.splice(from, 1)
                next.splice(to > from ? to - 1 : to, 0, x)
                return next
              })
            }}
          >
            {sized && <BoxResize width={block.width} align={block.align} onChange={(patch) => patchBlock(block.id, patch)} />}
            <div className="ed-frame-bar">
              <span
                className="ed-grip"
                draggable
                title="Влачете, за да преместите секцията"
                onDragStart={(e) => {
                  e.dataTransfer.setData(DND, String(index))
                  e.dataTransfer.effectAllowed = 'move'
                  const frame = e.currentTarget.closest('.ed-frame')
                  if (frame) e.dataTransfer.setDragImage(frame, 20, 20)
                }}
              >
                ⠿ {blockLabel(block.type)}
              </span>
              {sized && (
                <>
                  {(
                    [
                      ['left', '⇤', 'Вляво'],
                      ['center', '⇔', 'В средата'],
                      ['right', '⇥', 'Вдясно'],
                    ] as const
                  ).map(([a, label, title]) => (
                    <button key={a} type="button" className={block.width && (block.align ?? 'left') === a ? 'on' : undefined} onClick={() => setAlign(a)} title={title} aria-label={title}>
                      {label}
                    </button>
                  ))}
                  {block.width ? (
                    <button type="button" onClick={() => patchBlock(block.id, { width: undefined, align: undefined })} title="Стандартна ширина">
                      {block.width}% ↺
                    </button>
                  ) : null}
                </>
              )}
              {(block.type === 'hero' || block.type === 'image') && (
                <FxControls fx={block} onChange={(fx) => patchBlock(block.id, fx as Partial<Block>)} />
              )}
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

  // Менюто се отваря нагоре, ако отдолу (над лентата на редактора) няма място за него.
  function placeMenu(el: HTMLUListElement | null) {
    if (!el || el.dataset.placed) return
    el.dataset.placed = '1'
    const r = el.getBoundingClientRect()
    const room = innerHeight - 96
    if (r.bottom <= room) return
    if (el.parentElement!.getBoundingClientRect().top > r.height + 16) el.classList.add('up')
    // Кратка страница: нито отдолу, нито отгоре има място — менюто се превърта вътрешно.
    else el.style.maxHeight = `${Math.max(240, room - Math.max(r.top, 16))}px`
    el.scrollIntoView({ block: 'nearest' })
  }

  function Inserter({ index }: { index: number }) {
    const [open, setOpen] = useState(false)
    return (
      <div className="ed-insert">
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}>
          + Добавете секция
        </button>
        {open && (
          <ul className="ed-insert-menu" ref={placeMenu}>
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
        location.href = saved.url + (editing ? '?edit' : '') + (EMBED ? (editing ? '&embed' : '?embed') : '')
        return
      }
      notify({ type: 'arc-saved', id: saved.id })
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
            <button
              type="button"
              disabled={saving}
              title="Страницата става чернова и посетителите не я виждат"
              onClick={() => confirm('Страницата ще бъде скрита от посетителите на сайта (става чернова). Продължавате ли?') && save('draft')}
            >
              Скрийте от сайта
            </button>
          ) : (
            <button type="button" className="accent" disabled={saving} onClick={() => save('published')}>
              Публикувайте
            </button>
          ))}
        {!EMBED && <a href="/admin">Админ панел</a>}
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
