import { useEffect, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { t } from '../i18n'
import type { Lang, Site } from '../types'

export default function Layout({ site, alternates, children }: { site: Site; alternates: Partial<Record<Lang, string>>; children: ReactNode }) {
  const s = t(site.lang)
  const info = site.info
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  useEffect(() => setOpen(false), [pathname])
  const otherLang: Lang = site.lang === 'bg' ? 'en' : 'bg'
  const otherUrl = alternates[otherLang] ?? (otherLang === 'en' ? '/en/' : '/')
  const tel = info.phone?.replace(/[^\d+]/g, '')

  return (
    <>
      <a className="skip" href="#main">
        {s.skip}
      </a>
      <header className="site-header">
        <div className="wrap header-inner">
          <a className="brand" href={site.lang === 'bg' ? '/' : '/en/'}>
            <img src="/logo-arc.svg" alt={site.lang === 'en' ? info.nameEn : info.name} width={113} height={60} />
          </a>
          <button type="button" className="nav-toggle" aria-expanded={open} aria-controls="main-nav" onClick={() => setOpen(!open)}>
            {s.menu}
          </button>
          <nav id="main-nav" className={`main-nav${open ? ' open' : ''}`} aria-label={s.mainMenu}>
            <ul>
              {site.nav.map((item) => (
                <li key={item.url} className={pathname === item.url || pathname.startsWith(item.url + '/') ? 'active' : undefined}>
                  <a href={item.url} aria-current={pathname === item.url ? 'page' : undefined}>
                    {item.label}
                  </a>
                  {item.children && item.children.length > 0 && (
                    <ul className="sub">
                      {item.children.map((c) => (
                        <li key={c.url}>
                          <a href={c.url}>{c.label}</a>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </nav>
          {info.phone && (
            <a className="header-phone" href={`tel:${tel}`}>
              {info.phone}
            </a>
          )}
          <a className="lang-switch" href={otherUrl} hrefLang={otherLang} lang={otherLang} onClick={(e) => e.stopPropagation()}>
            {otherLang.toUpperCase()}
          </a>
        </div>
      </header>
      <main id="main">{children}</main>
      <footer className="site-footer">
        <div className="wrap footer-grid">
          <div>
            <img src="/logo-arc-white.svg" alt="" width={113} height={60} />
            <p>{info.tagline?.[site.lang]}</p>
          </div>
          <address>
            <p>{info.address?.[site.lang]}</p>
            {info.phone && (
              <p>
                <a href={`tel:${tel}`}>{info.phone}</a>
              </p>
            )}
            {info.email && (
              <p>
                <a href={`mailto:${info.email}`}>{info.email}</a>
              </p>
            )}
          </address>
          <ul className="footer-links">
            {site.nav.map((item) => (
              <li key={item.url}>
                <a href={item.url}>{item.label}</a>
              </li>
            ))}
          </ul>
          <ul className="footer-social">
            {info.social?.map((x) => (
              <li key={x.url}>
                <a href={x.url} rel="noopener" target="_blank">
                  {x.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
        <div className="wrap footer-legal">
          <p>
            © {new Date().getFullYear()} {info.legalName || info.name}. {s.rights}
          </p>
        </div>
      </footer>
    </>
  )
}
