import type { Block, BlockType } from '../types'

const id = () => Math.random().toString(36).slice(2, 10)

export const BLOCKS: { type: BlockType; label: string; hint: string; make(): Block }[] = [
  { type: 'richtext', label: 'Текст', hint: 'Заглавия, списъци, таблици, връзки', make: () => ({ id: id(), type: 'richtext', heading: '', html: '<p></p>' }) },
  { type: 'hero', label: 'Водеща секция', hint: 'Голямо заглавие, текст, бутон и снимка', make: () => ({ id: id(), type: 'hero', heading: '', text: '', image: null, measure: '', ctaLabel: '', ctaUrl: '' }) },
  { type: 'image', label: 'Изображение', hint: 'Една снимка с надпис', make: () => ({ id: id(), type: 'image', heading: '', image: null, caption: '' }) },
  { type: 'gallery', label: 'Галерия', hint: 'Няколко снимки в мрежа', make: () => ({ id: id(), type: 'gallery', heading: '', images: [] }) },
  { type: 'video', label: 'Видео', hint: 'YouTube, Vimeo или качен файл', make: () => ({ id: id(), type: 'video', heading: '', provider: 'youtube', videoId: '', media: null, poster: null, caption: '' }) },
  { type: 'specs', label: 'Технически данни', hint: 'Таблица параметър — стойност', make: () => ({ id: id(), type: 'specs', heading: 'Технически данни', rows: [{ label: '', value: '' }] }) },
  { type: 'features', label: 'Предимства', hint: 'Списък с кратки акценти', make: () => ({ id: id(), type: 'features', heading: '', intro: '', items: [{ title: '', text: '' }] }) },
  { type: 'steps', label: 'Стъпки', hint: 'Номериран процес', make: () => ({ id: id(), type: 'steps', heading: '', items: [{ title: '', text: '' }] }) },
  { type: 'faq', label: 'Въпроси и отговори', hint: 'Показва се и в Google и в AI отговорите', make: () => ({ id: id(), type: 'faq', heading: 'Често задавани въпроси', items: [{ q: '', a: '' }] }) },
  { type: 'downloads', label: 'Файлове за изтегляне', hint: 'PDF каталози и брошури', make: () => ({ id: id(), type: 'downloads', heading: 'Каталози', files: [] }) },
  { type: 'carousel', label: 'Слайдер', hint: 'Хоризонтална лента с новини и продукти', make: () => ({ id: id(), type: 'carousel', heading: 'Новини и продукти', source: 'latest', pages: [], limit: 10 }) },
  { type: 'listing', label: 'Автоматичен списък', hint: 'Подстраници, продукти, услуги или статии', make: () => ({ id: id(), type: 'listing', heading: '', source: 'children', limit: 0 }) },
  { type: 'testimonials', label: 'Препоръки', hint: 'Цитати от клиенти', make: () => ({ id: id(), type: 'testimonials', heading: '', items: [{ quote: '', author: '', company: '' }] }) },
  { type: 'logos', label: 'Логота', hint: 'Партньори или клиенти', make: () => ({ id: id(), type: 'logos', heading: '', images: [] }) },
  { type: 'cta', label: 'Призив за действие', hint: 'Заглавие, текст и бутон', make: () => ({ id: id(), type: 'cta', heading: '', text: '', label: 'Свържете се с нас', url: '/kontakti' }) },
  { type: 'contact', label: 'Контакти и форма', hint: 'Данните на фирмата и форма за запитване', make: () => ({ id: id(), type: 'contact', heading: '', text: '' }) },
]

export const blockLabel = (t: BlockType) => BLOCKS.find((b) => b.type === t)?.label ?? t

export const LISTING_SOURCES = [
  { value: 'children', label: 'Подстраници на тази страница' },
  { value: 'products', label: 'Всички продукти' },
  { value: 'services', label: 'Всички услуги' },
  { value: 'posts', label: 'Статии от блога (най-новите първо)' },
] as const

export const CAROUSEL_SOURCES = [
  { value: 'latest', label: 'Най-новите новини и продукти' },
  { value: 'posts', label: 'Само новини (статии от блога)' },
  { value: 'products', label: 'Само продукти' },
  { value: 'manual', label: 'Избрани ръчно' },
] as const

export const TYPE_LABELS = {
  page: 'Страница',
  category: 'Категория',
  product: 'Продукт',
  service: 'Услуга',
  post: 'Статия',
} as const
