export type Role = 'user' | 'admin'
export type AccountKind = 'current' | 'savings' | 'card'
export type TxDirection = 'in' | 'out'
export type TxStatus = 'done' | 'pending' | 'failed'
export type Currency = 'BYN'

export interface User {
  id: string
  login: string
  password: string
  fullName: string
  role: Role
  phone: string
}

/** Пользователь без секретов — то, что уходит в ответах API. */
export interface PublicUser {
  id: string
  login: string
  fullName: string
  role: Role
  phone: string
}

export interface Account {
  id: string
  ownerId: string
  title: string
  number: string
  currency: Currency
  balance: number
  kind: AccountKind
}

export interface Card {
  id: string
  ownerId: string
  accountId: string
  pan: string
  cvv: string
  expiry: string
  holder: string
  blocked: boolean
  dailyLimit: number
}

export interface Transaction {
  id: string
  accountId: string
  counterparty: string
  amount: number
  direction: TxDirection
  category: string
  status: TxStatus
  createdAt: string
  comment?: string
}

export interface Session {
  token: string
  userId: string
  role: Role
  expiresAt: number
}

export interface ApiOk<T> {
  success: true
  data: T
}

export interface ApiFail {
  success: false
  message: string
  code?: string
  stack?: string
}

export type ApiResponse<T> = ApiOk<T> | ApiFail

export interface TransactionPage {
  items: Transaction[]
  page: number
  limit: number
  total: number
  hasMore: boolean
}

export interface TransferRequest {
  fromAccountId: string
  /** Внутренний перевод между своими счетами. */
  toAccountId?: string
  /** Внешний перевод: номер карты или телефона получателя. */
  recipient?: string
  /** Сумма приходит строкой — как её ввёл пользователь. */
  amount: string | number
  comment?: string
}

export interface TransferResult {
  transaction: Transaction
  fee: number
  total: number
  balance: number
}
