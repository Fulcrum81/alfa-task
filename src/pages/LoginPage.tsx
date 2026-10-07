import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { APP_NAME, SUPPORT_PHONE } from '../config'

export function LoginPage() {
  const { user, signIn } = useAuth()
  const navigate = useNavigate()

  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to="/" replace />

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await signIn(login, password)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось войти')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <h1>{APP_NAME}</h1>
        <p className="muted small">Вход в интернет-банк</p>

        {error && <div className="alert alert--error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <label className="field">
            <span className="field__label">Логин</span>
            <input
              type="text"
              name="login"
              autoComplete="username"
              value={login}
              onChange={(event) => setLogin(event.target.value)}
              required
            />
          </label>
          <label className="field">
            <span className="field__label">Пароль</span>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          <button className="btn" type="submit" disabled={busy} style={{ width: '100%' }}>
            {busy ? 'Проверяем…' : 'Войти'}
          </button>
        </form>

        <div className="small muted" style={{ marginTop: 18 }}>
          <div>Тестовые учётные записи:</div>
          <ul className="hint-list">
            <li>ivanov / password123 — клиент</li>
            <li>petrova / qwerty123 — клиент</li>
            <li>admin / admin123 — сотрудник</li>
          </ul>
          <div style={{ marginTop: 8 }}>Поддержка: {SUPPORT_PHONE}</div>
        </div>
      </div>
    </div>
  )
}
