import { useEffect, useRef, useState } from 'react'
import { api } from '../api'

/** Променливите от site.css, които могат да се сменят. Стойностите по подразбиране са същите като там. */
const VARS = [
  { key: 'petrol', label: 'Основен цвят', hint: 'Заглавия, връзки, бутони', def: '#053a59' },
  { key: 'petrol-deep', label: 'Тъмен основен', hint: 'Футър и тъмни секции', def: '#032a41' },
  { key: 'petrol-soft', label: 'Светъл основен', hint: 'Фон на акцентирани полета', def: '#dbe7ee' },
  { key: 'amber', label: 'Акцентен цвят', hint: 'Главни бутони и маркери', def: '#f0b323' },
  { key: 'amber-ink', label: 'Текст върху акцента', hint: 'Надписи върху акцентния цвят', def: '#3b2c00' },
  { key: 'ink', label: 'Основен текст', hint: 'Текстът на страниците', def: '#13232e' },
  { key: 'steel', label: 'Второстепенен текст', hint: 'Пояснения, дати, подзаглавия', def: '#566874' },
  { key: 'rule', label: 'Линии и рамки', hint: 'Разделители, рамки на таблици', def: '#c9d3da' },
  { key: 'plate', label: 'Светъл фон', hint: 'Фон на редуващите се секции', def: '#eef2f4' },
  { key: 'paper', label: 'Фон на страницата', hint: 'Основният фон', def: '#ffffff' },
] as const

type Theme = Record<string, string>
const DEFAULTS: Theme = Object.fromEntries(VARS.map((v) => [v.key, v.def]))

const PRESETS: { label: string; theme: Theme }[] = [
  { label: 'АРК (стандартна)', theme: DEFAULTS },
  { label: 'Графит и оранжево', theme: { ...DEFAULTS, petrol: '#2b3440', 'petrol-deep': '#1b2129', 'petrol-soft': '#e3e7ec', amber: '#f07c1e', 'amber-ink': '#2e1500' } },
  { label: 'Тъмно синьо и зелено', theme: { ...DEFAULTS, petrol: '#0b3a75', 'petrol-deep': '#06254d', 'petrol-soft': '#dce7f5', amber: '#2fb36b', 'amber-ink': '#05301a' } },
]

// Контраст по WCAG — предупреждаваме, ако текстът става труден за четене.
function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (a: string, b: string) => {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m)
  return (x + 0.05) / (y + 0.05)
}

export default function Appearance() {
  const [theme, setTheme] = useState<Theme | null>(null)
  const [saved, setSaved] = useState<Theme>({})
  const [msg, setMsg] = useState('')
  const frame = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    api<Theme | null>('admin/settings/theme').then((t) => {
      setSaved(t ?? {})
      setTheme({ ...DEFAULTS, ...(t ?? {}) })
    })
  }, [])

  // Преглед на живо: сменяме променливите директно в рамката, без запис.
  const paint = () => {
    const root = frame.current?.contentDocument?.documentElement
    if (!root || !theme) return
    for (const [k, v] of Object.entries(theme)) root.style.setProperty(`--${k}`, v)
  }
  useEffect(paint, [theme])

  if (!theme) return <p>Зареждане…</p>
  const changed = JSON.stringify({ ...DEFAULTS, ...saved }) !== JSON.stringify(theme)
  const warnings = [
    contrast(theme.ink, theme.paper) < 4.5 && 'Основният текст се чете трудно върху фона на страницата.',
    contrast(theme.petrol, theme.paper) < 4.5 && 'Основният цвят е твърде светъл за връзки и заглавия върху фона.',
    contrast(theme['amber-ink'], theme.amber) < 4.5 && 'Текстът върху акцентния цвят (главните бутони) се чете трудно.',
    contrast('#ffffff', theme['petrol-deep']) < 4.5 && 'Белият текст във футъра се чете трудно върху тъмния основен цвят.',
  ].filter(Boolean) as string[]

  async function save() {
    // Пазим само разликите спрямо стандартната тема.
    const diff = Object.fromEntries(Object.entries(theme!).filter(([k, v]) => DEFAULTS[k] !== v))
    try {
      const out = await api<Theme>('admin/settings/theme', { method: 'PUT', body: diff })
      setSaved(out ?? {})
      setMsg('Запазено. Цветовете вече са на сайта.')
    } catch (e) {
      setMsg(`Не е запазено: ${(e as Error).message}`)
    }
    setTimeout(() => setMsg(''), 4000)
  }

  return (
    <div className="wrap-wp">
      <div className="adm-head">
        <h1>Цветове на сайта</h1>
        {msg && (
          <span className={msg.startsWith("Не е") ? "adm-error" : "adm-ok"} role="status">
            {msg}
          </span>
        )}
        <div className="adm-row">
          <button type="button" className="adm-btn" disabled={!changed} onClick={() => setTheme({ ...DEFAULTS, ...saved })}>
            Отменете промените
          </button>
          <button type="button" className="adm-btn primary" disabled={!changed} onClick={save}>
            Запазете и публикувайте
          </button>
        </div>
      </div>
      <div className="adm-theme">
        <section className="adm-card adm-form">
          <h2>Готови комбинации</h2>
          <div className="adm-row">
            {PRESETS.map((p) => (
              <button key={p.label} type="button" className="adm-preset" onClick={() => setTheme(p.theme)}>
                <span className="adm-preset-sw">
                  {['petrol', 'petrol-deep', 'amber', 'plate'].map((k) => (
                    <i key={k} style={{ background: p.theme[k] }} />
                  ))}
                </span>
                {p.label}
              </button>
            ))}
          </div>
          <h2>Цветове</h2>
          {VARS.map((v) => (
            <div key={v.key} className="adm-color">
              <input type="color" value={theme[v.key]} onChange={(e) => setTheme({ ...theme, [v.key]: e.target.value })} aria-label={v.label} />
              <span>
                <strong>{v.label}</strong>
                <small>{v.hint}</small>
              </span>
              <input
                className="adm-hex"
                defaultValue={theme[v.key]}
                key={theme[v.key]}
                aria-label={`${v.label} (код)`}
                onBlur={(e) => {
                  const h = e.target.value.trim().toLowerCase()
                  if (/^#[0-9a-f]{6}$/.test(h)) setTheme({ ...theme, [v.key]: h })
                  else e.target.value = theme[v.key]
                }}
              />
              {theme[v.key] !== v.def && (
                <button type="button" className="adm-link" onClick={() => setTheme({ ...theme, [v.key]: v.def })}>
                  стандартен
                </button>
              )}
            </div>
          ))}
          {warnings.length > 0 && (
            <ul className="adm-warn" role="status">
              {warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
        </section>
        <section className="adm-theme-preview">
          <p className="adm-muted">Преглед на живо (началната страница). Промените стават видими за посетителите след „Запазете“.</p>
          <iframe ref={frame} src="/" title="Преглед на цветовете" onLoad={paint} />
        </section>
      </div>
    </div>
  )
}
