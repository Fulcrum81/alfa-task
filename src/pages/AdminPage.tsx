import { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { Transaction } from '../api/types'
import { formatDateTime, formatMoney } from '../lib/format'
import { CURRENCY_SIGN } from '../config'

export function AdminPage() {
  const [items, setItems] = useState<Transaction[]>([])
  const [total, setTotal] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    api
      .adminOperations()
      .then((result) => {
        if (cancelled) return
        setItems(result.items)
        setTotal(result.total)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Раздел недоступен')
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <>
      <h1 className="page-title">Операции клиентов</h1>
      <p className="page-subtitle">Служебный раздел · всего операций: {total}</p>

      {error && <div className="alert alert--error">{error}</div>}

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Дата</th>
              <th>Счёт</th>
              <th>Контрагент</th>
              <th style={{ textAlign: 'right' }}>Сумма</th>
              <th>Статус</th>
            </tr>
          </thead>
          <tbody>
            {items.slice(0, 50).map((item) => (
              <tr key={item.id}>
                <td className="small">{formatDateTime(item.createdAt)}</td>
                <td className="small muted">{item.accountId}</td>
                <td>{item.counterparty}</td>
                <td className="amount">{formatMoney(item.amount)} {CURRENCY_SIGN}</td>
                <td className="small muted">{item.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
