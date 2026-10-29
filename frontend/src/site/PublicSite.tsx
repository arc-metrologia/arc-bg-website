import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { api, ApiError } from '../api'
import { langFromPath, t } from '../i18n'
import type { Payload } from '../types'
import { BlockView } from './Blocks'
import { boxProps } from './box'
import { useEdit } from './edit-context'
import { Text } from './editable'
import Img from './Img'
import Layout from './Layout'

const Editor = lazy(() => import('../edit/Editor'))

/** Обновява <title>, description, canonical и lang при навигация без презареждане. */
function useHead(p: Payload | null) {
  useEffect(() => {
    if (!p) return
    const page = p.page
    const name = p.site.lang === 'en' ? p.site.info.nameEn : p.site.info.name
    document.documentElement.lang = p.site.lang
    if (!page) {
      document.title = `${t(p.site.lang).notFound} | ${name}`
      return
    }
    document.title = page.metaTitle || (page.path === '' ? name : `${page.title} | ${name}`)
    const set = (sel: string, attr: string, val: string) => document.querySelector(sel)?.setAttribute(attr, val)
    set('meta[name="description"]', 'content', page.metaDescription || page.excerpt)
    set('link[rel="canonical"]', 'href', location.origin + page.url)
  }, [p])
}

export function PageBody({ payload }: { payload: Payload }) {
  const { editing, setPage, setBlock, Frame, Inserter } = useEdit()
  const page = payload.page
  const s = t(payload.site.lang)
  if (!page)
    return (
      <header className="page-head">
        <div className="wrap">
          <h1>{s.notFound}</h1>
          <p className="lede">{s.notFoundText}</p>
        </div>
      </header>
    )
  // „Празна секция“ е бележка за редакторите — посетителите не я виждат.
  const firstIdx = page.blocks.findIndex((b) => editing || b.type !== 'placeholder')
  const heroFirst = page.blocks[firstIdx]?.type === 'hero'
  // Продукти, услуги и статии показват основната си снимка до заглавието.
  const headImage = !heroFirst && page.type !== 'page' && page.type !== 'category' && page.image ? payload.media[page.image] : undefined
  const blocks = page.blocks.map((b, i) => (b.type === 'placeholder' && !editing ? null :
    <Frame key={b.id} block={b} index={i}>
      <section {...boxProps(b)}>
        <div className="wrap">
          <BlockView block={b} payload={payload} first={i === firstIdx && heroFirst} set={(patch) => setBlock(b.id, patch)} />
        </div>
      </section>
    </Frame>
  ))
  return (
    <>
      {payload.breadcrumbs.length > 1 && (
        <nav className="crumbs wrap" aria-label={s.crumbs}>
          <ol>
            {payload.breadcrumbs.map((c) => (
              <li key={c.url}>
                <a href={c.url}>{c.title}</a>
              </li>
            ))}
          </ol>
        </nav>
      )}
      {(!heroFirst || editing) && (
        <header className={`page-head${headImage ? ' has-image' : ''}`}>
          <div className="wrap">
            {headImage && (
              <figure className="page-head-image">
                <Img media={headImage} sizes="(min-width: 900px) 40vw, 100vw" eager />
              </figure>
            )}
            {heroFirst ? (
              <p className="ed-hint">Заглавие на страницата (вижда се в Google и в менютата): {page.title}</p>
            ) : (
              <Text as="h1" value={page.title} onChange={(title) => setPage({ title })} placeholder="Заглавие на страницата" />
            )}
            {!heroFirst && <Text as="p" className="lede" value={page.excerpt} onChange={(excerpt) => setPage({ excerpt })} placeholder="Кратко описание — показва се в списъците и в Google" multiline />}
            {page.type === 'post' && page.publishedAt && (
              <p className="meta">
                {s.published} <time dateTime={page.publishedAt.slice(0, 10)}>{new Date(page.publishedAt.replace(' ', 'T')).toLocaleDateString('bg-BG')}</time>
              </p>
            )}
          </div>
        </header>
      )}
      <Inserter index={0} />
      {page.type === 'post' ? <article className="post">{blocks}</article> : blocks}
      {payload.related.length > 0 && (
        <section className="blk blk-listing related">
          <div className="wrap">
            <h2>{s.related}</h2>
            <ul className="cards">
              {payload.related.map((c) => (
                <li className="card" key={c.id}>
                  <a href={c.url}>
                    <h3>{c.title}</h3>
                    {c.excerpt && <p>{c.excerpt}</p>}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </>
  )
}

export default function PublicSite({ initial }: { initial: Payload | null }) {
  const loc = useLocation()
  const navigate = useNavigate()
  const first = useRef(true)
  const [data, setData] = useState<Payload | null>(initial)
  const [loading, setLoading] = useState(!initial)
  const editorSession = initial?.editor ?? false

  const load = useCallback(async () => {
    const { lang, path } = langFromPath(loc.pathname)
    setLoading(true)
    try {
      setData(await api<Payload>(`public/page?lang=${lang}&path=${encodeURIComponent(path)}`))
    } catch (e) {
      const site = (e instanceof ApiError && data?.site) || data?.site
      if (site) setData({ page: null, media: {}, listings: {}, related: [], breadcrumbs: [], alternates: {}, site })
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loc.pathname])

  useEffect(() => {
    if (first.current && initial) {
      first.current = false
      return
    }
    first.current = false
    load().then(() => window.scrollTo(0, 0))
  }, [load, initial])

  useHead(data)

  // Вътрешните връзки (вкл. в текста от редактора) навигират без презареждане.
  function onClick(e: React.MouseEvent) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    const a = (e.target as HTMLElement).closest('a')
    if (!a || a.target || a.hasAttribute('download')) return
    const url = new URL(a.href, location.href)
    if (url.origin !== location.origin || /^\/(uploads|api|admin)\//.test(url.pathname) || /\.\w+$/.test(url.pathname)) return
    if (document.body.classList.contains('editing')) {
      e.preventDefault()
      return
    }
    e.preventDefault()
    if (url.pathname + url.hash !== loc.pathname + loc.hash) navigate(url.pathname + url.search + url.hash)
  }

  if (!data) return <p className="wrap">{loading ? '…' : ''}</p>
  return (
    <div onClick={onClick} className={loading ? 'is-loading' : undefined}>
      <Layout site={data.site} alternates={data.alternates}>
        {editorSession && data.page ? (
          <Suspense fallback={<PageBody payload={data} />}>
            <Editor payload={data} reload={load} render={(p) => <PageBody payload={p} />} />
          </Suspense>
        ) : (
          <PageBody payload={data} />
        )}
      </Layout>
    </div>
  )
}
