import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { TableKit } from '@tiptap/extension-table'

/** Редактор за форматиран текст. Резултатът се почиства отново на сървъра (Sanitizer::html). */
export default function RichEditor({ html, onChange }: { html: string; onChange(html: string): void }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        link: { openOnClick: false, autolink: true, HTMLAttributes: { rel: null, target: null } },
      }),
      TableKit.configure({ table: { resizable: false } }),
    ],
    content: html,
    onBlur: ({ editor }) => {
      const out = editor.getHTML()
      if (out !== html) onChange(out)
    },
  })
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e && {
        bold: e.isActive('bold'),
        italic: e.isActive('italic'),
        h2: e.isActive('heading', { level: 2 }),
        h3: e.isActive('heading', { level: 3 }),
        ul: e.isActive('bulletList'),
        ol: e.isActive('orderedList'),
        link: e.isActive('link'),
        table: e.isActive('table'),
        quote: e.isActive('blockquote'),
      },
  })
  if (!editor || !s) return null
  const c = () => editor.chain().focus()
  const btn = (label: string, active: boolean, run: () => void, title = label) => (
    <button type="button" className={active ? 'on' : undefined} title={title} aria-pressed={active} onMouseDown={(e) => e.preventDefault()} onClick={run}>
      {label}
    </button>
  )
  function link() {
    const prev = editor!.getAttributes('link').href as string | undefined
    const url = window.prompt('Адрес на връзката (празно — премахване). Вътрешни: /uslugi/kalibrirane', prev ?? '')
    if (url === null) return
    if (url === '') c().unsetLink().run()
    else c().extendMarkRange('link').setLink({ href: url, target: /^https?:/.test(url) ? '_blank' : null }).run()
  }
  return (
    <div className="ed-rich">
      <div className="ed-rich-bar" role="toolbar" aria-label="Форматиране">
        {btn('Ж', s.bold, () => c().toggleBold().run(), 'Удебелен')}
        {btn('К', s.italic, () => c().toggleItalic().run(), 'Курсив')}
        {btn('З2', s.h2, () => c().toggleHeading({ level: 2 }).run(), 'Подзаглавие')}
        {btn('З3', s.h3, () => c().toggleHeading({ level: 3 }).run(), 'По-малко подзаглавие')}
        {btn('• Списък', s.ul, () => c().toggleBulletList().run())}
        {btn('1. Списък', s.ol, () => c().toggleOrderedList().run())}
        {btn('„ Цитат', s.quote, () => c().toggleBlockquote().run())}
        {btn('Връзка', s.link, link)}
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
      </div>
      <EditorContent editor={editor} className="prose ed-rich-body" />
    </div>
  )
}
