import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api'
import { TYPE_LABELS } from '../edit/blockDefs'
import { loadPages, type PageRef } from '../edit/PageLinkInput'
import type { Me } from '../types'
import { KINDS, fmtDate, type Kind } from './kinds'

type Status = '' | 'published' | 'draft'

// Страниците се показват като дърво: родителят, после децата му с „— “ отпред.
const treeKey = (p: PageRef) => p.path.split('/').join('\u0001')

/** Списък като „Всички страници“ в WordPress: филтри по състояние, търсене, действия при посочване на реда. */
export default function ContentTable({ me }: { me: Me }) {
  const kind = (useParams().kind ?? 'pages') as Kind
  const k = KINDS[kind] ?? KINDS.pages
  const [all, setAll] = useState<PageRef[] | null>(null)
  const [status, setStatus] = useState<Status>('')
  const [lang, setLang] = useState<'' | 'bg' | 'en'>('')
  const [q, setQ] = useState('')
  const [error, setError] = useState('')
  const canDelete = me.user!.permissions.includes('publish')

  const load = () =>
    loadPages(true)
      .then(setAll)
      .catch((e) => setError((e as Error).message))
  useEffect(() => {
    load()
    setStatus('')
    setQ('')
  }, [kind])

  const ofKind = useMemo(() => (all ?? []).filter((p) => (k.types as readonly string[]).includes(p.type) && (!lang || p.lang === lang)), [all, k, lang])
  const rows = useMemo(() => {
    const list = ofKind.filter((p) => (!status || p.status === status) && (!q || `${p.title} ${p.url}`.toLowerCase().includes(q.toLowerCase())))
    return kind === 'pages'
      ? list.sort((a, b) => (a.lang === b.lang ? (treeKey(a) < treeKey(b) ? -1 : 1) : a.lang < b.lang ? -1 : 1))
      : list.sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? ''))
  }, [ofKind, status, q, kind])
  const count = (s: Status) => ofKind.filter((p) => !s || p.status === s).length

  async function remove(p: PageRef) {
    if (!confirm(`Да изтрия ли „${p.title}“ окончателно? Ако адресът е в Google, добавете пренасочване (Настройки → Пренасочвания).`)) return
    try {
      await api(`admin/pages/${p.id}`, { method: 'DELETE' })
      load()
    } catch (e) {
      setError(`„${p.title}“ не е изтрита: ${(e as Error).message}`)
    }
  }

  return (
    <div className="wrap-wp">
      <div className="wp-heading">
        <h1>{k.label}</h1>
        <Link className="wp-btn" to={`/admin/new/${kind}`}>
          {k.add}
        </Link>
      </div>
      {error && <div className="wp-notice error"><p>{error}</p></div>}
      <div className="wp-tablenav">
        <ul className="wp-subsubsub">
          {(
            [
              ['', 'Всички'],
              ['published', 'Публикувани'],
              ['draft', 'Чернови'],
            ] as const
          ).map(([s, label], i) => (
            <li key={s}>
              {i > 0 && ' | '}
              <button type="button" className={status === s ? 'current' : undefined} aria-pressed={status === s} onClick={() => setStatus(s)}>
                {label} <span className="count">({count(s)})</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="wp-tablenav-right">
          <select value={lang} onChange={(e) => setLang(e.target.value as typeof lang)} aria-label="Език">
            <option value="">Всички езици</option>
            <option value="bg">Български</option>
            <option value="en">English</option>
          </select>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={k.search} aria-label={k.search} />
        </div>
      </div>
      <table className="wp-list">
        <thead>
          <tr>
            <th scope="col" className="col-title">Заглавие</th>
            {kind === 'pages' && <th scope="col">Вид</th>}
            <th scope="col">Език</th>
            <th scope="col">Дата</th>
          </tr>
        </thead>
        <tbody>
          {all === null && (
            <tr>
              <td colSpan={4}>Зареждане…</td>
            </tr>
          )}
          {all !== null && rows.length === 0 && (
            <tr>
              <td colSpan={4}>{q || status ? 'Нищо не отговаря на филтъра.' : k.empty}</td>
            </tr>
          )}
          {rows.map((p) => {
            const depth = kind === 'pages' && p.path !== '' ? p.path.split('/').length - 1 : 0
            return (
              <tr key={p.id}>
                <td className="col-title">
                  <strong>
                    <Link to={`/admin/edit/${p.id}`} className="row-title">
                      {'— '.repeat(depth)}
                      {p.path === '' ? `${p.title} (начална)` : p.title}
                    </Link>
                    {p.status === 'draft' && <span className="post-state"> — Чернова</span>}
                  </strong>
                  <div className="row-actions">
                    <Link to={`/admin/edit/${p.id}`}>Редактиране</Link>
                    {kind === 'pages' && (
                      <>
                        {' | '}
                        <Link to={`/admin/new/pages?parent=${encodeURIComponent(p.path)}&lang=${p.lang}`}>Подстраница</Link>
                      </>
                    )}
                    {' | '}
                    <a href={p.url} target="_blank" rel="noopener">
                      Преглед
                    </a>
                    {canDelete && p.path !== '' && (
                      <>
                        {' | '}
                        <button type="button" className="delete" onClick={() => remove(p)}>
                          Изтриване
                        </button>
                      </>
                    )}
                  </div>
                </td>
                {kind === 'pages' && <td>{TYPE_LABELS[p.type]}</td>}
                <td>{p.lang === 'bg' ? 'BG' : 'EN'}</td>
                <td className="col-date">
                  {p.status === 'published' ? 'Публикувана' : 'Последна промяна'}
                  <br />
                  {fmtDate(p.status === 'published' ? (p.published_at ?? p.updated_at) : p.updated_at)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="wp-count">{rows.length} {rows.length === 1 ? 'елемент' : 'елемента'}</p>
      {kind === 'pages' && (
        <p className="wp-help">
          Подредбата в главното меню се променя от <Link to="/admin/menus">Външен вид → Меню</Link>.
        </p>
      )}
    </div>
  )
}
