import { useEffect, useState, type FormEvent } from 'react'
import { api } from '../api/client'
import type { Account } from '../api/types'
import { CURRENCY_SIGN, TRANSFER_FEE_RATE } from '../config'
import { newIdempotencyKey } from '../lib/format'

export function TransferPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [mode, setMode] = useState<'internal' | 'external'>('external')
  const [fromAccountId, setFromAccountId] = useState('')
  const [toAccountId, setToAccountId] = useState('')
  const [recipient, setRecipient] = useState('')
  const [amount, setAmount] = useState('')
  const [comment, setComment] = useState('')
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    api
      .accounts()
      .then((list) => {
        if (cancelled) return
        setAccounts(list)
        setFromAccountId(list[0]?.id ?? '')
        setToAccountId(list[1]?.id ?? '')
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Не удалось загрузить счета')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const selectedAccount = accounts.find((account) => account.id === fromAccountId)
  // Счёт зачисления не может совпадать со счётом списания.
  const targetAccounts = accounts.filter((account) => account.id !== fromAccountId)
  const targetAccountId = targetAccounts.some((account) => account.id === toAccountId)
    ? toAccountId
    : (targetAccounts[0]?.id ?? '')

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setSuccess(null)
    setBusy(true)
    try {
      const result = await api.transfer(
        mode === 'internal'
          ? { fromAccountId, toAccountId: targetAccountId, amount, comment }
          : { fromAccountId, recipient, amount, comment },
        idempotencyKey,
      )
      setSuccess(
        `Перевод выполнен. Сумма: ${result.transaction.amount} ${CURRENCY_SIGN}, ` +
          `комиссия: ${result.fee} ${CURRENCY_SIGN}, списано: ${result.total} ${CURRENCY_SIGN}. ` +
          `Баланс счёта: ${result.balance} ${CURRENCY_SIGN}.`,
      )
      setIdempotencyKey(newIdempotencyKey())
      setAmount('')
      setComment('')
      const refreshed = await api.accounts()
      setAccounts(refreshed)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Перевод не выполнен')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <h1 className="page-title">Новый перевод</h1>
      <p className="page-subtitle">
        Комиссия за перевод по реквизитам получателя —{' '}
        {(TRANSFER_FEE_RATE * 100).toLocaleString('ru-RU')} % от суммы с округлением до копеек. Между
        своими счетами комиссия не взимается.
      </p>

      {error && <div className="alert alert--error">{error}</div>}
      {success && <div className="alert alert--ok">{success}</div>}

      <div className="card">
        <form onSubmit={handleSubmit} name="transfer">
          <div className="radio-row">
            <label>
              <input
                type="radio"
                name="mode"
                checked={mode === 'external'}
                onChange={() => setMode('external')}
              />
              По реквизитам получателя
            </label>
            <label>
              <input
                type="radio"
                name="mode"
                checked={mode === 'internal'}
                onChange={() => setMode('internal')}
              />
              Между своими счетами
            </label>
          </div>

          <label className="field">
            <span className="field__label">Счёт списания</span>
            <select
              name="fromAccountId"
              value={fromAccountId}
              onChange={(event) => setFromAccountId(event.target.value)}
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.title} · {account.balance.toFixed(2)} {CURRENCY_SIGN}
                </option>
              ))}
            </select>
          </label>

          {mode === 'internal' ? (
            <label className="field">
              <span className="field__label">Счёт зачисления</span>
              <select
                name="toAccountId"
                value={targetAccountId}
                onChange={(event) => setToAccountId(event.target.value)}
              >
                {targetAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.title} · {account.balance.toFixed(2)} {CURRENCY_SIGN}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="field">
              <span className="field__label">Номер карты или телефона получателя</span>
              <input
                type="text"
                name="recipient"
                placeholder="4276 0000 0000 0000"
                value={recipient}
                onChange={(event) => setRecipient(event.target.value)}
                required
              />
            </label>
          )}

          <label className="field">
            <span className="field__label">Сумма</span>
            <input
              type="text"
              name="amount"
              inputMode="decimal"
              placeholder="0,00"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              required
            />
          </label>

          <label className="field">
            <span className="field__label">Комментарий</span>
            <input
              type="text"
              name="comment"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
            />
          </label>

          <div className="small muted" style={{ marginBottom: 12 }}>
            Доступно на счёте: {selectedAccount ? selectedAccount.balance.toFixed(2) : '—'}{' '}
            {CURRENCY_SIGN}
          </div>

          <button className="btn" type="submit" name="submit-transfer">
            {busy ? 'Отправляем…' : 'Перевести'}
          </button>
        </form>
      </div>
    </>
  )
}
