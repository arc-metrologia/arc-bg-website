import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { t } from '../i18n'
import type { Card, Lang, Media } from '../types'
import Img from './Img'

interface Props {
  items: Card[]
  media: Record<number, Media>
  lang: Lang
  label: string
  heading: ReactNode
}

const Chevron = ({ dir }: { dir: 'left' | 'right' }) => (
  <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
    <path d={dir === 'left' ? 'M12.5 4 6.5 10l6 6' : 'M7.5 4l6 6-6 6'} fill="none" stroke="currentColor" strokeWidth="2" />
  </svg>
)

/**
 * Хоризонтален слайдер с новини и продукти. Без автоматично въртене:
 * превърта се със стрелките, със swipe (scroll-snap) или с клавиатурата.
 */
export default function Carousel({ items, media, lang, label, heading }: Props) {
  const s = t(lang)
  const track = useRef<HTMLUListElement>(null)
  const [edge, setEdge] = useState({ start: true, end: false })

  const update = useCallback(() => {
    const el = track.current
    if (!el) return
    setEdge({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 })
  }, [])

  useEffect(() => {
    const el = track.current
    update()
    el?.addEventListener('scroll', update, { passive: true })
    addEventListener('resize', update)
    return () => {
      el?.removeEventListener('scroll', update)
      removeEventListener('resize', update)
    }
  }, [items, update])

  const go = (dir: number) => {
    const el = track.current
    if (!el) return
    const slide = el.querySelector<HTMLElement>('.slide')
    const step = slide ? slide.offsetWidth + parseFloat(getComputedStyle(el).columnGap || '0') : el.clientWidth
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollBy({ left: dir * step * Math.max(1, Math.floor(el.clientWidth / step)), behavior: reduce ? 'auto' : 'smooth' })
  }

  return (
    <div className="carousel" role="region" aria-roledescription={s.slider} aria-label={label}>
      <div className="carousel-head">
        {heading}
        {items.length > 1 && (
          <div className="carousel-nav">
            <button type="button" onClick={() => go(-1)} disabled={edge.start} aria-label={s.prev}>
              <Chevron dir="left" />
            </button>
            <button type="button" onClick={() => go(1)} disabled={edge.end} aria-label={s.next}>
              <Chevron dir="right" />
            </button>
          </div>
        )}
      </div>
      <ul className="carousel-track" ref={track} tabIndex={0} aria-label={label}>
        {items.map((c, i) => (
          <li className="slide" key={c.id} aria-label={`${i + 1} / ${items.length}`}>
            <a href={c.url}>
              <div className="slide-media">
                <Img media={c.image ? media[c.image] : undefined} sizes="(min-width: 900px) 360px, 80vw" />
              </div>
              <p className={`slide-kind kind-${c.type}`}>
                {s.kinds[c.type]}
                {c.type === 'post' && c.publishedAt && (
                  <>
                    {' · '}
                    <time dateTime={c.publishedAt.slice(0, 10)}>{new Date(c.publishedAt.replace(' ', 'T')).toLocaleDateString(lang === 'en' ? 'en-GB' : 'bg-BG')}</time>
                  </>
                )}
              </p>
              <h3>{c.title}</h3>
              {c.excerpt && <p className="slide-text">{c.excerpt}</p>}
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
