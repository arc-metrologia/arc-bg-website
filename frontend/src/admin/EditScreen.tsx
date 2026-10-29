import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import { TYPE_LABELS } from '../edit/blockDefs'
import type { EmbedCmd, EmbedState } from '../edit/Editor'
import MediaLibrary from '../edit/MediaLibrary'
import { loadPages, type PageRef } from '../edit/PageLinkInput'
import PageSettings from '../edit/PageSettings'
import Revisions from '../edit/Revisions'
import type { Media, Me, Page } from '../types'
import Icon from './icons'
import { KINDS, fmtDate, kindOf } from './kinds'

const DEVICES = [
  { key: 'desktop', label: 'Компютър', width: '100%' },
  { key: 'tablet', label: 'Таблет', width: '820px' },
  { key: 'phone', label: 'Телефон', width: '390px' },
] as const

type Device = (typeof DEVICES)[number]['key']
type Panel = 'page' | 'revisions'

/**
 * Редакция на страница като в новия WordPress: горна лента със „Запазване“, „Преглед“ и „Публикуване“,
 * страницата в средата (редакторът в рамка, ?edit&embed) и панел „Страница“ вдясно.
 */
export default function EditScreen({ me }: { me: Me }) {
  const id = Number(useParams().id)
  const navigate = useNavigate()
  const canPublish = me.user!.permissions.includes('publish')
  const frame = useRef<HTMLIFrameElement>(null)
  const [ref, setRef] = useState<PageRef | null>(null)
  const [missing, setMissing] = useState(false)
  const [state, setState] = useState<EmbedState | null>(null)
  // Местно копие на настройките, за да не прескача курсорът, докато рамката потвърди промяната.
  const [page, setPage] = useState<Omit<Page, 'blocks'> | null>(null)
  const [image, setImage] = useState<Media | null>(null)
  const [sidebar, setSidebar] = useState(() => innerWidth > 960)
  const [panel, setPanel] = useState<Panel>('page')
  const [device, setDevice] = useState<Device>('desktop')
  const [preview, setPreview] = useState(false)
  const [picker, setPicker] = useState<((m: Media[]) => void) | null>(null)
  const [snack, setSnack] = useState<EmbedState['msg']>(null)
  const sent = useRef(0)
  const lastMsg = useRef(0)
  const dirty = state?.dirty ?? false

  // Адресът на страницата за рамката.
  useEffect(() => {
    setState(null)
    setPage(null)
    setRef(null)
    setMissing(false)
    loadPages(true).then((all) => {
      const p = all.find((x) => x.id === id)
      if (p) setRef(p)
      else setMissing(true)
    })
  }, [id])

  const send = useCallback((cmd: EmbedCmd) => frame.current?.contentWindow?.postMessage(cmd, location.origin), [])

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== location.origin || e.source !== frame.current?.contentWindow || !e.data || typeof e.data !== 'object') return
      const d = e.data
      if (d.type === 'arc-ready') sent.current = 0
      if (d.type === 'arc-saved') loadPages(true)
      if (d.type === 'arc-page' && d.id !== id) navigate(`/admin/edit/${d.id}`, { replace: true })
      if (d.type === 'arc-state') {
        const s = d as EmbedState
        setState(s)
        if (s.seq >= sent.current) {
          setPage(s.page)
          setImage(s.image)
        }
        if (s.msg && s.msg.t !== lastMsg.current) {
          lastMsg.current = s.msg.t
          setSnack(s.msg)
        }
      }
    }
    addEventListener('message', onMsg)
    return () => removeEventListener('message', onMsg)
  }, [id, navigate])

  useEffect(() => {
    if (!snack || snack.error) return
    const t = setTimeout(() => setSnack(null), 4000)
    return () => clearTimeout(t)
  }, [snack])

  // Ctrl+S, когато фокусът е извън рамката (в панела).
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        send({ type: 'arc-cmd', cmd: 'save' })
      }
    }
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault()
    }
    addEventListener('keydown', key)
    addEventListener('beforeunload', warn)
    return () => {
      removeEventListener('keydown', key)
      removeEventListener('beforeunload', warn)
    }
  }, [send, dirty])

  const patch = (p: Partial<Page>, media?: Media) => {
    sent.current += 1
    setPage((cur) => (cur ? { ...cur, ...p } : cur))
    if (media) setImage(media)
    send({ type: 'arc-cmd', cmd: 'patch', seq: sent.current, patch: p, media })
  }
  const save = (status?: Page['status']) => send({ type: 'arc-cmd', cmd: 'save', status })
  const pickMedia = (kind: Media['kind']) =>
    new Promise<Media[]>((resolve) => {
      void kind
      setPicker(() => resolve)
    })

  const kind = ref ? kindOf(ref.type) : 'pages'
  const back = `/admin/content/${kind}`
  const leave = (to: string) => {
    if (dirty && !confirm('Има незапазени промени. Да ги изоставя ли?')) return
    navigate(to)
  }

  if (missing)
    return (
      <div className="wp-editor-missing">
        <p>Страницата не е намерена — може да е изтрита.</p>
        <Link className="wp-btn" to="/admin/content/pages">
          Към всички страници
        </Link>
      </div>
    )

  const published = page?.status === 'published'
  const saving = state?.saving ?? false
  const width = DEVICES.find((d) => d.key === device)!.width

  return (
    <div className={`wp-editor${sidebar ? ' with-sidebar' : ''}`}>
      <header className="wp-editor-bar">
        <button type="button" className="wp-editor-back" onClick={() => leave(back)} aria-label={`Назад към ${KINDS[kind].label}`} title={`Назад към ${KINDS[kind].label}`}>
          <Icon name="back" size={24} />
        </button>
        <div className="wp-editor-doc">
          <strong>{page?.title || ref?.title || 'Зареждане…'}</strong>
          {ref && <span>{TYPE_LABELS[ref.type]}</span>}
        </div>
        <div className="wp-editor-actions">
          {state && (
            <span className="wp-editor-status" role="status">
              {saving ? 'Записване…' : dirty ? 'Незапазени промени' : 'Запазено'}
            </span>
          )}
          {!published && (
            <button type="button" className="wp-btn tertiary save-draft" disabled={!state || saving || !dirty} onClick={() => save()}>
              Запазване на чернова
            </button>
          )}
          <div className="wp-dropdown">
            <button type="button" className="wp-btn tertiary" aria-expanded={preview} onClick={() => setPreview(!preview)}>
              Преглед
            </button>
            {preview && (
              <div className="wp-dropdown-menu" role="menu" onMouseLeave={() => setPreview(false)}>
                {DEVICES.map((d) => (
                  <button
                    key={d.key}
                    type="button"
                    role="menuitemradio"
                    aria-checked={device === d.key}
                    onClick={() => {
                      setDevice(d.key)
                      setPreview(false)
                    }}
                  >
                    {d.label}
                  </button>
                ))}
                {ref && (
                  <a role="menuitem" href={page?.url ?? ref.url} target="_blank" rel="noopener" onClick={() => setPreview(false)}>
                    Отваряне в нов раздел <Icon name="external" size={16} />
                  </a>
                )}
                {dirty && <p className="wp-dropdown-note">В новия раздел се вижда последното запазено.</p>}
              </div>
            )}
          </div>
          {published ? (
            <button type="button" className="wp-btn primary" disabled={!state || saving || !dirty} onClick={() => save()}>
              Обновяване
            </button>
          ) : canPublish ? (
            <button type="button" className="wp-btn primary" disabled={!state || saving} onClick={() => save('published')}>
              Публикуване
            </button>
          ) : (
            <button type="button" className="wp-btn primary" disabled={!state || saving || !dirty} onClick={() => save()}>
              Запазване
            </button>
          )}
          <button type="button" className={`wp-editor-toggle${sidebar ? ' on' : ''}`} aria-pressed={sidebar} aria-label="Настройки" title="Настройки" onClick={() => setSidebar(!sidebar)}>
            <Icon name="sidebar" />
          </button>
        </div>
      </header>

      <div className="wp-editor-body">
        <div className="wp-editor-canvas">
          {ref && <iframe ref={frame} key={ref.id} src={`${ref.url}?edit&embed`} title={`Редакция: ${ref.title}`} style={{ width }} />}
        </div>

        {sidebar && (
          <aside className="wp-editor-sidebar" aria-label="Настройки на страницата">
            <div className="wp-sidebar-head">
              <div role="tablist" aria-label="Панел">
                <button type="button" role="tab" aria-selected={panel === 'page'} onClick={() => setPanel('page')}>
                  {TYPE_LABELS[ref?.type ?? 'page']}
                </button>
                <button type="button" role="tab" aria-selected={panel === 'revisions'} onClick={() => setPanel('revisions')}>
                  Версии
                </button>
              </div>
              <button type="button" className="wp-icon-btn" aria-label="Затваряне на панела" onClick={() => setSidebar(false)}>
                <Icon name="close" />
              </button>
            </div>

            {panel === 'revisions' ? (
              <Revisions className="wp-sidebar-revisions" pageId={id} onClose={() => setPanel('page')} onRestored={() => send({ type: 'arc-cmd', cmd: 'reload' })} />
            ) : page ? (
              <>
                <section className="wp-summary">
                  <dl>
                    <dt>Състояние</dt>
                    <dd>
                      <span className={`wp-status-dot ${page.status}`} /> {published ? 'Публикувана' : 'Чернова'}
                    </dd>
                    <dt>Адрес</dt>
                    <dd>
                      <a href={page.url} target="_blank" rel="noopener">
                        {page.url}
                      </a>
                    </dd>
                    <dt>Език</dt>
                    <dd>{page.lang === 'bg' ? 'Български' : 'English'}</dd>
                    {page.updatedAt && (
                      <>
                        <dt>Последна промяна</dt>
                        <dd>{fmtDate(page.updatedAt)}</dd>
                      </>
                    )}
                  </dl>
                  {published && canPublish && (
                    <button
                      type="button"
                      className="wp-btn secondary block"
                      disabled={saving}
                      onClick={() => confirm('Страницата ще изчезне от сайта за посетителите и ще стане чернова. Продължавате ли?') && save('draft')}
                    >
                      Превключване към чернова
                    </button>
                  )}
                </section>
                <PageSettings
                  className="wp-sidebar-settings ed-settings"
                  page={{ ...page, blocks: [] }}
                  media={image ? { [image.id]: image } : {}}
                  onChange={(p) => patch(p)}
                  // Избраната снимка се изпраща заедно с данните ѝ, за да се покаже веднага в рамката.
                  pickMedia={async (k) => {
                    const items = await pickMedia(k)
                    if (items[0]) patch({ image: items[0].id }, items[0])
                    return []
                  }}
                />
                {canPublish && page.path !== '' && (
                  <div className="wp-sidebar-danger">
                    <button
                      type="button"
                      className="wp-linkbtn delete"
                      onClick={async () => {
                        if (!confirm(`Да изтрия ли „${page.title}“ окончателно? Ако адресът е в Google, добавете пренасочване.`)) return
                        try {
                          await api(`admin/pages/${id}`, { method: 'DELETE' })
                          loadPages(true)
                          navigate(back)
                        } catch (e) {
                          setSnack({ text: (e as Error).message, error: true, t: Date.now() })
                        }
                      }}
                    >
                      Изтриване
                    </button>
                  </div>
                )}
              </>
            ) : (
              <p className="wp-sidebar-loading">Зареждане…</p>
            )}
          </aside>
        )}
      </div>

      {snack && (
        <div className={`wp-snackbar${snack.error ? ' error' : ''}`} role={snack.error ? 'alert' : 'status'}>
          {snack.text}
          {snack.error && (
            <button type="button" className="wp-icon-btn" aria-label="Затваряне" onClick={() => setSnack(null)}>
              <Icon name="close" size={16} />
            </button>
          )}
        </div>
      )}

      {picker && (
        <div className="ed-modal" role="dialog" aria-modal="true" aria-label="Медийна библиотека" onClick={(e) => e.target === e.currentTarget && setPicker(null)}>
          <div className="ed-modal-box">
            <div className="ed-modal-head">
              <h2>Избор на снимка</h2>
              <button type="button" onClick={() => setPicker(null)} aria-label="Затвори">
                ✕
              </button>
            </div>
            <MediaLibrary
              kind="image"
              onSelect={(items) => {
                picker(items)
                setPicker(null)
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
