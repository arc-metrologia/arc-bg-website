import type { Me } from './types'

let csrf = ''

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export async function api<T = unknown>(path: string, opts: { method?: string; body?: unknown; form?: FormData } = {}): Promise<T> {
  const method = opts.method ?? (opts.body || opts.form ? 'POST' : 'GET')
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (method !== 'GET') headers['X-CSRF-Token'] = csrf
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json'
  const res = await fetch(`/api/${path}`, {
    method,
    headers,
    credentials: 'same-origin',
    body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
  })
  const data = await res.json().catch(() => ({ error: `Сървърът върна грешка ${res.status}.` }))
  if (!res.ok) throw new ApiError(res.status, data.error ?? `Грешка ${res.status}`)
  if (data && typeof data === 'object' && 'csrf' in data) csrf = data.csrf
  return data as T
}

export async function me(): Promise<Me> {
  return api<Me>('auth/me')
}

/** Качване с прогрес (fetch няма upload progress). */
export function upload<T>(file: File, onProgress?: (pct: number) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/api/admin/media')
    xhr.setRequestHeader('X-CSRF-Token', csrf)
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(Math.round((e.loaded / e.total) * 100))
    xhr.onload = () => {
      let data: { error?: string } = {}
      try {
        data = JSON.parse(xhr.responseText)
      } catch {
        data = { error: xhr.status === 413 ? 'Файлът е по-голям от лимита на сървъра.' : `Грешка ${xhr.status}` }
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data as T)
      else reject(new ApiError(xhr.status, data.error ?? `Грешка ${xhr.status}`))
    }
    xhr.onerror = () => reject(new ApiError(0, 'Няма връзка със сървъра.'))
    const fd = new FormData()
    fd.append('file', file)
    xhr.send(fd)
  })
}

const BG: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n',
  о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sht', ъ: 'a',
  ь: 'y', ю: 'yu', я: 'ya',
}

/** Адрес от заглавие по официалната българска транслитерация. */
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .split('')
    .map((c) => BG[c] ?? c)
    .join('')
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}
