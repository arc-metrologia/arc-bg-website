import { createContext, useContext, type ComponentType, type ReactNode } from 'react'
import type { Block, Media, Page } from '../types'

/**
 * Мостът между публичните компоненти и редактора.
 * Публичният bundle съдържа само този интерфейс; самият редактор (TipTap, медийна библиотека)
 * се зарежда отложено и само за влезли редактори.
 */
export interface EditApi {
  editing: boolean
  setPage(patch: Partial<Page>): void
  setBlock(id: string, patch: Partial<Block>): void
  pickMedia(kind: Media['kind'], multiple?: boolean): Promise<Media[]>
  Frame: ComponentType<{ block: Block; index: number; children: ReactNode }>
  Inserter: ComponentType<{ index: number }>
  RichEditor: ComponentType<{ html: string; onChange(html: string): void }>
}

const noop = () => {}
export const EditContext = createContext<EditApi>({
  editing: false,
  setPage: noop,
  setBlock: noop,
  pickMedia: async () => [],
  Frame: ({ children }) => children,
  Inserter: () => null,
  RichEditor: () => null,
})

export const useEdit = () => useContext(EditContext)
