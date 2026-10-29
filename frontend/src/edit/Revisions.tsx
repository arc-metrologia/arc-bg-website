import { useEffect, useState } from 'react'
import { api } from '../api'

/** Предишни версии на страница с възстановяване. В админа е в страничния панел, иначе — чекмедже. */
export default function Revisions({ pageId, onClose, onRestored, className = 'ed-drawer' }: { pageId: number; onClose(): void; onRestored(): void; className?: string }) {
  const [list, setList] = useState<{ id: number; created_at: string; user_name: string | null }[] | null>(null)
  useEffect(() => {
    api<typeof list>(`admin/pages/${pageId}/revisions`).then(setList)
  }, [pageId])
  return (
    <aside className={className} aria-label="Версии">
      <div className="ed-modal-head">
        <h2>Предишни версии</h2>
        <button type="button" onClick={onClose} aria-label="Затвори">
          ✕
        </button>
      </div>
      <p className="ed-hint">Всяко записване пази предишното състояние. Възстановяването също се записва като нова версия, така че нищо не се губи.</p>
      {list === null ? (
        <p>Зареждане…</p>
      ) : list.length === 0 ? (
        <p>Още няма предишни версии.</p>
      ) : (
        <ul className="ed-revs">
          {list.map((r) => (
            <li key={r.id}>
              <span>
                {new Date(r.created_at.replace(' ', 'T')).toLocaleString('bg-BG')} · {r.user_name ?? 'системата'}
              </span>
              <button
                type="button"
                onClick={async () => {
                  if (!confirm('Да възстановя ли тази версия? Текущото съдържание ще бъде запазено като версия.')) return
                  await api(`admin/revisions/${r.id}/restore`, { method: 'POST' })
                  onRestored()
                }}
              >
                Възстановете
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  )
}
