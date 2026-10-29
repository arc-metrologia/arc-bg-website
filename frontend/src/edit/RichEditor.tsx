import { useRef, useState } from 'react'
import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { TableKit } from '@tiptap/extension-table'
import { TextStyle, Color } from '@tiptap/extension-text-style'
import TextAlign from '@tiptap/extension-text-align'
import Image from '@tiptap/extension-image'
import { useEdit } from '../site/edit-context'
import PageLinkInput from './PageLinkInput'

/** Цветовете следват темата на сайта (Админ → Външен вид), затова са CSS променливи. */
export const TEXT_COLORS = [
  { label: 'Основен', value: 'var(--petrol)' },
  { label: 'Акцент', value: 'var(--amber)' },
  { label: 'Сив', value: 'var(--steel)' },
  { label: 'Червен', value: '#b42318' },
  { label: 'Зелен', value: '#067647' },
]

// Браузърът връща hex цветовете като rgb(...) — сравняваме в един формат.
const toHex = (c: string) => {
  const m = c.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/)
  return m ? '#' + m.slice(1).map((x) => Number(x).toString(16).padStart(2, '0')).join('') : c.toLowerCase()
}

const ALIGN = [
  { value: 'left', label: '⇤', title: 'Подравняване вляво' },
  { value: 'center', label: '⇔', title: 'Центриране' },
  { value: 'right', label: '⇥', title: 'Подравняване вдясно' },
]

