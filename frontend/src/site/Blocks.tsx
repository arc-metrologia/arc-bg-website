import { useState } from 'react'
import { api } from '../api'
import { t } from '../i18n'
import type { Block, BlockOf, BlockType, Card, Media, Payload } from '../types'
import { useEdit } from './edit-context'
import { AddItem, ImageSlot, ItemTools, Rich, Text } from './editable'
import Img from './Img'

interface P<T extends BlockType> {
  block: BlockOf<T>
  payload: Payload
  set(patch: Partial<BlockOf<T>>): void
  first: boolean
}

const media = (p: Payload, id: number | null | undefined): Media | undefined => (id ? p.media[id] : undefined)

function Heading({ block, set, as = 'h2' }: { block: Block; set(p: Partial<Block>): void; as?: 'h1' | 'h2' }) {
  return <Text as={as} value={block.heading} onChange={(heading) => set({ heading })} placeholder="Заглавие на секцията" />
}

function Hero({ block, payload, set, first }: P<'hero'>) {
  const m = media(payload, block.image)
  const { editing } = useEdit()
  return (
    <div className="hero-grid">
      <div className="hero-copy">
        <Heading block={block} set={set} as={first ? 'h1' : 'h2'} />
        <Text as="p" value={block.text} onChange={(text) => set({ text })} placeholder="Кратък текст под заглавието" multiline />
        {(block.ctaLabel || editing) && (
          <a className="btn btn-primary" href={block.ctaUrl || '#'}>
            <Text value={block.ctaLabel} onChange={(ctaLabel) => set({ ctaLabel })} placeholder="Текст на бутона" />
          </a>
        )}
        {editing && <UrlField value={block.ctaUrl} onChange={(ctaUrl) => set({ ctaUrl })} />}
      </div>
      {(m || editing) && (
        <figure className="hero-figure">
          <div className="dim-frame">
            <ImageSlot media={m} onPick={(x) => set({ image: x.id })} sizes="(min-width: 900px) 50vw, 100vw" eager={first} />
          </div>
          <Text as="figcaption" className="dim-label" value={block.measure} onChange={(measure) => set({ measure })} placeholder="напр. Ø26 mm · 0,0001 mm" />
        </figure>
      )}
    </div>
  )
}

/** Поле за адрес на връзка — показва се само в режим на редакция. */
export function UrlField({ value, onChange }: { value: string; onChange(v: string): void }) {
  return (
    <label className="ed-url">
      Връзка
      <input defaultValue={value} placeholder="/kontakti или https://…" onBlur={(e) => e.target.value !== value && onChange(e.target.value.trim())} />
    </label>
  )
}

function Cards({ items, payload }: { items: Card[]; payload: Payload }) {
  const { editing } = useEdit()
  if (!items.length) return editing ? <p className="ed-hint">Списъкът се попълва автоматично след публикуване на съответните страници.</p> : null
  return (
    <ul className="cards">
      {items.map((c) => (
        <li className="card" key={c.id}>
          <a href={c.url}>
            <div className="card-media">
              <Img media={media(payload, c.image)} sizes="(min-width: 900px) 33vw, 100vw" />
            </div>
            <h3>{c.title}</h3>
            {c.excerpt && <p>{c.excerpt}</p>}
          </a>
        </li>
      ))}
    </ul>
  )
}

function YouTube({ id, title }: { id: string; title: string }) {
  const [play, setPlay] = useState(false)
  const lang = document.documentElement.lang === 'en' ? 'en' : 'bg'
  if (play)
    return (
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`}
        title={title}
        allow="accelerometer; autoplay; encrypted-media; picture-in-picture"
        allowFullScreen
      />
    )
  return (
    <button type="button" className="video-facade" onClick={() => setPlay(true)} aria-label={`${t(lang).play}: ${title}`}>
      <img src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="" loading="lazy" width={480} height={360} />
      <span className="play" aria-hidden="true" />
    </button>
  )
}

function Vimeo({ id, title }: { id: string; title: string }) {
  const [play, setPlay] = useState(false)
  if (play) return <iframe src={`https://player.vimeo.com/video/${id}?autoplay=1&dnt=1`} title={title} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />
  return (
    <button type="button" className="video-facade" onClick={() => setPlay(true)} aria-label={title}>
      <span className="play" aria-hidden="true" />
    </button>
  )
}

function parseVideo(url: string): { provider: 'youtube' | 'vimeo'; videoId: string } | null {
  const yt = url.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([A-Za-z0-9_-]{11})/)
  if (yt) return { provider: 'youtube', videoId: yt[1] }
  const vm = url.match(/vimeo\.com\/(?:video\/)?(\d+)/)
  if (vm) return { provider: 'vimeo', videoId: vm[1] }
  return null
}

