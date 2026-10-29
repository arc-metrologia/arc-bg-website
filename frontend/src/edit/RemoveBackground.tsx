import { useEffect, useRef, useState } from 'react'
import { api, upload } from '../api'
import type { Media } from '../types'

interface Opts {
  /** Колко далеч от чисто бялото още се смята за фон (0–255). */
  tolerance: number
  /** Ширина на плавния преход по ръба (0–255). */
  feather: number
  /** true: само белия фон, свързан с краищата на снимката; false: всички бели участъци. */
  edges: boolean
}

// Разстояние до бялото: 0 = чисто бяло, 255 = поне един канал е черен.
const dist = (d: Uint8ClampedArray, i: number) => 255 - Math.min(d[i], d[i + 1], d[i + 2])

/**
 * Прави белия фон прозрачен. В режим „edges“ запълва от краищата навътре,
 * така че бели детайли вътре в предмета (надписи, отблясъци) остават.
 * По ръба алфата е плавна, а белият ореол се изважда от цвета.
 */
export function removeWhite(img: ImageData, { tolerance, feather, edges }: Opts) {
  const { width: w, height: h, data: d } = img
  const n = w * h
  const bg = new Uint8Array(n)
  if (edges) {
    const queue = new Int32Array(n)
    let head = 0
    let tail = 0
    const seed = (p: number) => {
      if (!bg[p] && dist(d, p * 4) <= tolerance) {
        bg[p] = 1
        queue[tail++] = p
      }
    }
    for (let x = 0; x < w; x++) {
      seed(x)
      seed((h - 1) * w + x)
    }
    for (let y = 0; y < h; y++) {
      seed(y * w)
      seed(y * w + w - 1)
    }
    while (head < tail) {
      const p = queue[head++]
      const x = p % w
      if (x > 0) seed(p - 1)
      if (x < w - 1) seed(p + 1)
      if (p >= w) seed(p - w)
      if (p < n - w) seed(p + w)
    }
  } else {
    for (let p = 0; p < n; p++) if (dist(d, p * 4) <= tolerance) bg[p] = 1
  }
  for (let p = 0; p < n; p++) {
    const i = p * 4
    if (bg[p]) {
      d[i + 3] = 0
      continue
    }
    if (!feather) continue
    // Плавен ръб само за пикселите, които граничат с фона.
    const x = p % w
    const edge = (x > 0 && bg[p - 1]) || (x < w - 1 && bg[p + 1]) || (p >= w && bg[p - w]) || (p < n - w && bg[p + w])
    if (!edge) continue
    const a = Math.min(1, (dist(d, i) - tolerance) / feather)
    if (a >= 1) continue
    // Махаме примесеното бяло от цвета: c = (c − 255·(1 − a)) / a
    for (let k = 0; k < 3; k++) d[i + k] = (d[i + k] - 255 * (1 - a)) / Math.max(a, 0.01)
    d[i + 3] = Math.round(d[i + 3] * a)
  }
  return img
}

function load(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const im = new Image()
    im.onload = () => resolve(im)
    im.onerror = () => reject(new Error('Снимката не може да бъде заредена.'))
    im.src = url
  })
}

function pixels(im: HTMLImageElement, max: number) {
  const s = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight))
  const c = document.createElement('canvas')
  c.width = Math.round(im.naturalWidth * s)
  c.height = Math.round(im.naturalHeight * s)
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(im, 0, 0, c.width, c.height)
  return { c, ctx, data: ctx.getImageData(0, 0, c.width, c.height) }
}

const PREVIEW = 900

/** Прозорец „Премахване на белия фон“ — резултатът се записва като ново копие в медията. */
export default function RemoveBackground({ media, onDone, onClose }: { media: Media; onDone(m: Media): void; onClose(): void }) {
  const [opts, setOpts] = useState<Opts>({ tolerance: 15, feather: 12, edges: true })
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [before, setBefore] = useState(false)
  const [state, setState] = useState<'idle' | 'saving'>('idle')
  const [error, setError] = useState('')
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    load(media.url).then(setImg, (e: Error) => setError(e.message))
  }, [media.url])

  useEffect(() => {
    const out = canvas.current
    if (!img || !out) return
    const { data } = pixels(img, PREVIEW)
    out.width = data.width
    out.height = data.height
    out.getContext('2d')!.putImageData(before ? data : removeWhite(data, opts), 0, 0)
  }, [img, opts, before])

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    addEventListener('keydown', esc)
    return () => removeEventListener('keydown', esc)
  }, [onClose])

  async function save() {
    if (!img) return
    setState('saving')
    setError('')
    try {
      // Записът е в пълен размер, прегледът — умален.
      const { c, ctx, data } = pixels(img, 2400)
      ctx.putImageData(removeWhite(data, opts), 0, 0)
      const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/png'))
      if (!blob) throw new Error('Браузърът не успя да създаде файла.')
      const base = (media.name || 'snimka').replace(/\.[a-z0-9]+$/i, '')
      const created = await upload<Media>(new File([blob], `${base}-bez-fon.png`, { type: 'image/png' }))
      const saved = await api<Media>(`admin/media/${created.id}`, {
        method: 'PUT',
        body: { title: `${media.title || base} (без фон)`, altBg: media.altBg, altEn: media.altEn },
      })
      onDone(saved)
    } catch (e) {
      setError((e as Error).message)
      setState('idle')
    }
  }

  const set = (patch: Partial<Opts>) => setOpts((o) => ({ ...o, ...patch }))
  return (
    <div className="rb-overlay" role="dialog" aria-modal="true" aria-label="Премахване на белия фон" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="rb">
        <header className="rb-head">
          <h2>Премахване на белия фон</h2>
          <button type="button" className="rb-close" onClick={onClose} aria-label="Затвори">
            ✕
          </button>
        </header>
        <div className="rb-body">
          <div className="rb-preview">
            {img ? <canvas ref={canvas} /> : <p>{error || 'Зареждане…'}</p>}
          </div>
          <div className="rb-controls">
            <label>
              Чувствителност: {opts.tolerance}
              <input type="range" min={2} max={120} value={opts.tolerance} onChange={(e) => set({ tolerance: +e.target.value })} />
              <small>По-високо — маха и светлосиви сенки. По-ниско — само чисто бяло.</small>
            </label>
            <label>
              Омекотяване на ръба: {opts.feather}
              <input type="range" min={0} max={60} value={opts.feather} onChange={(e) => set({ feather: +e.target.value })} />
              <small>Плавен преход, без назъбени краища и бял ореол.</small>
            </label>
            <fieldset>
              <legend>Кое бяло да се махне</legend>
              <label className="rb-radio">
                <input type="radio" checked={opts.edges} onChange={() => set({ edges: true })} />
                Само фона около предмета (препоръчително)
              </label>
              <label className="rb-radio">
                <input type="radio" checked={!opts.edges} onChange={() => set({ edges: false })} />
                Всички бели участъци, и вътре в предмета
              </label>
            </fieldset>
            <label className="rb-radio">
              <input type="checkbox" checked={before} onChange={(e) => setBefore(e.target.checked)} />
              Покажи оригинала
            </label>
            <p className="rb-note">Оригиналът остава непроменен. Резултатът се записва като ново копие с прозрачен фон.</p>
            {error && img && <p className="rb-error">{error}</p>}
            <div className="rb-actions">
              <button type="button" className="adm-btn primary" disabled={!img || state === 'saving'} onClick={save}>
                {state === 'saving' ? 'Записване…' : 'Запазете като ново копие'}
              </button>
              <button type="button" className="adm-btn" onClick={onClose}>
                Отказ
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
