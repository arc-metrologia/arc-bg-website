import type { CSSProperties } from 'react'
import type { Block, BlockType, ImageFx } from '../types'

/** Блокове с променлива ширина и подравняване (същото като Sanitizer::SIZABLE). */
export const SIZABLE: BlockType[] = ['richtext', 'image', 'video', 'cta']

/** Класове и стил на секцията — същите като в Render::block. */
export const boxProps = (b: Block): { className: string; style?: CSSProperties } =>
  b.width
    ? { className: `blk blk-${b.type} blk-box al-${b.align ?? 'left'}`, style: { '--bw': `${b.width}%` } as CSSProperties }
    : { className: `blk blk-${b.type}` }

/** CSS filter за ефекта — същият низ като Render::fx. */
export function fxFilter({ effect, effectColor: c = 'var(--amber)', effectSize: s = 24 }: ImageFx): string {
  if (effect === 'glow') return `drop-shadow(0 0 ${s}px ${c}) drop-shadow(0 0 ${Math.round(s / 2)}px ${c})`
  if (effect === 'shadow') return `drop-shadow(0 ${Math.round(s / 3)}px ${s}px ${c})`
  if (effect === 'outline') {
    const o = Math.max(1, Math.round(s / 4))
    return `drop-shadow(${o}px 0 0 ${c}) drop-shadow(-${o}px 0 0 ${c}) drop-shadow(0 ${o}px 0 ${c}) drop-shadow(0 -${o}px 0 ${c})`
  }
  return ''
}

/** Клас и стил на <figure> с ефект (Render::fxAttr). */
export const fxProps = (b: ImageFx): { className?: string; style?: CSSProperties } => {
  const f = fxFilter(b)
  return f ? { className: 'fx', style: { '--fx': f } as CSSProperties } : {}
}

/** Снимката във водещата секция: под 100 % се смалява в колоната си, над 100 % колоната ѝ става по-широка (Render::hero). */
export const heroGridStyle = (size = 100): CSSProperties | undefined =>
  size < 100 ? ({ '--img': `${size}%` } as CSSProperties) : size > 100 ? ({ '--img-col': `${size / 100}fr` } as CSSProperties) : undefined
