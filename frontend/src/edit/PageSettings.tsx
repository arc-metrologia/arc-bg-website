import { useEffect, useState } from 'react'
import { api, slugify } from '../api'
import type { Media, Page } from '../types'
import { TYPE_LABELS } from './blockDefs'

interface Row {
  id: number
  type: Page['type']
  lang: string
  title: string
  url: string
}

interface Props {
  page: Page
  media: Record<number, Media>
  onChange(p: Partial<Page>): void
  pickMedia(kind: Media['kind']): Promise<Media[]>
  /** Без onClose (в страничния панел на админа) няма заглавие и бутон за затваряне. */
  onClose?(): void
  className?: string
}

function Counter({ value, ideal }: { value: string; ideal: [number, number] }) {
  const n = value.length
  const state = n === 0 ? 'empty' : n < ideal[0] ? 'short' : n > ideal[1] ? 'long' : 'ok'
  const hint = { empty: 'празно — ползва се текстът по подразбиране', short: 'кратко', long: 'ще бъде отрязано', ok: 'добре' }[state]
  return (
    <span className={`ed-count ${state}`}>
      {n} знака · {hint}
    </span>
  )
}

/** Настройки на страницата: адрес, SEO, кратко описание, снимка за споделяне, свързани страници. */
export default function PageSettings({ page, media, onChange, pickMedia, onClose, className = 'ed-drawer ed-settings' }: Props) {
  const [all, setAll] = useState<Row[]>([])
  const [q, setQ] = useState('')
  useEffect(() => {
    api<Row[]>(`admin/pages?lang=${page.lang}`).then(setAll)
  }, [page.lang])

  const seoTitle = page.metaTitle || page.title
  const seoDesc = page.metaDescription || page.excerpt
  const img = page.image ? media[page.image] : undefined
  const prefix = page.lang === 'bg' ? '/' : `/${page.lang}/`
  const candidates = all.filter((r) => r.id !== page.id && !page.related.includes(r.id) && r.title.toLowerCase().includes(q.toLowerCase())).slice(0, 8)

  return (
    <aside className={className} aria-label="Настройки на страницата">
      {onClose && (
        <div className="ed-modal-head">
          <h2>Настройки и SEO</h2>
          <button type="button" onClick={onClose} aria-label="Затвори">
            ✕
          </button>
        </div>
      )}

      <label>
        Заглавие на страницата
        <input value={page.title} onChange={(e) => onChange({ title: e.target.value })} />
      </label>
      <label>
        Адрес
        <span className="ed-path">
          <span>{prefix}</span>
          <input value={page.path} disabled={page.path === ''} onChange={(e) => onChange({ path: e.target.value.toLowerCase().replace(/[^a-z0-9/-]/g, '') })} />
        </span>
        {page.path !== '' && (
          <button type="button" className="ed-link" onClick={() => onChange({ path: [...page.path.split('/').slice(0, -1), slugify(page.title)].join('/') })}>
            Генерирайте от заглавието
          </button>
        )}
        <small>При смяна на адреса добавете пренасочване от стария (Настройки → Пренасочвания), за да не се губят посещения от Google.</small>
      </label>

      <fieldset>
        <legend>Как изглежда в Google</legend>
        <div className="serp">
          <span className="serp-url">www.arc-bg.com{page.url}</span>
          <span className="serp-title">{seoTitle.slice(0, 60)}{seoTitle.length > 60 && '…'}</span>
          <span className="serp-desc">{seoDesc.slice(0, 160)}{seoDesc.length > 160 && '…'}</span>
        </div>
        <label>
          SEO заглавие <Counter value={page.metaTitle} ideal={[30, 60]} />
          <input value={page.metaTitle} placeholder={page.title} onChange={(e) => onChange({ metaTitle: e.target.value })} />
        </label>
        <label>
          Мета описание <Counter value={page.metaDescription} ideal={[70, 160]} />
          <textarea rows={3} value={page.metaDescription} placeholder={page.excerpt} onChange={(e) => onChange({ metaDescription: e.target.value })} />
        </label>
      </fieldset>

      <label>
        Кратко описание
        <textarea rows={3} value={page.excerpt} onChange={(e) => onChange({ excerpt: e.target.value })} />
        <small>Показва се в списъците с продукти и статии и се използва от AI асистентите като резюме.</small>
      </label>

      <div className="ed-field">
        <span>Снимка за списъци и споделяне</span>
        {img && <img src={img.variants[0]?.url ?? img.url} alt="" className="ed-thumb" />}
        <div className="ed-row">
          <button
            type="button"
            className="ed-chip"
            onClick={async () => {
              const [m] = await pickMedia('image')
              if (m) onChange({ image: m.id })
            }}
          >
            {img ? 'Сменете' : 'Изберете'}
          </button>
          {img && (
            <button type="button" className="ed-link" onClick={() => onChange({ image: null })}>
              Премахнете
            </button>
          )}
        </div>
      </div>

      {page.type === 'product' && (
        <label>
          Марка
          <input value={page.extra.brand ?? ''} placeholder="HEXAGON, TESA, Sylvac…" onChange={(e) => onChange({ extra: { ...page.extra, brand: e.target.value } })} />
        </label>
      )}

      <div className="ed-field">
        <span>Свързани продукти, услуги и статии</span>
        <ul className="ed-related">
          {page.related.map((id) => {
            const r = all.find((x) => x.id === id)
            return (
              <li key={id}>
                {r ? `${r.title} (${TYPE_LABELS[r.type]})` : `#${id}`}
                <button type="button" aria-label="Премахни" onClick={() => onChange({ related: page.related.filter((x) => x !== id) })}>
                  ✕
                </button>
              </li>
            )
          })}
        </ul>
        <input type="search" placeholder="Търсете страница за добавяне…" value={q} onChange={(e) => setQ(e.target.value)} />
        {q && (
          <ul className="ed-suggest">
            {candidates.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => {
                    onChange({ related: [...page.related, r.id] })
                    setQ('')
                  }}
                >
                  {r.title} <small>{TYPE_LABELS[r.type]} · {r.url}</small>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <label>
        Ред в списъците
        <input type="number" value={page.sortOrder} onChange={(e) => onChange({ sortOrder: Number(e.target.value) })} />
      </label>
      <label>
        Ключ за превод
        <input value={page.translationKey ?? ''} placeholder="напр. calibration" onChange={(e) => onChange({ translationKey: e.target.value })} />
        <small>Еднакъв ключ на българската и английската версия ги свързва (бутонът за език и hreflang за Google).</small>
      </label>
      {onClose && <p className="ed-hint">Промените влизат в сила след „Запазете“.</p>}
    </aside>
  )
}
