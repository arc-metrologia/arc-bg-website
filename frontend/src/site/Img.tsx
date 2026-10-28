import type { Media } from '../types'

interface Props {
  media: Media | undefined | null
  sizes?: string
  eager?: boolean
  className?: string
  alt?: string
}

/** Адаптивно изображение: WebP варианти в srcset, фиксирани размери (без layout shift), lazy loading. */
export default function Img({ media, sizes = '100vw', eager, className, alt }: Props) {
  if (!media) return null
  const srcSet = [...media.variants.map((v) => `${v.url} ${v.w}w`), ...(media.width ? [`${media.url} ${media.width}w`] : [])]
  return (
    <img
      src={media.url}
      srcSet={srcSet.length > 1 ? srcSet.join(', ') : undefined}
      sizes={sizes}
      alt={alt ?? media.alt}
      width={media.width ?? undefined}
      height={media.height ?? undefined}
      loading={eager ? undefined : 'lazy'}
      fetchPriority={eager ? 'high' : undefined}
      decoding="async"
      className={className}
    />
  )
}
