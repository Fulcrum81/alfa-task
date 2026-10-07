import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base намеренно оставлен значением по умолчанию: для GitHub Pages
// он передаётся из workflow как --base=/<имя-репозитория>/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    watch: {
      // Редакторы и инструменты часто сохраняют файлы через временные
      // файлы. Если watcher попробует отслеживать такой файл в момент,
      // когда он заблокирован, Node падает с EBUSY и роняет dev-сервер.
      ignored: ['**/node_modules/**', '**/.git/**', '**/.*.tmpdir/**', '**/*.tmp'],
    },
  },
})
