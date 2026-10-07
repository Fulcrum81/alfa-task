import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { APP_NAME } from '../config'
import { DevPanel } from './DevPanel'

export function Layout() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header__inner">
          <span className="brand">
            <span className="brand__mark">Н</span>
            {APP_NAME}
          </span>

          <nav className="nav">
            <NavLink to="/" end>
              Счета
            </NavLink>
            <NavLink to="/transfer">Перевод</NavLink>
            <NavLink to="/history">История</NavLink>
            <NavLink to="/cards">Карты</NavLink>
            {user?.role === 'admin' && <NavLink to="/admin">Админ</NavLink>}
          </nav>

          <div className="app-header__user">
            <span>{user?.fullName ?? 'Гость'}</span>
            <button type="button" className="btn btn--ghost btn--small" onClick={handleSignOut}>
              Выйти
            </button>
          </div>
        </div>
      </header>

      <main className="app-main">
        <Outlet />
      </main>

      <DevPanel />
    </div>
  )
}
