import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { loadPages, type PageRef } from '../edit/PageLinkInput'
import type { Me } from '../types'
import Icon from './icons'
import { KINDS, fmtDate, kindOf, type Kind } from './kinds'

interface Message {
  id: string
  name: string
  company: string
  email: string
  body: string
  created_at: string
}

/** Табло: накратко, последни чернови и запитвания, бързи връзки — като таблото на WordPress. */
export default function Dashboard({ me }: { me: Me }) {
  const u = me.user!
  const can = (p: string) => u.permissions.includes(p)
  const [pages, setPages] = useState<PageRef[] | null>(null)
  const [messages, setMessages] = useState<Message[] | null>(null)

  useEffect(() => {
    loadPages(true)
      .then(setPages)
      .catch(() => setPages([]))
    if (can('messages'))
      api<Message[]>('admin/messages')
        .then(setMessages)
        .catch(() => setMessages([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const home = pages?.find((p) => p.path === '' && p.lang === 'bg')
  const drafts = (pages ?? []).filter((p) => p.status === 'draft').sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 5)
  const visibleKinds = (Object.keys(KINDS) as Kind[]).filter((k) => can(KINDS[k].perm))

  return (
    <div className="wrap-wp">
      <h1>Табло</h1>
      <section className="wp-welcome">
        <h2>Здравейте, {u.name.split(' ')[0]}</h2>
        <p>Оттук управлявате съдържанието на arc-bg.com. Промените стават видими за посетителите, когато ги публикувате.</p>
        <div className="wp-welcome-cols">
          <div>
            <h3>Първи стъпки</h3>
            {home && can('content') ? (
              <Link className="wp-btn primary hero" to={`/admin/edit/${home.id}`}>
                Редактиране на началната страница
              </Link>
            ) : (
              <Link className="wp-btn primary hero" to="/admin/new/posts">
                Добавяне на новина
              </Link>
            )}
            <p>
              или <a href="/">вижте сайта</a>
            </p>
          </div>
          <div>
            <h3>Добавяне</h3>
            <ul className="wp-welcome-links">
              {visibleKinds.map((k) => (
                <li key={k}>
                  <Link to={`/admin/new/${k}`}>
                    <Icon name={k} /> {KINDS[k].add}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          {can('settings') && (
            <div>
              <h3>Още действия</h3>
              <ul className="wp-welcome-links">
                <li>
                  <Link to="/admin/menus">
                    <Icon name="menu" /> Подредба на менюто
                  </Link>
                </li>
                <li>
                  <Link to="/admin/appearance">
                    <Icon name="appearance" /> Цветове на сайта
                  </Link>
                </li>
                <li>
                  <Link to="/admin/settings">
                    <Icon name="settings" /> Данни за фирмата
                  </Link>
                </li>
              </ul>
            </div>
          )}
        </div>
      </section>

      <div className="wp-dash">
        <section className="wp-postbox">
          <h2>Накратко</h2>
          <ul className="wp-glance">
            {visibleKinds.map((k) => {
              const list = (pages ?? []).filter((p) => kindOf(p.type) === k)
              const d = list.filter((p) => p.status === 'draft').length
              return (
                <li key={k}>
                  <Link to={`/admin/content/${k}`}>
                    <Icon name={k} /> {list.length} {KINDS[k].label.toLowerCase()}
                  </Link>
                  {d > 0 && <span className="wp-muted"> ({d} {d === 1 ? 'чернова' : 'чернови'})</span>}
                </li>
              )
            })}
          </ul>
        </section>

        <section className="wp-postbox">
          <h2>Чернови</h2>
          {pages === null ? (
            <p>Зареждане…</p>
          ) : drafts.length === 0 ? (
            <p className="wp-muted">Няма чернови. Всичко е публикувано.</p>
          ) : (
            <ul className="wp-activity">
              {drafts.map((p) => (
                <li key={p.id}>
                  <Link to={`/admin/edit/${p.id}`}>{p.title}</Link>
                  <span className="wp-muted">
                    {KINDS[kindOf(p.type)].label}, {fmtDate(p.updated_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {can('messages') && (
          <section className="wp-postbox">
            <h2>Последни запитвания</h2>
            {messages === null ? (
              <p>Зареждане…</p>
            ) : messages.length === 0 ? (
              <p className="wp-muted">Още няма запитвания от формата за контакт.</p>
            ) : (
              <ul className="wp-activity">
                {messages.slice(0, 5).map((m) => (
                  <li key={m.id}>
                    <Link to="/admin/messages">
                      {m.name}
                      {m.company && `, ${m.company}`}
                    </Link>
                    <span className="wp-muted">{fmtDate(m.created_at)}</span>
                    <span className="wp-excerpt">{m.body.slice(0, 120)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </div>
  )
}
