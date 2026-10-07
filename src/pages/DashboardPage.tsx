import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import type { Account, Card } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { CURRENCY_SIGN } from '../config'

function maskAccountNumber(number: string): string {
  return `•••• ${number.slice(-4)}`
}

export function DashboardPage() {
  const { user } = useAuth()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [cards, setCards] = useState<Card[]>([])
  const [todayTotal, setTodayTotal] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([api.accounts(), api.cards()])
      .then(([accountList, cardList]) => {
        if (cancelled) return
        setAccounts(accountList)
        setCards(cardList)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Не удалось загрузить счета')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const first = accounts[0]
    if (!first) return
    let cancelled = false
    api
      .transactions({ accountId: first.id, period: 'today', limit: 100 })
      .then((page) => {
        if (!cancelled) setTodayTotal(page.total)
      })
      .catch(() => {
        if (!cancelled) setTodayTotal(null)
      })
    return () => {
      cancelled = true
    }
  }, [accounts])

  const total = accounts.reduce((sum, account) => sum + account.balance, 0)

  return (
    <>
      <h1 className="page-title">Здравствуйте, {user?.fullName}</h1>
      <p className="page-subtitle">Сводка по вашим продуктам</p>

      {error && <div className="alert alert--error">{error}</div>}

      <div className="card">
        <div className="total-row">
          <div>
            <div className="account-card__title">Всего на счетах</div>
            <div className="total-row__amount">
              {total} {CURRENCY_SIGN}
            </div>
          </div>
          <div className="muted small">
            Операций сегодня: {todayTotal ?? '—'}
            <br />
            Счетов: {accounts.length} · Карт: {cards.length}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="page-loader">Загрузка…</div>
      ) : (
        <div className="grid">
          {accounts.map((account) => (
            <div className="card" key={account.id}>
              <div className="account-card__title">{account.title}</div>
              <div className="account-card__amount">
                {account.balance.toFixed(2)} {CURRENCY_SIGN}
              </div>
              <div className="account-card__number">{maskAccountNumber(account.number)}</div>
              <div className="small muted" style={{ marginTop: 10 }}>
                <Link to={`/history?accountId=${account.id}`}>История операций</Link>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <div className="total-row">
          <div>
            <div className="account-card__title">Быстрые действия</div>
            <div className="small muted">Перевод между счетами или по реквизитам получателя</div>
          </div>
          <Link className="btn" to="/transfer">
            Сделать перевод
          </Link>
        </div>
      </div>
    </>
  )
}
