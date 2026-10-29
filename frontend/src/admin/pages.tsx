import { useEffect, useState } from 'react'
import { api, slugify } from '../api'
import { Link, useNavigate } from 'react-router-dom'
import { TEMPLATES, TYPE_LABELS } from '../edit/blockDefs'
import PageLinkInput, { loadPages, usePages } from '../edit/PageLinkInput'
import type { Me, NavItem, PageType, SiteInfo } from '../types'

interface Row {
  id: number
  type: PageType
  lang: 'bg' | 'en'
  path: string
  url: string
  title: string
  status: 'draft' | 'published'
  updated_at: string
}

const fmt = (d: string | null) => (d ? new Date(d.replace(' ', 'T')).toLocaleString('bg-BG', { dateStyle: 'short', timeStyle: 'short' }) : '—')

const PREFIX: Record<string, Record<PageType, string>> = {
  bg: { product: 'produkti/', service: 'uslugi/', post: 'blog/', category: '', page: '' },
  en: { product: 'products/', service: 'services/', post: 'blog/', category: '', page: '' },
}

export function NewPage({ me, onCancel, parent: initialParent = '', lang: initialLang = 'bg' }: { me: Me; onCancel(): void; parent?: string; lang?: 'bg' | 'en' }) {
  const canAll = me.user!.permissions.includes('content')
  const navigate = useNavigate()
  const [type, setType] = useState<PageType>(canAll ? (initialParent.startsWith('blog') ? 'post' : 'page') : 'post')
  const [template, setTemplate] = useState(canAll ? 'blank' : 'post')
  const [lang, setLang] = useState<'bg' | 'en'>(initialLang)
  const [parent, setParent] = useState(initialParent)
  const [title, setTitle] = useState('')
  const [path, setPath] = useState('')
  const [touched, setTouched] = useState(false)
  const [error, setError] = useState('')
  const pages = usePages(lang)
  const auto = (parent ? parent + '/' : PREFIX[lang][type]) + slugify(title)

  async function create(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const blocks = (TEMPLATES.find((t) => t.key === template) ?? TEMPLATES[0]).blocks()
    try {
      const page = await api<{ id: number }>('admin/pages', { body: { type, lang, title, path: touched ? path : auto, blocks, status: 'draft' } })
      loadPages(true)
      navigate(`/admin/pages/${page.id}`)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <form className="adm-card adm-form adm-new" onSubmit={create}>
      <h2>Нова страница</h2>
      <div className="adm-grid">
        <label>
          Тип
          <select value={type} onChange={(e) => setType(e.target.value as PageType)} disabled={!canAll}>
            {Object.entries(TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label>
          Език
          <select value={lang} onChange={(e) => setLang(e.target.value as 'bg' | 'en')}>
            <option value="bg">Български</option>
            <option value="en">English</option>
          </select>
        </label>
      </div>
      {canAll && (
        <fieldset className="adm-templates">
          <legend>Шаблон</legend>
          {TEMPLATES.map((t) => (
            <label key={t.key} className={template === t.key ? 'on' : undefined}>
              <input
                type="radio"
                name="template"
                checked={template === t.key}
                onChange={() => {
                  setTemplate(t.key)
                  setType(t.type)
                }}
              />
              <strong>{t.label}</strong>
              <span>{t.hint}</span>
            </label>
          ))}
        </fieldset>
      )}
      {canAll && (
        <label>
          Къде да е в структурата
          <select value={parent} onChange={(e) => setParent(e.target.value)}>
            <option value="">Самостоятелна страница (на първо ниво)</option>
            {pages
              .filter((p) => p.path !== '')
              .map((p) => (
                <option key={p.id} value={p.path}>
                  {'— '.repeat(p.path.split('/').length - 1)}Подстраница на „{p.title}“
                </option>
              ))}
          </select>
        </label>
      )}
      <label>
        Заглавие
        <input value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus />
      </label>
      <label>
        Адрес
        <span className="adm-path">
          <span>{lang === 'bg' ? '/' : '/en/'}</span>
          <input
            value={touched ? path : auto}
            onChange={(e) => {
              setTouched(true)
              setPath(e.target.value.toLowerCase().replace(/[^a-z0-9/-]/g, ''))
            }}
          />
        </span>
      </label>
      {error && <p className="adm-error" role="alert">{error}</p>}
      <div className="adm-row">
        <button className="adm-btn primary">Създайте и отворете в редактора</button>
        <button type="button" className="adm-btn" onClick={onCancel}>
          Отказ
        </button>
      </div>
      <p className="adm-muted">Страницата се създава като чернова — вижда се само от редакторите, докато не я публикувате.</p>
    </form>
  )
}

export function ContentList({ me }: { me: Me }) {
  const [rows, setRows] = useState<Row[]>([])
  const [type, setType] = useState<PageType | ''>('')
  const [lang, setLang] = useState('')
  const [q, setQ] = useState('')
  const [creating, setCreating] = useState(false)
  const canDelete = me.user!.permissions.includes('publish')
  const load = () => api<Row[]>(`admin/pages?type=${type}&lang=${lang}`).then(setRows)
  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, lang])
  const shown = rows.filter((r) => !q || `${r.title} ${r.url}`.toLowerCase().includes(q.toLowerCase()))
  return (
    <>
      <div className="adm-head">
        <h1>Съдържание</h1>
        <button type="button" className="adm-btn primary" onClick={() => setCreating(true)}>
          Нова страница
        </button>
      </div>
      {creating && <NewPage me={me} onCancel={() => setCreating(false)} />}
      <div className="adm-filters">
        <div className="adm-tabs" role="tablist">
          {[['', 'Всички'], ...Object.entries(TYPE_LABELS)].map(([k, v]) => (
            <button key={k} type="button" role="tab" aria-selected={type === k} onClick={() => setType(k as PageType)}>
              {v}
            </button>
          ))}
        </div>
        <select value={lang} onChange={(e) => setLang(e.target.value)} aria-label="Език">
          <option value="">BG и EN</option>
          <option value="bg">Български</option>
          <option value="en">English</option>
        </select>
        <input type="search" placeholder="Търсене" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <table className="adm-table">
        <thead>
          <tr>
            <th>Заглавие</th>
            <th>Тип</th>
            <th>Състояние</th>
            <th>Последна промяна</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {shown.map((r) => (
            <tr key={r.id}>
              <td>
                <Link to={`/admin/pages/${r.id}`} className="adm-title">
                  {r.title}
                </Link>
                <span className="adm-url">
                  {r.lang.toUpperCase()} · {r.url}
                </span>
              </td>
              <td>{TYPE_LABELS[r.type]}</td>
              <td>
                <span className={`adm-badge ${r.status}`}>{r.status === 'published' ? 'Публикувана' : 'Чернова'}</span>
              </td>
              <td>{fmt(r.updated_at)}</td>
              <td className="adm-actions">
                <Link to={`/admin/pages/${r.id}`} className="adm-btn small">
                  Редактирайте
                </Link>
                <a href={r.url} className="adm-btn small" target="_blank" rel="noopener">
                  Вижте
                </a>
                {canDelete && r.path !== '' && (
                  <button
                    type="button"
                    className="adm-btn small danger"
                    onClick={async () => {
                      if (!confirm(`Да изтрия ли „${r.title}“ окончателно? Ако страницата е индексирана, добавете пренасочване.`)) return
                      try {
                        await api(`admin/pages/${r.id}`, { method: 'DELETE' })
                        loadPages(true)
                        load()
                      } catch (e) {
                        alert(`Страницата не е изтрита: ${(e as Error).message}`)
                      }
                    }}
                  >
                    Изтрийте
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

export function Messages() {
  const [rows, setRows] = useState<Record<string, string>[] | null>(null)
  useEffect(() => {
    api<Record<string, string>[]>('admin/messages').then(setRows)
  }, [])
  return (
    <>
      <h1>Запитвания от сайта</h1>
      {rows?.length === 0 && <p className="adm-muted">Още няма запитвания. Те идват от формата за контакт и се изпращат и по имейл.</p>}
      <div className="adm-messages">
        {rows?.map((m) => (
          <article key={m.id} className="adm-card">
            <header>
              <strong>{m.name}</strong> {m.company && <span>· {m.company}</span>}
              <time>{fmt(m.created_at)}</time>
            </header>
            <p className="adm-contact">
              <a href={`mailto:${m.email}`}>{m.email}</a> {m.phone && <a href={`tel:${m.phone}`}>{m.phone}</a>} {m.page && <span className="adm-muted">от {m.page}</span>}
            </p>
            <p className="adm-body">{m.body}</p>
          </article>
        ))}
      </div>
    </>
  )
}

function NavEditor({ items, onChange, lang }: { items: NavItem[]; onChange(i: NavItem[]): void; lang: 'bg' | 'en' }) {
  const pages = usePages(lang)
  const upd = (i: number, patch: Partial<NavItem>) => onChange(items.map((x, j) => (j === i ? { ...x, ...patch } : x)))
  const move = (i: number, d: number) => {
    const next = [...items]
    const [x] = next.splice(i, 1)
    next.splice(i + d, 0, x)
    onChange(next)
  }
  return (
    <ul className="adm-nav-edit">
      {items.map((it, i) => (
        <li key={i}>
          <div className="adm-row">
            <input value={it.label} placeholder="Текст" onChange={(e) => upd(i, { label: e.target.value })} aria-label="Текст" />
            <PageLinkInput
              lang={lang}
              value={it.url}
              placeholder="Изберете страница или https://…"
              aria-label="Адрес"
              onChange={(url) => upd(i, { url, label: it.label || pages.find((p) => p.url === url)?.title || '' })}
            />
            <button type="button" className="adm-btn small" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Нагоре">
              ↑
            </button>
            <button type="button" className="adm-btn small" disabled={i === items.length - 1} onClick={() => move(i, 1)} aria-label="Надолу">
              ↓
            </button>
            <button type="button" className="adm-btn small danger" onClick={() => onChange(items.filter((_, j) => j !== i))} aria-label="Премахни">
              ✕
            </button>
          </div>
          {it.children !== undefined && <NavEditor lang={lang} items={it.children} onChange={(children) => upd(i, { children })} />}
          {it.children === undefined && (
            <button type="button" className="adm-link" onClick={() => upd(i, { children: [] })}>
              + подменю
            </button>
          )}
        </li>
      ))}
      <li>
        <button type="button" className="adm-link" onClick={() => onChange([...items, { label: '', url: '' }])}>
          + добавете връзка
        </button>
      </li>
    </ul>
  )
}

export function Settings() {
  const [site, setSite] = useState<SiteInfo | null>(null)
  const [nav, setNav] = useState<Record<'bg' | 'en', NavItem[]>>({ bg: [], en: [] })
  const [navLang, setNavLang] = useState<'bg' | 'en'>('bg')
  const [redirects, setRedirects] = useState('')
  const [msg, setMsg] = useState('')
  useEffect(() => {
    api<SiteInfo>('admin/settings/site').then(setSite)
    Promise.all([api<NavItem[]>('admin/settings/nav_bg'), api<NavItem[]>('admin/settings/nav_en')]).then(([bg, en]) => setNav({ bg: bg ?? [], en: en ?? [] }))
    api<Record<string, string>>('admin/settings/redirects').then((r) =>
      setRedirects(
        Object.entries(r ?? {})
          .map(([a, b]) => `${a} ${b}`)
          .join('\n'),
      ),
    )
  }, [])
  const [error, setError] = useState('')
  const flash = (m: string) => {
    setMsg(m)
    setTimeout(() => setMsg(''), 3000)
  }
  const saveWith = async (fn: () => Promise<unknown>, ok: string) => {
    setError('')
    try {
      await fn()
      flash(ok)
    } catch (e) {
      setError((e as Error).message)
    }
  }
  if (!site) return <p>Зареждане…</p>
  const field = (label: string, key: string, sub?: 'bg' | 'en', area = false) => {
    const value = (sub ? (site[key] as Record<string, string>)?.[sub] : (site[key] as string)) ?? ''
    const set = (v: string) => setSite({ ...site, [key]: sub ? { ...(site[key] as object), [sub]: v } : v })
    return (
      <label>
        {label}
        {area ? <textarea rows={4} value={value} onChange={(e) => set(e.target.value)} /> : <input value={value} onChange={(e) => set(e.target.value)} />}
      </label>
    )
  }
  return (
    <>
      <div className="adm-head">
        <h1>Фирма и меню</h1>
        {msg && <span className="adm-ok" role="status">{msg}</span>}
        {error && (
          <span className="adm-error" role="alert">
            Не е запазено: {error}
          </span>
        )}
      </div>
      <section className="adm-card adm-form">
        <h2>Данни за фирмата</h2>
        <p className="adm-muted">Използват се в хедъра, футъра, контактите и в структурираните данни за Google и AI асистентите.</p>
        <div className="adm-grid">
          {field('Име (BG)', 'name')}
          {field('Име (EN)', 'nameEn')}
          {field('Юридическо име', 'legalName')}
          {field('Телефон', 'phone')}
          {field('Имейл', 'email')}
          {field('Адрес (BG)', 'address', 'bg')}
          {field('Адрес (EN)', 'address', 'en')}
          {field('Подзаглавие (BG)', 'tagline', 'bg')}
          {field('Подзаглавие (EN)', 'tagline', 'en')}
        </div>
        {field('Описание на фирмата (BG) — за Google и AI', 'description', 'bg', true)}
        {field('Описание на фирмата (EN)', 'description', 'en', true)}
        <button
          type="button"
          className="adm-btn primary"
          onClick={() => saveWith(() => api('admin/settings/site', { method: 'PUT', body: site }), 'Данните са запазени.')}
        >
          Запазете данните
        </button>
      </section>
      <section className="adm-card">
        <h2>Главно меню</h2>
        <div className="adm-tabs" role="tablist" aria-label="Език на менюто">
          {(['bg', 'en'] as const).map((l) => (
            <button key={l} type="button" role="tab" aria-selected={navLang === l} onClick={() => setNavLang(l)}>
              {l === 'bg' ? 'Български' : 'English'}
            </button>
          ))}
        </div>
        <NavEditor lang={navLang} items={nav[navLang]} onChange={(items) => setNav({ ...nav, [navLang]: items })} />
        <button
          type="button"
          className="adm-btn primary"
          onClick={() => saveWith(() => api(`admin/settings/nav_${navLang}`, { method: 'PUT', body: nav[navLang] }), 'Менюто е запазено.')}
        >
          Запазете менюто
        </button>
      </section>
      <section className="adm-card adm-form">
        <h2>Пренасочвания (301)</h2>
        <p className="adm-muted">По един ред: стар адрес, интервал, нов адрес. Пазят позициите в Google, когато адрес се смени или страница се изтрие.</p>
        <textarea className="adm-mono" rows={12} value={redirects} onChange={(e) => setRedirects(e.target.value)} />
        <button
          type="button"
          className="adm-btn primary"
          onClick={() => {
            const map: Record<string, string> = {}
            for (const line of redirects.split('\n')) {
              const [from, to] = line.trim().split(/\s+/)
              if (from && to) map[from] = to
            }
            saveWith(() => api('admin/settings/redirects', { method: 'PUT', body: map }), 'Пренасочванията са запазени.')
          }}
        >
          Запазете пренасочванията
        </button>
      </section>
    </>
  )
}

export function Comparator() {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    api<{ url: string }>('admin/comparator').then((r) => setUrl(r.url))
  }, [])
  if (url === null) return <p>Зареждане…</p>
  if (!url)
    return (
      <>
        <h1>Сравнител на машини</h1>
        <p className="adm-muted">Сравнителят не е настроен. Добавете адреса му като comparator_url в конфигурационния файл на сървъра.</p>
      </>
    )
  return (
    <div className="adm-comparator">
      <div className="adm-head">
        <h1>Сравнител на машини</h1>
        <a className="adm-btn" href={url} target="_blank" rel="noreferrer">
          Отворете в нов прозорец
        </a>
      </div>
      <iframe src={url} title="Сравнител на машини" />
    </div>
  )
}

interface UserRow {
  id: number
  email: string
  name: string
  role: 'admin' | 'editor' | 'author'
  active: number
  totp_enabled: number
  last_login_at: string | null
}

const ROLES = {
  admin: 'Администратор — всичко, включително потребители',
  editor: 'Редактор — цялото съдържание, медия, меню, публикуване',
  author: 'Автор — статии в блога като чернови',
}

export function Users({ me }: { me: Me }) {
  const [rows, setRows] = useState<UserRow[]>([])
  const [error, setError] = useState('')
  const load = () => api<UserRow[]>('admin/users').then(setRows)
  useEffect(() => {
    load()
  }, [])
  const act = async (id: number, body: object, confirmText?: string) => {
    if (confirmText && !confirm(confirmText)) return
    setError('')
    try {
      await api(`admin/users/${id}`, { method: 'PUT', body })
      load()
    } catch (e) {
      setError((e as Error).message)
    }
  }
  return (
    <>
      <h1>Потребители</h1>
      <table className="adm-table">
        <thead>
          <tr>
            <th>Име</th>
            <th>Роля</th>
            <th>2FA</th>
            <th>Последен вход</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((u) => (
            <tr key={u.id} className={u.active ? undefined : 'off'}>
              <td>
                <strong>{u.name}</strong>
                <span className="adm-url">{u.email}</span>
              </td>
              <td>
                <select value={u.role} disabled={u.id === me.user!.id} onChange={(e) => act(u.id, { role: e.target.value })} aria-label="Роля">
                  {Object.keys(ROLES).map((r) => (
                    <option key={r} value={r}>
                      {ROLES[r as keyof typeof ROLES].split(' — ')[0]}
                    </option>
                  ))}
                </select>
              </td>
              <td>{u.totp_enabled ? <span className="adm-badge published">Активна</span> : <span className="adm-badge draft">При следващ вход</span>}</td>
              <td>{fmt(u.last_login_at)}</td>
              <td className="adm-actions">
                {u.id !== me.user!.id && (
                  <>
                    <button type="button" className="adm-btn small" onClick={() => act(u.id, { reset2fa: true }, `${u.name} ще трябва да настрои 2FA наново при следващ вход. Продължаване?`)}>
                      Нулирайте 2FA
                    </button>
                    <button type="button" className="adm-btn small" onClick={() => act(u.id, { active: u.active ? 0 : 1 })}>
                      {u.active ? 'Деактивирайте' : 'Активирайте'}
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {error && <p className="adm-error">{error}</p>}
      <NewUser onDone={load} />
    </>
  )
}

function NewUser({ onDone }: { onDone(): void }) {
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  return (
    <form
      className="adm-card adm-form"
      onSubmit={async (e) => {
        e.preventDefault()
        const form = e.currentTarget
        setError('')
        try {
          await api('admin/users', { body: Object.fromEntries(new FormData(form)) })
          setOk('Потребителят е създаден. Изпратете му временната парола по сигурен канал — при първия вход ще настрои двуфакторния вход.')
          form.reset()
          onDone()
        } catch (err) {
          setError((err as Error).message)
        }
      }}
    >
      <h2>Нов потребител</h2>
      <div className="adm-grid">
        <label>
          Име
          <input name="name" required />
        </label>
        <label>
          Имейл
          <input name="email" type="email" required />
        </label>
        <label>
          Роля
          <select name="role" defaultValue="editor">
            {Object.entries(ROLES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label>
          Временна парола (поне 12 знака)
          <input name="password" type="text" minLength={12} required autoComplete="off" />
        </label>
      </div>
      {error && <p className="adm-error">{error}</p>}
      {ok && <p className="adm-ok">{ok}</p>}
      <button className="adm-btn primary">Създайте потребител</button>
    </form>
  )
}

export function Audit() {
  const [rows, setRows] = useState<Record<string, string>[]>([])
  useEffect(() => {
    api<Record<string, string>[]>('admin/audit').then(setRows)
  }, [])
  return (
    <>
      <h1>Дневник на действията</h1>
      <table className="adm-table compact">
        <thead>
          <tr>
            <th>Време</th>
            <th>Потребител</th>
            <th>Действие</th>
            <th>Обект</th>
            <th>IP</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{fmt(r.created_at)}</td>
              <td>{r.user_name ?? '—'}</td>
              <td>{r.action}</td>
              <td>{r.target}</td>
              <td>{r.ip}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

export function Account() {
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  const [codes, setCodes] = useState<string[] | null>(null)
  return (
    <>
      <h1>Моят профил</h1>
      <form
        className="adm-card adm-form"
        onSubmit={async (e) => {
          e.preventDefault()
          const form = e.currentTarget
          const d = Object.fromEntries(new FormData(form)) as Record<string, string>
          setError('')
          setMsg('')
          if (d.password !== d.password2) return setError('Новите пароли не съвпадат.')
          try {
            await api('account/password', { body: d })
            setMsg('Паролата е сменена.')
            form.reset()
          } catch (err) {
            setError((err as Error).message)
          }
        }}
      >
        <h2>Смяна на парола</h2>
        <label>
          Текуща парола
          <input name="current" type="password" required autoComplete="current-password" />
        </label>
        <label>
          Нова парола (поне 12 знака)
          <input name="password" type="password" minLength={12} required autoComplete="new-password" />
        </label>
        <label>
          Повторете новата парола
          <input name="password2" type="password" minLength={12} required autoComplete="new-password" />
        </label>
        {error && <p className="adm-error">{error}</p>}
        {msg && <p className="adm-ok">{msg}</p>}
        <button className="adm-btn primary">Сменете паролата</button>
      </form>
      <section className="adm-card">
        <h2>Резервни кодове за 2FA</h2>
        <p className="adm-muted">Генерирането на нови кодове прави старите невалидни.</p>
        {codes ? (
          <ul className="adm-codes">
            {codes.map((c) => (
              <li key={c}>
                <code>{c}</code>
              </li>
            ))}
          </ul>
        ) : (
          <button
            type="button"
            className="adm-btn"
            onClick={async () => {
              if (!confirm('Старите резервни кодове ще спрат да работят. Продължаване?')) return
              setCodes((await api<{ recoveryCodes: string[] }>('account/recovery-codes', { method: 'POST' })).recoveryCodes)
            }}
          >
            Генерирайте нови кодове
          </button>
        )}
      </section>
    </>
  )
}
