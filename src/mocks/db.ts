import type { Account, Card, Session, Transaction, User } from '../api/types'
import { seedAccounts, seedCards, seedTransactions, seedUsers } from './seed'

export interface DbShape {
  version: number
  seededAt: string
  seq: number
  users: User[]
  accounts: Account[]
  cards: Card[]
  transactions: Transaction[]
  sessions: Record<string, Session>
  /** Отозванные токены. Именно сюда обязан писать logout. */
  revokedTokens: string[]
  loginAttempts: Record<string, { fails: number; blockedUntil: number }>
  flags: { debug: boolean; instantPayments: boolean }
}

const STORAGE_KEY = 'nashbank.db.v1'

export function buildSeedDb(): DbShape {
  return {
    version: 1,
    seededAt: new Date().toISOString(),
    seq: 1,
    users: seedUsers(),
    accounts: seedAccounts(),
    cards: seedCards(),
    transactions: seedTransactions(),
    sessions: {},
    revokedTokens: [],
    loginAttempts: {},
    flags: { debug: false, instantPayments: false },
  }
}

/**
 * Состояние читается из localStorage на каждый запрос и пишется обратно
 * отдельным вызовом. Между чтением и записью есть окно, в котором
 * обработчики успевают перемешаться, — так воспроизводятся конкурентные
 * дефекты.
 */
export function readDb(): DbShape {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    const db = buildSeedDb()
    writeDb(db)
    return db
  }
  try {
    const parsed = JSON.parse(raw) as DbShape
    if (parsed?.version !== 1) {
      const db = buildSeedDb()
      writeDb(db)
      return db
    }
    return parsed
  } catch {
    const db = buildSeedDb()
    writeDb(db)
    return db
  }
}

export function writeDb(db: DbShape): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
}

export function resetDb(options: { keepToken?: string } = {}): DbShape {
  const next = buildSeedDb()
  if (options.keepToken) {
    const previous = readDb()
    const session = previous.sessions[options.keepToken]
    if (session) next.sessions[options.keepToken] = session
  }
  writeDb(next)
  return next
}

export function nextId(db: DbShape, prefix: string): string {
  return `${prefix}-${db.seq++}`
}