function Video({ block, payload, set }: P<'video'>) {
  const { editing, pickMedia } = useEdit()
  const file = media(payload, block.media)
  const poster = media(payload, block.poster)
  const title = block.caption || block.heading || 'Видео'
  return (
    <>
      <Heading block={block} set={set} />
      <figure className="video">
        <div className="video-frame">
          {block.provider === 'youtube' && block.videoId && <YouTube id={block.videoId} title={title} />}
          {block.provider === 'vimeo' && block.videoId && <Vimeo id={block.videoId} title={title} />}
          {block.provider === 'file' && file && (
            <video controls preload="none" playsInline poster={poster?.url}>
              <source src={file.url} type={file.mime} />
            </video>
          )}
        </div>
        <Text as="figcaption" value={block.caption} onChange={(caption) => set({ caption })} placeholder="Описание на видеото (важно за търсачките)" />
      </figure>
      {editing && (
        <div className="ed-row">
          <label className="ed-url">
            YouTube или Vimeo линк
            <input
              placeholder="https://www.youtube.com/watch?v=…"
              onBlur={(e) => {
                const v = parseVideo(e.target.value)
                if (v) set({ ...v, media: null })
              }}
            />
          </label>
          <button
            type="button"
            className="ed-chip"
            onClick={async () => {
              const [m] = await pickMedia('video')
              if (m) set({ provider: 'file', media: m.id, videoId: '' })
            }}
          >
            Качено видео
          </button>
          {block.provider === 'file' && (
            <button
              type="button"
              className="ed-chip"
              onClick={async () => {
                const [m] = await pickMedia('image')
                if (m) set({ poster: m.id })
              }}
            >
              Начален кадър
            </button>
          )}
        </div>
      )}
    </>
  )
}

function ImageList({ block, payload, set, className, sizes }: P<'gallery' | 'logos'> & { className: string; sizes: string }) {
  const { editing, pickMedia } = useEdit()
  const setImages = (images: number[]) => set({ images } as Partial<BlockOf<'gallery'>>)
  return (
    <>
      <Heading block={block} set={set} />
      <ul className={className}>
        {block.images.map((id, i) => (
          <li key={`${id}-${i}`}>
            <Img media={media(payload, id)} sizes={sizes} />
            <ItemTools list={block.images} index={i} onChange={setImages} />
          </li>
        ))}
      </ul>
      {editing && (
        <button
          type="button"
          className="ed-add-item"
          onClick={async () => {
            const picked = await pickMedia('image', true)
            setImages([...block.images, ...picked.map((m) => m.id)])
          }}
        >
          + Добавете изображения
        </button>
      )}
    </>
  )
}

function Downloads({ block, payload, set }: P<'downloads'>) {
  const { editing, pickMedia } = useEdit()
  const lang = payload.site.lang
  return (
    <>
      <Heading block={block} set={set} />
      <ul className="downloads">
        {block.files.map((id, i) => {
          const m = media(payload, id)
          if (!m) return null
          return (
            <li key={id}>
              <a href={m.url} download>
                {m.title || m.name}
              </a>{' '}
              <span>
                {t(lang).download} · {m.url.split('.').pop()?.toUpperCase()}, {(m.size / 1048576).toFixed(1)} MB
              </span>
              <ItemTools list={block.files} index={i} onChange={(files) => set({ files })} />
            </li>
          )
        })}
      </ul>
      {editing && (
        <button
          type="button"
          className="ed-add-item"
          onClick={async () => {
            const picked = await pickMedia('file', true)
            set({ files: [...block.files, ...picked.map((m) => m.id)] })
          }}
        >
          + Добавете PDF
        </button>
      )}
    </>
  )
}

