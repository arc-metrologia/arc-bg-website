import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import '@fontsource-variable/onest'
import '@fontsource-variable/unbounded'
import './styles/site.css'
import PublicSite from './site/PublicSite'
import type { Payload } from './types'

const AdminApp = lazy(() => import('./admin/AdminApp'))

/** Данните, които PHP е вградил в страницата — спестяват първата API заявка. */
function readInitial(): Payload | null {
  const el = document.getElementById('__DATA__')
  if (!el?.textContent) return null
  try {
    return JSON.parse(el.textContent) as Payload
  } catch {
    return null
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route
          path="/admin/*"
          element={
            <Suspense fallback={<div className="adm-loading">Зареждане…</div>}>
              <AdminApp />
            </Suspense>
          }
        />
        <Route path="*" element={<PublicSite initial={readInitial()} />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
