import { useEffect, useState } from 'react'
import { NavLink, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom'
import QRCode from 'qrcode'
import { api, me as fetchMe } from '../api'
import type { Me } from '../types'
import MediaLibrary from '../edit/MediaLibrary'
import { Account, Audit, Company, Comparator, Menus, Messages, NewPage, Redirects, Users } from './pages'
import Appearance from './Appearance'
import ContentTable from './ContentTable'
import Dashboard from './Dashboard'
import EditScreen from './EditScreen'
import Icon, { type IconName } from './icons'
import { KINDS, type Kind } from './kinds'
import { useScheme } from './scheme'
import '../styles/admin.css'

export default function AdminApp() {
  const [me, setMe] = useState<Me | null>(null)
  const [error, setError] = useState('')
  const refresh = () =>
    fetchMe()
      .then(setMe)
      .catch((e) => setError(e.message))
  useEffect(() => {
    refresh()
  }, [])

  if (error) return <div className="adm-auth"><p className="adm-error">{error}</p></div>
  if (!me) return <div className="adm-loading">Зареждане…</div>
  if (me.setupRequired) return <Setup onDone={refresh} />
  if (me.stage === 'none') return <Login onDone={refresh} />
  if (me.stage === '2fa') return <SecondFactor onDone={refresh} />
  if (me.stage === 'enroll') return <Enroll onDone={refresh} />
  return <Shell me={me} />
}

function AuthBox({ title, children, lead }: { title: string; lead?: string; children: React.ReactNode }) {
  return (
    <div className="adm-auth">
      <div className="adm-auth-box">
        <img src="/logo-arc.svg" alt="АРК Метрология" width={90} height={48} />
        <h1>{title}</h1>
        {lead && <p className="lead">{lead}</p>}
        {children}
      </div>
    </div>
  )
}

function useSubmit(fn: (data: Record<string, string>) => Promise<void>) {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await fn(Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return { onSubmit, error, busy }
}

function Login({ onDone }: { onDone(): void }) {
  const f = useSubmit(async (d) => {
    await api('auth/login', { body: d })
    onDone()
  })
  return (
    <AuthBox title="Вход за редактори">
      <form onSubmit={f.onSubmit} className="adm-form">
        <label>
          Имейл
          <input name="email" type="email" autoComplete="username" required autoFocus />
        </label>
        <label>
          Парола
          <input name="password" type="password" autoComplete="current-password" required />
        </label>
        {f.error && <p className="adm-error" role="alert">{f.error}</p>}
        <button className="adm-btn primary" disabled={f.busy}>
          Продължете
        </button>
      </form>
    </AuthBox>
  )
}

function SecondFactor({ onDone }: { onDone(): void }) {
  const [recovery, setRecovery] = useState(false)
  const f = useSubmit(async (d) => {
    await api('auth/2fa', { body: d })
    onDone()
  })
  return (
    <AuthBox title="Двуфакторна проверка" lead={recovery ? 'Въведете един от резервните си кодове. Всеки код работи само веднъж.' : 'Въведете 6-цифрения код от приложението за удостоверяване на телефона си.'}>
      <form onSubmit={f.onSubmit} className="adm-form">
        <label>
          {recovery ? 'Резервен код' : 'Код'}
          <input
            name="code"
            required
            autoFocus
            autoComplete="one-time-code"
            inputMode={recovery ? 'text' : 'numeric'}
            pattern={recovery ? '[a-f0-9]{8}-[a-f0-9]{8}' : '\\d{6}'}
            maxLength={recovery ? 17 : 6}
            className="adm-code"
          />
        </label>
        {f.error && <p className="adm-error" role="alert">{f.error}</p>}
        <button className="adm-btn primary" disabled={f.busy}>
          Влезте
        </button>
        <button type="button" className="adm-link" onClick={() => setRecovery(!recovery)}>
          {recovery ? 'Използвайте кода от приложението' : 'Нямам достъп до телефона си'}
        </button>
      </form>
    </AuthBox>
  )
}

function Enroll({ onDone }: { onDone(): void }) {
  const [setup, setSetup] = useState<{ secret: string; uri: string; qr: string } | null>(null)
  const [codes, setCodes] = useState<string[] | null>(null)
  useEffect(() => {
    api<{ secret: string; uri: string }>('auth/enroll/start', { method: 'POST' }).then(async (s) => setSetup({ ...s, qr: await QRCode.toDataURL(s.uri, { margin: 1, width: 220 }) }))
  }, [])
  const f = useSubmit(async (d) => {
    const r = await api<{ recoveryCodes: string[] }>('auth/enroll/confirm', { body: d })
    setCodes(r.recoveryCodes)
  })
  if (codes) return <RecoveryCodes codes={codes} onDone={onDone} />
  return (
    <AuthBox title="Настройте двуфакторен вход" lead="Двуфакторният вход е задължителен за всички редактори. Ще ви трябва приложение като Google Authenticator, Microsoft Authenticator или 1Password.">
      <ol className="adm-steps">
        <li>Отворете приложението и сканирайте кода.</li>
        <li>Въведете 6-цифрения код, който приложението показва.</li>
      </ol>
      {setup ? (
        <>
          <img className="adm-qr" src={setup.qr} alt="QR код за приложението за удостоверяване" width={220} height={220} />
          <details className="adm-secret">
            <summary>Не мога да сканирам</summary>
            <p>Въведете ръчно този ключ:</p>
            <code>{setup.secret.match(/.{1,4}/g)?.join(' ')}</code>
          </details>
        </>
      ) : (
        <p>Генериране…</p>
      )}
      <form onSubmit={f.onSubmit} className="adm-form">
        <label>
          Код от приложението
          <input name="code" required inputMode="numeric" pattern="\d{6}" maxLength={6} autoComplete="one-time-code" className="adm-code" />
        </label>
        {f.error && <p className="adm-error" role="alert">{f.error}</p>}
        <button className="adm-btn primary" disabled={f.busy || !setup}>
          Потвърдете
        </button>
      </form>
    </AuthBox>
  )
}

export function RecoveryCodes({ codes, onDone }: { codes: string[]; onDone(): void }) {
  const [saved, setSaved] = useState(false)
  return (
    <AuthBox title="Запазете резервните кодове" lead="Ако загубите телефона си, ще влезете с един от тези кодове. Всеки работи само веднъж. Показват се само сега.">
      <ul className="adm-codes">
        {codes.map((c) => (
          <li key={c}>
            <code>{c}</code>
          </li>
        ))}
      </ul>
      <div className="adm-row">
        <button type="button" className="adm-btn" onClick={() => navigator.clipboard.writeText(codes.join('\n'))}>
          Копирайте
        </button>
        <button
          type="button"
          className="adm-btn"
          onClick={() => {
            const a = document.createElement('a')
            a.href = URL.createObjectURL(new Blob([codes.join('\n') + '\n'], { type: 'text/plain' }))
            a.download = 'arc-rezervni-kodove.txt'
            a.click()
          }}
        >
          Изтеглете
        </button>
      </div>
      <label className="adm-check">
        <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} /> Запазих кодовете на сигурно място
      </label>
      <button type="button" className="adm-btn primary" disabled={!saved} onClick={onDone}>
        Продължете към админ панела
      </button>
    </AuthBox>
  )
}

function Setup({ onDone }: { onDone(): void }) {
  const f = useSubmit(async (d) => {
    if (d.password !== d.password2) throw new Error('Паролите не съвпадат.')
    await api('setup', { body: d })
    onDone()
  })
  return (
    <AuthBox title="Първоначална настройка" lead="Създайте първия администратор. Нужен е setup токенът от конфигурационния файл на сървъра.">
      <form onSubmit={f.onSubmit} className="adm-form">
        <label>
          Setup токен
          <input name="token" required autoComplete="off" />
        </label>
        <label>
          Име
          <input name="name" required autoComplete="name" />
        </label>
        <label>
          Имейл
          <input name="email" type="email" required autoComplete="username" />
        </label>
        <label>
          Парола (поне 12 знака)
          <input name="password" type="password" minLength={12} required autoComplete="new-password" />
        </label>
        <label>
          Повторете паролата
          <input name="password2" type="password" minLength={12} required autoComplete="new-password" />
        </label>
        {f.error && <p className="adm-error" role="alert">{f.error}</p>}
        <button className="adm-btn primary" disabled={f.busy}>
          Създайте администратор
        </button>
      </form>
    </AuthBox>
  )
}

const ROLE_LABEL = { admin: 'Администратор', editor: 'Редактор', author: 'Автор' }

interface MenuItem {
  to: string
  label: string
  icon: IconName
  show: boolean
  /** Други адреси, при които точката е отворена (напр. /admin/new/posts за „Новини“). */
  match?: string[]
  sub?: { to: string; label: string; show?: boolean }[]
}

/** Рамката на админа като в WordPress: горна лента, тъмно меню вляво, съдържанието вдясно. */
function Shell({ me }: { me: Me }) {
  const u = me.user!
  const can = (p: string) => u.permissions.includes(p)
  const { pathname } = useLocation()
  const [scheme] = useScheme(u.id)
  const [folded, setFolded] = useState(() => {
    try {
      return localStorage.getItem('arc-admin-folded') === '1'
    } catch {
      return false
    }
  })
  const [mobileOpen, setMobileOpen] = useState(false)
  const [newOpen, setNewOpen] = useState(false)
  useEffect(() => {
    setMobileOpen(false)
    setNewOpen(false)
  }, [pathname])

  const kindMenu = (k: Kind, icon: IconName): MenuItem => ({
    to: `content/${k}`,
    label: KINDS[k].label,
    icon,
    show: can(KINDS[k].perm),
    match: [`new/${k}`],
    sub: [
      { to: `content/${k}`, label: KINDS[k].all },
      { to: `new/${k}`, label: KINDS[k].add },
    ],
  })
  const menu: MenuItem[] = [
    { to: 'dashboard', label: 'Табло', icon: 'dashboard', show: true },
    kindMenu('posts', 'posts'),
    kindMenu('products', 'products'),
    kindMenu('services', 'services'),
    kindMenu('pages', 'pages'),
    { to: 'media', label: 'Медия', icon: 'media', show: can('media') },
    { to: 'messages', label: 'Запитвания', icon: 'messages', show: can('messages') },
    {
      to: 'menus',
      label: 'Външен вид',
      icon: 'appearance',
      show: can('settings'),
      match: ['appearance'],
      sub: [
        { to: 'menus', label: 'Меню' },
        { to: 'appearance', label: 'Цветове на сайта' },
      ],
    },
    {
      to: can('users') ? 'users' : 'account',
      label: can('users') ? 'Потребители' : 'Профил',
      icon: 'users',
      show: true,
      match: ['account'],
      sub: can('users')
        ? [
            { to: 'users', label: 'Всички потребители' },
            { to: 'account', label: 'Профил' },
          ]
        : undefined,
    },
    {
      to: can('content') ? 'comparator' : 'audit',
      label: 'Инструменти',
      icon: 'tools',
      show: can('content') || can('audit'),
      match: ['audit'],
      sub: [
        { to: 'comparator', label: 'Сравнител', show: can('content') },
        { to: 'audit', label: 'Дневник', show: can('audit') },
      ],
    },
    {
      to: 'settings',
      label: 'Настройки',
      icon: 'settings',
      show: can('settings'),
      match: ['redirects'],
      sub: [
        { to: 'settings', label: 'Данни за фирмата' },
        { to: 'redirects', label: 'Пренасочвания' },
      ],
    },
  ]
  const here = pathname.replace(/^\/admin\/?/, '')
  const isOn = (to: string) => here === to || here.startsWith(to + '/')
  const isOpen = (m: MenuItem) => isOn(m.to) || (m.match ?? []).some(isOn) || (m.sub ?? []).some((s) => isOn(s.to))

  // Редакторът е на цял екран, както в новия WordPress.
  if (here.startsWith('edit/'))
    return (
      <div className={`wp scheme-${scheme}`}>
        <Routes>
          <Route path="edit/:id" element={<EditScreen me={me} />} />
        </Routes>
      </div>
    )

  const toggleFold = () => {
    setFolded(!folded)
    try {
      localStorage.setItem('arc-admin-folded', folded ? '0' : '1')
    } catch {
      /* само за тази сесия */
    }
  }
  const addables = (Object.keys(KINDS) as Kind[]).filter((k) => can(KINDS[k].perm))

  return (
    <div className={`wp scheme-${scheme}${folded ? ' folded' : ''}${mobileOpen ? ' menu-open' : ''}`}>
      <header className="wp-adminbar">
        <button type="button" className="wp-adminbar-menu" aria-label="Меню" aria-expanded={mobileOpen} onClick={() => setMobileOpen(!mobileOpen)}>
          <Icon name="menu" />
        </button>
        <a href="/" className="wp-adminbar-site">
          <Icon name="site" />
          <span>АРК Метрология</span>
        </a>
        <div className="wp-adminbar-new">
          <button type="button" aria-expanded={newOpen} onClick={() => setNewOpen(!newOpen)}>
            <Icon name="plus" />
            <span>Нов</span>
          </button>
          {newOpen && (
            <ul onMouseLeave={() => setNewOpen(false)}>
              {addables.map((k) => (
                <li key={k}>
                  <NavLink to={`/admin/new/${k}`}>{KINDS[k].add.replace(/^Добавяне на /, '').replace(/^./, (c) => c.toUpperCase())}</NavLink>
                </li>
              ))}
              {can('media') && (
                <li>
                  <NavLink to="/admin/media">Медия</NavLink>
                </li>
              )}
            </ul>
          )}
        </div>
        <div className="wp-adminbar-user">
          <span>
            Здравейте, <strong>{u.name}</strong>
          </span>
          <ul>
            <li className="wp-adminbar-role">{ROLE_LABEL[u.role]}</li>
            <li>
              <NavLink to="/admin/account">Профил</NavLink>
            </li>
            <li>
              <button
                type="button"
                onClick={async () => {
                  await api('auth/logout', { method: 'POST' })
                  location.href = '/admin'
                }}
              >
                Изход
              </button>
            </li>
          </ul>
        </div>
      </header>

      <nav className="wp-menu" aria-label="Администрация">
        <ul>
          {menu
            .filter((m) => m.show)
            .map((m) => {
              const open = isOpen(m)
              const subs = (m.sub ?? []).filter((s) => s.show !== false)
              return (
                <li key={m.label} className={`${open ? 'current' : ''}${subs.length ? ' has-sub' : ''}`}>
                  <NavLink to={`/admin/${m.to}`} className="wp-menu-top" aria-current={open ? 'page' : undefined} title={folded ? m.label : undefined}>
                    <Icon name={m.icon} />
                    <span className="wp-menu-name">{m.label}</span>
                  </NavLink>
                  {subs.length > 0 && (
                    <ul className="wp-submenu">
                      <li className="wp-submenu-head">{m.label}</li>
                      {subs.map((s) => (
                        <li key={s.to}>
                          <NavLink to={`/admin/${s.to}`} end>
                            {s.label}
                          </NavLink>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              )
            })}
        </ul>
        <button type="button" className="wp-menu-fold" onClick={toggleFold} aria-pressed={folded}>
          <Icon name="collapse" />
          <span className="wp-menu-name">{folded ? 'Разгъване на менюто' : 'Свиване на менюто'}</span>
        </button>
      </nav>

      <main className={`wp-body${here.startsWith('comparator') ? ' full' : ''}`}>
        <Routes>
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard me={me} />} />
          <Route path="content/:kind" element={<ContentTable me={me} />} />
          <Route path="new/:kind" element={<NewPage key={pathname} me={me} />} />
          {/* стари адреси от предишния админ */}
          <Route path="pages/:id" element={<RedirectEdit />} />
          <Route path="pages" element={<Navigate to="/admin/content/pages" replace />} />
          <Route path="content" element={<Navigate to="/admin/content/pages" replace />} />
          <Route
            path="media"
            element={
              <div className="wrap-wp">
                <h1>Медия</h1>
                <MediaLibrary canDelete={can('publish')} />
              </div>
            }
          />
          <Route path="messages" element={<Messages />} />
          <Route path="menus" element={<Menus />} />
          <Route path="appearance" element={<Appearance />} />
          <Route path="settings" element={<Company />} />
          <Route path="redirects" element={<Redirects />} />
          <Route path="comparator" element={<Comparator />} />
          <Route path="users" element={<Users me={me} />} />
          <Route path="audit" element={<Audit />} />
          <Route path="account" element={<Account me={me} />} />
          <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
        </Routes>
      </main>
      <div className="wp-menu-backdrop" onClick={() => setMobileOpen(false)} />
    </div>
  )
}

function RedirectEdit() {
  return <Navigate to={`/admin/edit/${useParams().id}`} replace />
}
