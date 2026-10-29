import { useEffect, useId, useState } from 'react'
import { api } from '../api'
import type { Lang, PageType } from '../types'

export interface PageRef {
  id: number
  type: PageType
  lang: Lang
  path: string
  url: string
  title: string
  status: 'draft' | 'published'
  updated_at: string
  sort_order: number
}

let cache: Promise<PageRef[]> | null = null

/** Всички страници (за подсказки и дървото в админа). Кешира се до следващото fresh зареждане. */
export function loadPages(fresh = false): Promise<PageRef[]> {
  if (!cache || fresh)
    cache = api<PageRef[]>('admin/pages').catch((e) => {
      cache = null
      throw e
    })
  return cache
}

export function usePages(lang?: Lang) {
  const [pages, setPages] = useState<PageRef[]>([])
  useEffect(() => {
    loadPages()
      .then((all) => setPages(lang ? all.filter((p) => p.lang === lang) : all))
      .catch(() => setPages([]))
  }, [lang])
  return pages
}

interface Props {
  value: string
  onChange(v: string): void
  lang?: Lang
  placeholder?: string
  autoFocus?: boolean
  'aria-label'?: string
  onBlur?(): void
  onEnter?(): void
}

/** Поле за адрес с подсказки от страниците на сайта. Приема и външни адреси, имейл и телефон. */
export default function PageLinkInput({ value, onChange, lang, placeholder = 'Започнете да пишете име на страница или https://…', autoFocus, onBlur, onEnter, ...rest }: Props) {
  const listId = useId()
  const pages = usePages(lang)
  const match = pages.find((p) => p.url === value)
  // Ако е въведено име на страница вместо адрес, го заменяме с адреса ѝ.
  const commit = (v: string) => {
    const byTitle = pages.find((p) => p.title.toLowerCase() === v.trim().toLowerCase())
    onChange(byTitle ? byTitle.url : v)
  }
  return (
    <span className="page-link">
      <input
        list={listId}
        value={value}
        placeholder={placeholder}
        autoFocus={autoFocus}
        aria-label={rest['aria-label']}
        onChange={(e) => commit(e.target.value)}
        onBlur={onBlur}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && onEnter) {
            e.preventDefault()
            onEnter()
          }
        }}
      />
      <datalist id={listId}>
        {pages.map((p) => (
          <option key={p.id} value={p.url}>
            {p.title}
            {p.status === 'draft' ? ' (чернова)' : ''}
          </option>
        ))}
      </datalist>
      {match && <small className="page-link-hint">→ {match.title}</small>}
    </span>
  )
}
