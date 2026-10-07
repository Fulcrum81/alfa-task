import { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { Account, Card } from '../api/types'
import { maskPan } from '../lib/format'
import { CURRENCY_SIGN } from '../config'

export function CardsPage() {
  const [cards, setCards] = useState<Card[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [revealed, setRevealed] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([api.cards(), api.accounts()])
      .then(([cardList, accountList]) => {
        if (cancelled) return
        setCards(cardList)
        setAccounts(accountList)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Не удалось загрузить карты')
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <>
      <h1 className="page-title">Мои карты</h1>
      <p className="page-subtitle">Реквизиты показываются только по запросу</p>

      {error && <div className="alert alert--error">{error}</div>}

      <div className="grid">
        {cards.map((card) => {
          const account = accounts.find((item) => item.id === card.accountId)
          const isRevealed = revealed === card.id
          return (
            <div className="card" key={card.id}>
              <div className="card-visual">
                <div style={{ fontSize: 12, opacity: 0.85 }}>
                  {account?.title ?? 'Карта'} · {card.blocked ? 'заблокирована' : 'активна'}
                </div>
                <div className="card-visual__pan">{maskPan(card.pan)}</div>
                <div className="card-visual__row">
                  <span>{card.holder}</span>
                  <span>{card.expiry}</span>
                </div>
              </div>

              <div className="small muted" style={{ marginTop: 12 }}>
                Дневной лимит: {card.dailyLimit.toLocaleString('ru-RU')} {CURRENCY_SIGN}
              </div>

              {isRevealed && (
                <div className="alert alert--info" style={{ marginTop: 12 }}>
                  Номер карты: {card.pan}
                  <br />
                  CVV: {card.cvv}
                </div>
              )}

              <button
                type="button"
                className="btn btn--ghost btn--small"
                style={{ marginTop: 12 }}
                onClick={() => setRevealed(isRevealed ? null : card.id)}
              >
                {isRevealed ? 'Скрыть реквизиты' : 'Показать реквизиты'}
              </button>
            </div>
          )
        })}
      </div>
    </>
  )
}
