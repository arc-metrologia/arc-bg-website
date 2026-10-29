import { useEffect, useState } from 'react'
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import QRCode from 'qrcode'
import { api, me as fetchMe } from '../api'
import type { Me } from '../types'
import MediaLibrary from '../edit/MediaLibrary'
import { Account, Audit, Comparator, ContentList, Messages, Settings, Users } from './pages'
import PageEditor from './PageEditor'
import Appearance from './Appearance'
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

function Shell({ me }: { me: Me }) {
  const u = me.user!
  const can = (p: string) => u.permissions.includes(p)
  const full = useLocation().pathname.startsWith('/admin/pages')
  const links = [
    { to: 'pages', label: 'Страници', show: can('posts') },
    { to: 'content', label: 'Списък на съдържанието', show: can('posts') },
    { to: 'media', label: 'Медия', show: can('media') },
    { to: 'messages', label: 'Запитвания', show: can('messages') },
    { to: 'settings', label: 'Фирма и меню', show: can('settings') },
    { to: 'appearance', label: 'Външен вид', show: can('settings') },
    { to: 'comparator', label: 'Сравнител', show: can('content') },
    { to: 'users', label: 'Потребители', show: can('users') },
    { to: 'audit', label: 'Дневник', show: can('audit') },
    { to: 'account', label: 'Моят профил', show: true },
  ]
  return (
    <div className="adm">
      <aside className="adm-side">
        <a href="/" className="adm-brand">
          <img src="/logo-arc-white.svg" alt="" width={60} height={32} />
          <span>Към сайта</span>
        </a>
        <nav aria-label="Администрация">
          {links
            .filter((l) => l.show)
            .map((l) => (
              <NavLink key={l.to} to={`/admin/${l.to}`}>
                {l.label}
              </NavLink>
            ))}
        </nav>
        <div className="adm-user">
          <strong>{u.name}</strong>
          <span>{ROLE_LABEL[u.role]}</span>
          <button
            type="button"
            className="adm-link"
            onClick={async () => {
              await api('auth/logout', { method: 'POST' })
              location.href = '/admin'
            }}
          >
            Изход
          </button>
        </div>
      </aside>
      <main className={`adm-main${full ? ' full' : ''}`}>
        <Routes>
          <Route index element={<Navigate to="/admin/pages" replace />} />
          <Route path="pages" element={<PageEditor me={me} />} />
          <Route path="pages/:id" element={<PageEditor me={me} />} />
          <Route path="appearance" element={<Appearance />} />
          <Route path="content" element={<ContentList me={me} />} />
          <Route
            path="media"
            element={
              <>
                <h1>Медийна библиотека</h1>
                <MediaLibrary canDelete={can('publish')} />
              </>
            }
          />
          <Route path="messages" element={<Messages />} />
          <Route path="settings" element={<Settings />} />
          <Route path="comparator" element={<Comparator />} />
          <Route path="users" element={<Users me={me} />} />
          <Route path="audit" element={<Audit />} />
          <Route path="account" element={<Account />} />
          <Route path="*" element={<Navigate to="/admin/pages" replace />} />
        </Routes>
      </main>
    </div>
  )
}