/** Редактор за форматиран текст. Резултатът се почиства отново на сървъра (Sanitizer::html). */
export default function RichEditor({ html, onChange }: { html: string; onChange(html: string): void }) {
  const { pickMedia } = useEdit()
  const [linkUrl, setLinkUrl] = useState<string | null>(null)
  // Редакторът нормализира HTML-а при зареждане; сравняваме с това, а не със записания низ,
  // иначе само щракване в текста маркира страницата като променена.
  const baseline = useRef<string | null>(null)
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        link: { openOnClick: false, autolink: true, HTMLAttributes: { rel: null, target: null } },
      }),
      TableKit.configure({ table: { resizable: false } }),
      TextStyle,
      Color,
      TextAlign.configure({ types: ['heading', 'paragraph'], alignments: ['left', 'center', 'right'] }),
      Image.configure({ inline: false }),
    ],
    content: html,
    onCreate: ({ editor }) => {
      baseline.current = editor.getHTML()
    },
    onBlur: ({ editor }) => {
      const out = editor.getHTML()
      if (out !== baseline.current) {
        baseline.current = out
        onChange(out)
      }
    },
  })
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e && {
        bold: e.isActive('bold'),
        italic: e.isActive('italic'),
        underline: e.isActive('underline'),
        h2: e.isActive('heading', { level: 2 }),
        h3: e.isActive('heading', { level: 3 }),
        ul: e.isActive('bulletList'),
        ol: e.isActive('orderedList'),
        link: e.isActive('link'),
        table: e.isActive('table'),
        quote: e.isActive('blockquote'),
        color: toHex((e.getAttributes('textStyle').color as string | undefined) ?? ''),
        align: ALIGN.find((a) => e.isActive({ textAlign: a.value }))?.value ?? 'left',
      },
  })
  if (!editor || !s) return null
  const c = () => editor.chain().focus()
  const btn = (label: string, active: boolean, run: () => void, title = label) => (
    <button type="button" className={active ? 'on' : undefined} title={title} aria-pressed={active} onMouseDown={(e) => e.preventDefault()} onClick={run}>
      {label}
    </button>
  )
  function applyLink() {
    const url = (linkUrl ?? '').trim()
    if (url === '') c().unsetLink().run()
    else c().extendMarkRange('link').setLink({ href: url, target: /^https?:/.test(url) ? '_blank' : null }).run()
    setLinkUrl(null)
  }
  async function image() {
    const [m] = await pickMedia('image')
    if (m) c().setImage({ src: m.url, alt: m.alt, width: m.width ?? undefined, height: m.height ?? undefined } as never).run()
  }
  return (
    <div className="ed-rich">
      <div className="ed-rich-bar" role="toolbar" aria-label="Форматиране">
        {btn('Ж', s.bold, () => c().toggleBold().run(), 'Удебелен')}
        {btn('К', s.italic, () => c().toggleItalic().run(), 'Курсив')}
        {btn('П', s.underline, () => c().toggleUnderline().run(), 'Подчертан')}
        <span className="ed-rich-sep" />
        {btn('З2', s.h2, () => c().toggleHeading({ level: 2 }).run(), 'Подзаглавие')}
        {btn('З3', s.h3, () => c().toggleHeading({ level: 3 }).run(), 'По-малко подзаглавие')}
        {btn('• Списък', s.ul, () => c().toggleBulletList().run())}
        {btn('1. Списък', s.ol, () => c().toggleOrderedList().run())}
        {btn('„ Цитат', s.quote, () => c().toggleBlockquote().run())}
        <span className="ed-rich-sep" />
        {ALIGN.map((a) => btn(a.label, s.align === a.value, () => (a.value === 'left' ? c().unsetTextAlign().run() : c().setTextAlign(a.value).run()), a.title))}
        <span className="ed-rich-sep" />
        <span className="ed-rich-colors" role="group" aria-label="Цвят на текста">
          {TEXT_COLORS.map((col) => (
            <button
              key={col.value}
              type="button"
              className={`ed-swatch${s.color === col.value ? ' on' : ''}`}
              style={{ background: col.value }}
              title={`Цвят: ${col.label}`}
              aria-label={`Цвят: ${col.label}`}
              aria-pressed={s.color === col.value}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => c().setColor(col.value).run()}
            />
          ))}
          <label className="ed-swatch custom" title="Друг цвят">
            <input type="color" aria-label="Друг цвят" value={/^#[0-9a-f]{6}$/i.test(s.color) ? s.color : '#13232e'} onChange={(e) => c().setColor(e.target.value).run()} />
          </label>
          {btn('Без цвят', false, () => c().unsetColor().run(), 'Премахни цвета')}
        </span>
        <span className="ed-rich-sep" />
        {btn('Връзка', s.link, () => setLinkUrl((editor.getAttributes('link').href as string | undefined) ?? ''), 'Връзка към страница или външен адрес')}
        {btn('Снимка', false, image, 'Снимка в текста')}
        {!s.table && btn('Таблица', false, () => c().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run())}
        {s.table && (
          <>
            {btn('+ ред', false, () => c().addRowAfter().run())}
            {btn('+ колона', false, () => c().addColumnAfter().run())}
            {btn('− ред', false, () => c().deleteRow().run())}
            {btn('− колона', false, () => c().deleteColumn().run())}
            {btn('Без таблица', false, () => c().deleteTable().run())}
          </>
        )}
        {btn('Изчисти', false, () => c().unsetAllMarks().unsetTextAlign().run(), 'Премахни форматирането на избрания текст')}
      </div>
      {linkUrl !== null && (
        <div className="ed-rich-link" onMouseDown={(e) => e.target instanceof HTMLButtonElement && e.preventDefault()}>
          <PageLinkInput value={linkUrl} onChange={setLinkUrl} onEnter={applyLink} autoFocus aria-label="Адрес на връзката" />
          <button type="button" className="primary" onClick={applyLink}>
            Приложи
          </button>
          {s.link && (
            <button
              type="button"
              onClick={() => {
                c().unsetLink().run()
                setLinkUrl(null)
              }}
            >
              Премахни връзката
            </button>
          )}
          <button type="button" onClick={() => setLinkUrl(null)}>
            Отказ
          </button>
        </div>
      )}
      <EditorContent editor={editor} className="prose ed-rich-body" />
    </div>
  )
}