function ContactForm({ lang, page }: { lang: 'bg' | 'en'; page: string }) {
  const s = t(lang).form
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [error, setError] = useState('')
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setState('sending')
    setError('')
    const fd = Object.fromEntries(new FormData(e.currentTarget))
    try {
      await api('public/contact', { body: { ...fd, page } })
      setState('sent')
    } catch (err) {
      setError((err as Error).message)
      setState('idle')
    }
  }
  if (state === 'sent') return <p className="form-done" role="status">{s.sent}</p>
  return (
    <form className="contact-form" onSubmit={submit}>
      <label>
        {s.name}
        <input name="name" required autoComplete="name" />
      </label>
      <label>
        {s.company}
        <input name="company" autoComplete="organization" />
      </label>
      <label>
        {s.email}
        <input name="email" type="email" required autoComplete="email" />
      </label>
      <label>
        {s.phone}
        <input name="phone" type="tel" autoComplete="tel" />
      </label>
      <label className="full">
        {s.message}
        <textarea name="message" rows={5} required />
      </label>
      <input name="website" tabIndex={-1} autoComplete="off" className="hp" aria-hidden="true" />
      {error && (
        <p className="form-error full" role="alert">
          {error}
        </p>
      )}
      <button className="btn btn-primary" disabled={state === 'sending'}>
        {state === 'sending' ? s.sending : s.send}
      </button>
    </form>
  )
}

