import type { PageType } from '../types'

/** Разделите със съдържание в менюто (като „Публикации“ и „Страници“ в WordPress). */
export const KINDS = {
  posts: { types: ['post'], label: 'Новини', all: 'Всички новини', add: 'Добавяне на новина', search: 'Търсене в новините', empty: 'Няма новини.', template: 'post', perm: 'posts' },
  products: { types: ['product'], label: 'Продукти', all: 'Всички продукти', add: 'Добавяне на продукт', search: 'Търсене в продуктите', empty: 'Няма продукти.', template: 'product', perm: 'content' },
  services: { types: ['service'], label: 'Услуги', all: 'Всички услуги', add: 'Добавяне на услуга', search: 'Търсене в услугите', empty: 'Няма услуги.', template: 'service', perm: 'content' },
  pages: { types: ['page', 'category'], label: 'Страници', all: 'Всички страници', add: 'Добавяне на страница', search: 'Търсене в страниците', empty: 'Няма страници.', template: 'blank', perm: 'content' },
} as const satisfies Record<string, { types: readonly PageType[]; template: string; perm: string; [k: string]: unknown }>

export type Kind = keyof typeof KINDS

export const kindOf = (type: PageType): Kind => (Object.keys(KINDS) as Kind[]).find((k) => (KINDS[k].types as readonly PageType[]).includes(type))!

export const fmtDate = (d: string | null) => (d ? new Date(d.replace(' ', 'T')).toLocaleString('bg-BG', { dateStyle: 'medium', timeStyle: 'short' }) : '—')
