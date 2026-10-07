import { API } from '../config'
import type {
  Account,
  Card,
  PublicUser,
  Transaction,
  TransactionPage,
  TransferRequest,
  TransferResult,
} from './types'

const TOKEN_KEY = 'nashbank.token'

export const tokenStore = {
  get: (): string | null => localStorage.getItem(TOKEN_KEY),
  set: (token: string): void => localStorage.setItem(TOKEN_KEY, token),
  clear: (): void => localStorage.removeItem(TOKEN_KEY),
}

export class ApiError extends Error {
  status: number
  code?: string

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

type RawBody<T> = { success?: boolean; data?: T; message?: string; code?: string } | null

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/json')
  if (init.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  const token = tokenStore.get()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const response = await fetch(`${API}${path}`, { ...init, headers })

  let payload: unknown = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }
  const body = payload as RawBody<T>

  if (!response.ok) {
    throw new ApiError(
      body?.message ?? `Ошибка запроса (${response.status})`,
      response.status,
      body?.code,
    )
  }
  if (body && body.success === false) {
    throw new ApiError(body.message ?? 'Неизвестная ошибка', response.status, body.code)
  }
  return body?.data as T
}

export interface LoginResult {
  token: string
  user: PublicUser
}

export interface TransactionQuery {
  accountId: string
  page?: number
  limit?: number
  q?: string
  period?: 'all' | 'today'
  direction?: 'all' | 'in' | 'out'
  sort?: 'date' | 'amount' | 'amount-desc'
}

export const api = {
  login: (login: string, password: string) =>
    request<LoginResult>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ login, password }),
    }),

  logout: () => request<{ loggedOut: boolean }>('/auth/logout', { method: 'POST' }),

  me: () => request<PublicUser>('/me'),

  accounts: () => request<Account[]>('/accounts'),

  account: (id: string) => request<Account>(`/accounts/${id}`),

  cards: () => request<Card[]>('/cards'),

  transactions: (params: TransactionQuery) => {
    const search = new URLSearchParams()
    search.set('accountId', params.accountId)
    if (params.page !== undefined) search.set('page', String(params.page))
    if (params.limit !== undefined) search.set('limit', String(params.limit))
    if (params.q) search.set('q', params.q)
    if (params.period) search.set('period', params.period)
    if (params.direction) search.set('direction', params.direction)
    if (params.sort) search.set('sort', params.sort)
    return request<TransactionPage>(`/transactions?${search.toString()}`)
  },

  transfer: (payload: TransferRequest, idempotencyKey?: string) =>
    request<TransferResult>('/transfers', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
    }),

  adminOperations: () =>
    request<{ items: Transaction[]; total: number }>('/admin/operations'),

  reset: (keepSession = false) =>
    request<{ seededAt: string; accounts: number; transactions: number; sessionKept: boolean }>(
      `/__test__/reset${keepSession ? '?keepSession=1' : ''}`,
      { method: 'POST' },
    ),

  state: () =>
    request<{
      seededAt: string
      accounts: Account[]
      sessions: number
      revokedTokens: number
      transactions: number
    }>('/__test__/state'),
}
