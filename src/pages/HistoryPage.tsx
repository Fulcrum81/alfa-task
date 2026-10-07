import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import type { Account, TransactionPage } from '../api/types'
import { formatDateTime, formatMoney } from '../lib/format'
import { CURRENCY_SIGN } from '../config'

export function HistoryPage() {
  const [searchParams] = useSearchParams()
  const preselected = searchParams.get('accountId') ?? ''

  const [accounts, setAccounts] = useState<Account[]>([])
  const [accountId, setAccountId] = useState(preselected)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [queryInput, setQueryInput] = useState('')
  const [query, setQuery] = useState('')
  const [period, setPeriod] = useState<'all' | 'today'>('all')
  const [direction, setDirection] = useState<'all' | 'in' | 'out'>('all')
  const [sort, setSort] = useState<'date' | 'amount' | 'amount-desc'>('date')
  const [data, setData] = useState<TransactionPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    api
      .accounts()
      .then((list) => {
        if (cancelled) return
        setAccounts(list)
        setAccountId((current) => current || list[0]?.id || '')
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Не удалось загрузить счета')
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!accountId) return
    let cancelled = false
    setLoading(true)
    api
      .transactions({ accountId, page, limit, q: query, period, direction, sort })
      .then((result) => {
        if (!cancelled) {
          setData(result)
          setError(null)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Не удалось загрузить историю')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [accountId, page, limit, query, period, direction, sort])

  const total = data?.total ?? 0
  const pages = Math.max(1, Math.floor(total / limit))
  const items = data?.items ?? []

  const applySearch = () => {
    setQuery(queryInput)
    setPage(1)
  }

  return (
    <>
      <h1 className="page-title">История операций</h1>
      <p className="page-subtitle">Операции по счёту с фильтрами и поиском</p>

      {error && <div className="alert alert--error">{error}</div>}

      <div className="card">
        <div className="toolbar">
          <label className="field">
            <span className="field__label">Счёт</span>
            <select
              name="accountId"
              value={accountId}
              onChange={(event) => {
                setAccountId(event.target.value)
                setPage(1)
              }}
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.title}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="field__label">Период</span>
            <select
              name="period"
              value={period}
              onChange={(event) => {
                setPeriod(event.target.value as 'all' | 'today')
                setPage(1)
              }}
            >
              <option value="all">За всё время</option>
              <option value="today">Сегодня</option>
            </select>
          </label>

          <label className="field">
            <span className="field__label">Тип</span>
            <select
              name="direction"
              value={direction}
              onChange={(event) => {
                setDirection(event.target.value as 'all' | 'in' | 'out')
                setPage(1)
              }}
            >
              <option value="all">Все</option>
              <option value="out">Списания</option>
              <option value="in">Зачисления</option>
            </select>
          </label>

          <label className="field">
            <span className="field__label">Сортировка</span>
            <select
              name="sort"
              value={sort}
              onChange={(event) => {
                setSort(event.target.value as 'date' | 'amount' | 'amount-desc')
                setPage(1)
              }}
            >
              <option value="date">По дате</option>
              <option value="amount">По сумме (возр.)</option>
              <option value="amount-desc">По сумме (убыв.)</option>
            </select>
          </label>

          <label className="field" style={{ minWidth: 220 }}>
            <span className="field__label">Поиск по контрагенту</span>
            <input
              type="text"
              name="q"
              value={queryInput}
              onChange={(event) => setQueryInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') applySearch()
              }}
            />
          </label>

          <button type="button" className="btn btn--ghost" onClick={applySearch}>
            Найти
          </button>
          <label className="field">
            <span className="field__label">На странице</span>
            <select
              name="limit"
              value={limit}
              onChange={(event) => {
                setLimit(Number(event.target.value))
                setPage(1)
              }}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </label>
        </div>

        <div className="small muted" style={{ marginBottom: 8 }}>
          Найдено: {total} операций · страниц: {pages} · показано: {items.length}
        </div>

        <table className="table">
          <thead>
            <tr>
              <th>Дата</th>
              <th>Контрагент</th>
              <th>Категория</th>
              <th style={{ textAlign: 'right' }}>Сумма</th>
              <th>Статус</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td className="small">{formatDateTime(item.createdAt)}</td>
                <td>
                  {item.counterparty}
                  {item.comment && <div className="small muted">{item.comment}</div>}
                </td>
                <td className="small muted">{item.category}</td>
                <td className={`amount ${item.direction === 'in' ? 'amount--in' : 'amount--out'}`}>
                  {item.direction === 'in' ? '+' : '−'}
                  {formatMoney(item.amount)} {CURRENCY_SIGN}
                </td>
                <td>
                  <span
                    className={
                      item.status === 'done'
                        ? 'badge'
                        : item.status === 'pending'
                          ? 'badge badge--pending'
                          : 'badge badge--failed'
                    }
                  >
                    {item.status === 'done'
                      ? 'Исполнено'
                      : item.status === 'pending'
                        ? 'В обработке'
                        : 'Ошибка'}
                  </span>
                </td>
              </tr>
            ))}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={5} className="muted" style={{ padding: 20, textAlign: 'center' }}>
                  Операции не найдены
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="pagination">
          <button
            type="button"
            className="btn btn--ghost btn--small"
            disabled={page <= 1}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
          >
            Назад
          </button>
          <span className="small muted">
            Страница {page} из {pages}
          </span>
          <button
            type="button"
            className="btn btn--ghost btn--small"
            disabled={page >= pages}
            onClick={() => setPage((value) => value + 1)}
          >
            Вперёд
          </button>
          {loading && <span className="small muted">загрузка…</span>}
        </div>
      </div>
    </>
  )
}
