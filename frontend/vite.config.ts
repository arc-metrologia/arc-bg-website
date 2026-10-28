import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Билдът отива в backend/build — PHP (index.php) чете build/index.html като шаблон
// и вмъква в него SEO мета таговете, сървърния HTML и данните на страницата.
const php = 'http://localhost:8000'

export default defineConfig({
  plugins: [react()],
  base: '/build/',
  build: {
    outDir: '../backend/build',
    emptyOutDir: true,
    // Без data: URI — CSP разрешава шрифтове и изображения само от собствения домейн.
    assetsInlineLimit: 0,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': php,
      '/uploads': php,
      '/logo-arc.svg': php,
      '/logo-arc-white.svg': php,
    },
  },
})