export function BlockView({ block, payload, set, first }: { block: Block; payload: Payload; set(p: Partial<Block>): void; first: boolean }) {
  const lang = payload.site.lang
  const info = payload.site.info
  const { editing } = useEdit()
  // Всеки клон получава правилно типизиран блок.
  const p = { block, payload, set, first } as never
  switch (block.type) {
    case 'hero':
      return <Hero {...(p as P<'hero'>)} />
    case 'richtext':
      return (
        <>
          <Heading block={block} set={set} />
          <Rich html={block.html} onChange={(html) => set({ html })} />
        </>
      )
    case 'image':
      return (
        <figure>
          <ImageSlot media={media(payload, block.image)} onPick={(m) => set({ image: m.id })} sizes="(min-width: 1200px) 1100px, 100vw" />
          <Text as="figcaption" value={block.caption} onChange={(caption) => set({ caption })} placeholder="Надпис под снимката" />
        </figure>
      )
    case 'gallery':
      return <ImageList {...(p as P<'gallery'>)} className="gallery" sizes="(min-width: 900px) 33vw, 50vw" />
    case 'logos':
      return <ImageList {...(p as P<'logos'>)} className="logos" sizes="160px" />
    case 'video':
      return <Video {...(p as P<'video'>)} />
    case 'downloads':
      return <Downloads {...(p as P<'downloads'>)} />
    case 'features':
    case 'steps': {
      const Tag = block.type === 'steps' ? 'ol' : 'ul'
      const items = block.items
      const setItems = (items: BlockOf<'features'>['items']) => set({ items })
      return (
        <>
          <Heading block={block} set={set} />
          {block.type === 'features' && <Text as="p" className="intro" value={block.intro} onChange={(intro) => set({ intro })} placeholder="Въведение (по избор)" multiline />}
          <Tag className={block.type}>
            {items.map((it, i) => (
              <li key={i}>
                <Text as="h3" value={it.title} onChange={(title) => setItems(items.map((x, j) => (j === i ? { ...x, title } : x)))} placeholder="Заглавие" />
                <Text as="p" value={it.text} onChange={(text) => setItems(items.map((x, j) => (j === i ? { ...x, text } : x)))} placeholder="Описание" multiline />
                <ItemTools list={items} index={i} onChange={setItems} />
              </li>
            ))}
          </Tag>
          <AddItem label="Добавете елемент" onClick={() => setItems([...items, { title: '', text: '' }])} />
        </>
      )
    }
    case 'faq': {
      const items = block.items
      const setItems = (items: BlockOf<'faq'>['items']) => set({ items })
      return (
        <>
          <Heading block={block} set={set} />
          <div className="faq">
            {items.map((it, i) => (
              <details key={i} open={undefined}>
                <summary>
                  <Text value={it.q} onChange={(q) => setItems(items.map((x, j) => (j === i ? { ...x, q } : x)))} placeholder="Въпрос" />
                </summary>
                <Text as="p" value={it.a} onChange={(a) => setItems(items.map((x, j) => (j === i ? { ...x, a } : x)))} placeholder="Отговор" multiline />
                <ItemTools list={items} index={i} onChange={setItems} />
              </details>
            ))}
          </div>
          <AddItem label="Добавете въпрос" onClick={() => setItems([...items, { q: '', a: '' }])} />
        </>
      )
    }
    case 'specs': {
      const rows = block.rows
      const setRows = (rows: BlockOf<'specs'>['rows']) => set({ rows })
      return (
        <>
          <Heading block={block} set={set} />
          <table className="specs">
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <th scope="row">
                    <Text value={r.label} onChange={(label) => setRows(rows.map((x, j) => (j === i ? { ...x, label } : x)))} placeholder="Параметър" />
                  </th>
                  <td>
                    <Text value={r.value} onChange={(value) => setRows(rows.map((x, j) => (j === i ? { ...x, value } : x)))} placeholder="Стойност" />
                    <ItemTools list={rows} index={i} onChange={setRows} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <AddItem label="Добавете ред" onClick={() => setRows([...rows, { label: '', value: '' }])} />
        </>
      )
    }
    case 'cta':
      return <Cta block={block} set={set} />
    case 'listing':
      return (
        <>
          <Heading block={block} set={set} />
          <Cards items={payload.listings[block.id] ?? []} payload={payload} />
        </>
      )
    case 'testimonials': {
      const items = block.items
      const setItems = (items: BlockOf<'testimonials'>['items']) => set({ items })
      return (
        <>
          <Heading block={block} set={set} />
          <div className="quotes">
            {items.map((it, i) => (
              <figure key={i}>
                <blockquote>
                  <Text as="p" value={it.quote} onChange={(quote) => setItems(items.map((x, j) => (j === i ? { ...x, quote } : x)))} placeholder="Цитат" multiline />
                </blockquote>
                <figcaption>
                  <Text value={it.author} onChange={(author) => setItems(items.map((x, j) => (j === i ? { ...x, author } : x)))} placeholder="Име" />
                  {(it.company || editing) && ', '}
                  <Text value={it.company} onChange={(company) => setItems(items.map((x, j) => (j === i ? { ...x, company } : x)))} placeholder="Длъжност, фирма" />
                </figcaption>
                <ItemTools list={items} index={i} onChange={setItems} />
              </figure>
            ))}
          </div>
          <AddItem label="Добавете препоръка" onClick={() => setItems([...items, { quote: '', author: '', company: '' }])} />
        </>
      )
    }
    case 'contact':
      return (
        <div className="contact-grid">
          <div>
            <Heading block={block} set={set} />
            <Text as="p" className="intro" value={block.text} onChange={(text) => set({ text })} placeholder="Въведение" multiline />
            <dl className="contact-list">
              <dt>{t(lang).address}</dt>
              <dd>{info.address?.[lang]}</dd>
              <dt>{t(lang).phone}</dt>
              <dd>
                <a href={`tel:${info.phone?.replace(/[^\d+]/g, '')}`}>{info.phone}</a>
              </dd>
              <dt>{t(lang).email}</dt>
              <dd>
                <a href={`mailto:${info.email}`}>{info.email}</a>
              </dd>
            </dl>
          </div>
          <ContactForm lang={lang} page={payload.page?.url ?? ''} />
        </div>
      )
  }
}

function Cta({ block, set }: { block: BlockOf<'cta'>; set(p: Partial<BlockOf<'cta'>>): void }) {
  const { editing } = useEdit()
  return (
    <div className="cta-box">
      <div>
        <Text as="h2" value={block.heading} onChange={(heading) => set({ heading })} placeholder="Призив за действие" />
        <Text as="p" value={block.text} onChange={(text) => set({ text })} placeholder="Кратко пояснение" multiline />
      </div>
      {(block.label || editing) && (
        <a className="btn btn-primary" href={block.url || '#'}>
          <Text value={block.label} onChange={(label) => set({ label })} placeholder="Текст на бутона" />
        </a>
      )}
      {editing && <UrlField value={block.url} onChange={(url) => set({ url })} />}
    </div>
  )
}
