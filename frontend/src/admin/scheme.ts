import { useEffect, useState } from 'react'

/** Цветови схеми на админ панела (Профил → Цветова схема). Цветовете са в admin.css под .scheme-<key>. */
export const SCHEMES = [
  { key: 'wp', label: 'WordPress', hint: 'Тъмносиво меню и сини бутони', swatches: ['#1d2327', '#2c3338', '#2271b1', '#72aee6'] },
  { key: 'arc', label: 'АРК Метрология', hint: 'Цветовете на сайта', swatches: ['#032a41', '#053a59', '#f0b323', '#dbe7ee'] },
] as const

export type Scheme = (typeof SCHEMES)[number]['key']

// Изборът е за този браузър и потребител (localStorage може да липсва в частен режим).
const storeKey = (userId: number) => `arc-admin-scheme-${userId}`
const listeners = new Set<(s: Scheme) => void>()

function read(userId: number): Scheme {
  try {
    const v = localStorage.getItem(storeKey(userId))
    return SCHEMES.some((s) => s.key === v) ? (v as Scheme) : 'wp'
  } catch {
    return 'wp'
  }
}

export function useScheme(userId: number): [Scheme, (s: Scheme) => void] {
  const [scheme, setScheme] = useState<Scheme>(() => read(userId))
  useEffect(() => {
    listeners.add(setScheme)
    return () => {
      listeners.delete(setScheme)
    }
  }, [])
  const set = (s: Scheme) => {
    try {
      localStorage.setItem(storeKey(userId), s)
    } catch {
      /* само за тази сесия */
    }
    listeners.forEach((l) => l(s))
  }
  return [scheme, set]
}
