import { useCallback, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { api, tokenStore } from '../api/client'
import { useAuth } from '../auth/AuthContext'

interface StateSnapshot {
  seededAt: string
  accounts: Array<{ id: string; ownerId: string; title: string; balance: number }>
  sessions: number
  revokedTokens: number
  transactions: number
}

export function DevPanel() {
  const location = useLocation()
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<StateSnapshot | null>(null)

  const enabled = new URLSearchParams(location.search).has('debug')

  const refresh = useCallback(() => {
    api
      .state()
      .then(setState)
      .catch(() => setState(null))
  }, [])

  useEffect(() => {
    if (enabled && open) refresh()
  }, [enabled, open, refresh])

  if (!enabled) return null

  return (
    <div className="dev-panel">
      <div className="dev-panel__title">
        <span>Панель стенда</span>
        <button type="button" onClick={() => setOpen((value) => !value)}>
          {open ? 'свернуть' : 'развернуть'}
        </button>
      </div>

      {open && (
        <>
          <div>
            Пользователь: <code>{user?.login ?? '—'}</code> ({user?.role ?? '—'})
          </div>
          <div>
            Операций в базе: <code>{state?.transactions ?? '—'}</code>
          </div>
          <div>
            Активных токенов: <code>{state?.sessions ?? '—'}</code>, отозвано:{' '}
            <code>{state?.revokedTokens ?? '—'}</code>
          </div>
          <div>
            Данные засеяны: <code>{state?.seededAt?.slice(11, 19) ?? '—'}</code>
          </div>
          <ul style={{ margin: '8px 0 0', paddingLeft: 16 }}>
            {state?.accounts.map((account) => (
              <li key={account.id}>
                {account.id} · {account.ownerId} · {account.balance}
              </li>
            ))}
          </ul>
          <div className="dev-panel__actions">
            <button type="button" onClick={refresh}>
              обновить
            </button>
            <button
              type="button"
              onClick={() => {
                void api.reset(true).then(refresh)
              }}
            >
              сбросить данные
            </button>
            <button
              type="button"
              onClick={() => {
                void api.reset(false).then(() => {
                  tokenStore.clear()
                  window.location.reload()
                })
              }}
            >
              сбросить и выйти
            </button>
          </div>
        </>
      )}
    </div>
  )
}
