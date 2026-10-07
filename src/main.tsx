import { createRoot } from 'react-dom/client'
import { BASE_URL } from './config'
import App from './App'
import './index.css'

function renderStartupError(container: HTMLElement, error: unknown): void {
  const box = document.createElement('div')
  box.className = 'alert alert--error'
  box.style.maxWidth = '640px'
  box.style.margin = '40px auto'
  box.textContent = `Не удалось запустить стенд: ${
    error instanceof Error ? error.message : String(error)
  }. Проверьте, что service worker доступен и страница открыта по HTTPS или на localhost.`
  container.replaceChildren(box)
}

async function bootstrap(): Promise<void> {
  const container = document.getElementById('root')
  if (!container) throw new Error('Не найден корневой контейнер приложения')

  try {
    const { worker } = await import('./mocks/browser')
    await worker.start({
      serviceWorker: { url: `${BASE_URL}mockServiceWorker.js` },
      onUnhandledRequest: 'bypass',
    })
  } catch (error) {
    // Без service worker API стенда недоступен — показываем причину,
    // а не пустой экран.
    renderStartupError(container, error)
    return
  }

  createRoot(container).render(<App />)
}

void bootstrap()
