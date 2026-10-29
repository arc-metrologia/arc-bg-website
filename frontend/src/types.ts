export type Lang = 'bg' | 'en'
export type PageType = 'page' | 'category' | 'product' | 'service' | 'post'

export interface Media {
  id: number
  kind: 'image' | 'video' | 'file'
  url: string
  mime: string
  width: number | null
  height: number | null
  alt: string
  altBg: string
  altEn: string
  title: string
  name: string
  size: number
  variants: { w: number; url: string }[]
}

export type BoxAlign = 'left' | 'center' | 'right'
/** Ефект върху снимка (следва формата ѝ, ако фонът е прозрачен). */
export type ImageFx = { effect?: 'glow' | 'shadow' | 'outline'; effectColor?: string; effectSize?: number }
/** width (20–100 % от ширината на съдържанието) и align важат само за типовете в SIZABLE (site/box.ts). */
type Base = { id: string; heading: string; width?: number; align?: BoxAlign }
export type Item = { title: string; text: string }

export type Block = Base &
  (
    | ({ type: 'hero'; text: string; image: number | null; imageSize?: number; measure: string; ctaLabel: string; ctaUrl: string } & ImageFx)
    | { type: 'richtext'; html: string }
    | ({ type: 'image'; image: number | null; caption: string } & ImageFx)
    | { type: 'gallery'; images: number[] }
    | { type: 'logos'; images: number[] }
    | { type: 'downloads'; files: number[] }
    | { type: 'video'; provider: 'youtube' | 'vimeo' | 'file'; videoId: string; media: number | null; poster: number | null; caption: string }
    | { type: 'features'; intro: string; items: Item[] }
    | { type: 'steps'; items: Item[] }
    | { type: 'faq'; items: { q: string; a: string }[] }
    | { type: 'specs'; rows: { label: string; value: string }[] }
    | { type: 'cta'; text: string; label: string; url: string }
    | { type: 'listing'; source: 'children' | 'posts' | 'products' | 'services'; limit: number }
    | { type: 'carousel'; source: 'latest' | 'posts' | 'products' | 'manual'; pages: number[]; limit: number }
    | { type: 'testimonials'; items: { quote: string; author: string; company: string }[] }
    | { type: 'contact'; text: string }
    | { type: 'placeholder'; note: string }
  )

export type BlockType = Block['type']
export type BlockOf<T extends BlockType> = Extract<Block, { type: T }>

export interface Page {
  id: number
  type: PageType
  lang: Lang
  path: string
  url: string
  translationKey: string | null
  title: string
  metaTitle: string
  metaDescription: string
  excerpt: string
  image: number | null
  blocks: Block[]
  related: number[]
  extra: Record<string, string>
  status: 'draft' | 'published'
  sortOrder: number
  publishedAt: string | null
  updatedAt: string | null
}

export interface Card {
  id: number
  type: PageType
  title: string
  url: string
  excerpt: string
  image: number | null
  publishedAt: string | null
}

export interface NavItem {
  label: string
  url: string
  children?: NavItem[]
}

export interface SiteInfo {
  name: string
  nameEn: string
  legalName: string
  phone: string
  email: string
  address: Record<Lang, string>
  tagline: Record<Lang, string>
  description: Record<Lang, string>
  social: { label: string; url: string }[]
  [k: string]: unknown
}

export interface Site {
  lang: Lang
  languages: Lang[]
  info: SiteInfo
  nav: NavItem[]
}

export interface Payload {
  page: Page | null
  media: Record<number, Media>
  listings: Record<string, Card[]>
  related: Card[]
  breadcrumbs: { title: string; url: string }[]
  alternates: Partial<Record<Lang, string>>
  site: Site
  editor?: boolean
}

export interface User {
  id: number
  email: string
  name: string
  role: 'admin' | 'editor' | 'author'
  permissions: string[]
}

export interface Me {
  stage: 'none' | '2fa' | 'enroll' | 'ok'
  user: User | null
  csrf: string
  setupRequired: boolean
}
