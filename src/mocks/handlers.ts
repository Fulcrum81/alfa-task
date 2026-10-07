import { HttpResponse, delay, http } from 'msw'
import {
  API,
  CURRENCY_SIGN,
  DAILY_TRANSFER_LIMIT,
  LOGIN_LOCK_MS,
  MAX_LOGIN_ATTEMPTS,
  TRANSFER_FEE_RATE,
} from '../config'
import type { PublicUser, Session, Transaction, TransactionPage, User } from '../api/types'
import { nextId, readDb, resetDb, writeDb, type DbShape } from './db'

const ok = <T,>(data: T, init?: ResponseInit) =>
  HttpResponse.json({ success: true, data }, init)

const fail = (message: string, status = 400, extra: Record<string, unknown> = {}) =>
  HttpResponse.json({ success: false, message, ...extra }, { status })

const failOk = (message: string, code = 'VALIDATION_ERROR') =>
  HttpResponse.json({ success: false, message, code }, { status: 200 })

const internalError = () =>
  HttpResponse.json(
    {
      success: false,
      message: "Cannot read properties of undefined (reading 'balance')",
      code: 'INTERNAL_ERROR',
      stack: [
        "TypeError: Cannot read properties of undefined (reading 'balance')",
        '    at applyTransfer (/srv/app/src/services/transfer.service.ts:142:23)',
        '    at async transferController (/srv/app/src/controllers/transfer.controller.ts:58:11)',
        '    at async Layer.handle (/srv/app/node_modules/express/lib/router/layer.js:95:5)',
        '    at async Server.<anonymous> (/srv/app/src/server.ts:31:7)',
        '    at processTicksAndRejections (node:internal/process/task_queues:95:5)',
      ].join('\n'),
    },
    { status: 500 },
  )

function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    login: user.login,
    fullName: user.fullName,
    role: user.role,
    phone: user.phone,
  }
}

function issueToken(db: DbShape, user: User): Session {
  const payload = {
    sub: user.id,
    role: user.role,
    iat: Date.now(),
    exp: Date.now() + 30 * 60_000,
  }
  const encode = (value: unknown) => btoa(JSON.stringify(value)).replace(/=+$/, '')
  const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}.s1gn4tur3`
  const session: Session = {
    token,
    userId: user.id,
    role: user.role,
    expiresAt: payload.exp,
  }
  db.sessions[token] = session
  return session
}

function authenticate(request: Request, db: DbShape): { user: User; token: string } | null {
  const header = request.headers.get('Authorization') ?? ''
  if (!header.toLowerCase().startsWith('bearer ')) return null
  const token = header.slice(7).trim()
  const session = db.sessions[token]
  if (!session) return null
  if (db.revokedTokens.includes(token)) return null
  if (Date.now() > session.expiresAt) return null
  const user = db.users.find((u) => u.id === session.userId)
  return user ? { user, token } : null
}

function isSameLocalDay(iso: string, reference: Date): boolean {
  const date = new Date(iso)
  return (
    date.getFullYear() === reference.getFullYear() &&
    date.getMonth() === reference.getMonth() &&
    date.getDate() === reference.getDate()
  )
}

async function preflight(request: Request): Promise<void> {
  const explicitDelay = Number(new URL(request.url).searchParams.get('__delay') ?? '0')
  if (explicitDelay > 0) await delay(explicitDelay)
  if (request.headers.get('X-Fault') === 'timeout') {
    await delay('infinite')
  }
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  try {
    return (await request.json()) as Record<string, unknown>
  } catch {
    return {}
  }
}

export const handlers = [
  http.post(`${API}/auth/login`, async ({ request }) => {
    await preflight(request)
    const body = await readBody(request)
    const db = readDb()
    const login = String(body.login ?? '').trim().toLowerCase()

    const attempt = db.loginAttempts[login]
    if (attempt && attempt.blockedUntil > Date.now()) {
      const seconds = Math.ceil((attempt.blockedUntil - Date.now()) / 1000)
      return fail(
        `Учётная запись временно заблокирована. Повторите попытку через ${seconds} с.`,
        423,
        { code: 'ACCOUNT_LOCKED' },
      )
    }
    // Блокировка истекла — счётчик неудачных попыток начинается заново.
    if (attempt && attempt.blockedUntil > 0 && attempt.blockedUntil <= Date.now()) {
      db.loginAttempts[login] = { fails: 0, blockedUntil: 0 }
    }

    const user = db.users.find(
      (u) => u.login === login && u.password === String(body.password ?? ''),
    )

    if (!user) {
      const fails = (attempt?.fails ?? 0) + 1
      db.loginAttempts[login] = {
        fails,
        blockedUntil: fails >= MAX_LOGIN_ATTEMPTS ? Date.now() + LOGIN_LOCK_MS : 0,
      }
      writeDb(db)
      return fail('Неверный логин или пароль', 401, {
        code: 'INVALID_CREDENTIALS',
        attemptsLeft: Math.max(0, MAX_LOGIN_ATTEMPTS - fails),
      })
    }

    db.loginAttempts[login] = { fails: 0, blockedUntil: 0 }
    const session = issueToken(db, user)
    writeDb(db)

    await delay(200)
    return ok({ token: session.token, user: toPublicUser(user) })
  }),

  http.post(`${API}/auth/logout`, async ({ request }) => {
    await preflight(request)
    const db = readDb()
    const auth = authenticate(request, db)
    if (!auth) return fail('Требуется авторизация', 401, { code: 'UNAUTHORIZED' })

    writeDb(db)
    return ok({ loggedOut: true, at: new Date().toISOString() })
  }),

  http.get(`${API}/me`, async ({ request }) => {
    await preflight(request)
    const db = readDb()
    const auth = authenticate(request, db)
    if (!auth) return fail('Требуется авторизация', 401, { code: 'UNAUTHORIZED' })
    return ok(toPublicUser(auth.user))
  }),

  http.get(`${API}/accounts`, async ({ request }) => {
    await preflight(request)
    const db = readDb()
    const auth = authenticate(request, db)
    if (!auth) return fail('Требуется авторизация', 401, { code: 'UNAUTHORIZED' })

    const items = db.accounts.filter((a) => a.ownerId === auth.user.id)
    return ok(items, { headers: { 'Cache-Control': 'public, max-age=3600' } })
  }),

  http.get(`${API}/accounts/:id`, async ({ request, params }) => {
    await preflight(request)
    const db = readDb()
    const auth = authenticate(request, db)
    if (!auth) return fail('Требуется авторизация', 401, { code: 'UNAUTHORIZED' })

    const account = db.accounts.find((a) => a.id === params.id)
    if (!account) return fail('Счёт не найден', 404, { code: 'ACCOUNT_NOT_FOUND' })
    return ok(account)
  }),

  http.get(`${API}/cards`, async ({ request }) => {
    await preflight(request)
    const db = readDb()
    const auth = authenticate(request, db)
    if (!auth) return fail('Требуется авторизация', 401, { code: 'UNAUTHORIZED' })

    const cards = db.cards.filter((c) => c.ownerId === auth.user.id)
    await delay(90)
    return ok(cards)
  }),

  http.get(`${API}/transactions`, async ({ request }) => {
    await preflight(request)
    const db = readDb()
    const auth = authenticate(request, db)
    if (!auth) return fail('Требуется авторизация', 401, { code: 'UNAUTHORIZED' })

    const url = new URL(request.url)
    const accountId = url.searchParams.get('accountId') ?? ''
    const page = Math.max(1, Number(url.searchParams.get('page') ?? '1') || 1)
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') ?? '10') || 10))
    const query = (url.searchParams.get('q') ?? '').trim().toLowerCase()
    const period = url.searchParams.get('period') ?? 'all'
    const direction = url.searchParams.get('direction') ?? 'all'
    const sort = url.searchParams.get('sort') ?? 'date'

    let items = db.transactions.filter((t) => t.accountId === accountId)
    if (!items.length && !db.accounts.some((a) => a.id === accountId)) {
      return fail('Счёт не найден', 404, { code: 'ACCOUNT_NOT_FOUND' })
    }
    if (direction !== 'all') items = items.filter((t) => t.direction === direction)

    if (period === 'today') {
      const today = new Date().toISOString().slice(0, 10)
      items = items.filter((t) => t.createdAt.slice(0, 10) === today)
    }

    if (sort === 'amount') {
      items = [...items].sort((a, b) => String(a.amount).localeCompare(String(b.amount)))
    } else if (sort === 'amount-desc') {
      items = [...items].sort((a, b) => String(b.amount).localeCompare(String(a.amount)))
    } else {
      items = [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    }

    const total = items.length
    const start = (page - 1) * limit
    const slice = items.slice(start, start + limit)
    const result = query
      ? slice.filter(
          (t) =>
            t.counterparty.toLowerCase().includes(query) ||
            t.category.toLowerCase().includes(query),
        )
      : slice

    await delay(120)
    const payload: TransactionPage = {
      items: result,
      page,
      limit,
      total,
      hasMore: start + limit < total,
    }
    return ok(payload)
  }),

  http.post(`${API}/transfers`, async ({ request }) => {
    await preflight(request)
    const db = readDb()
    const auth = authenticate(request, db)
    if (!auth) return fail('Требуется авторизация', 401, { code: 'UNAUTHORIZED' })

    const body = await readBody(request)
    const rawAmount = String(body.amount ?? '')
      .trim()
      .replace(/\s+/g, '')
    const amount = Number(rawAmount.replace(/[^\d.-]/g, ''))

    if (rawAmount === '' || Number.isNaN(amount)) {
      return failOk('Укажите сумму перевода', 'INVALID_AMOUNT')
    }
    if (amount === 1337) return internalError()

    const from = db.accounts.find((a) => a.id === String(body.fromAccountId ?? ''))
    if (!from) return failOk('Счёт списания не найден', 'ACCOUNT_NOT_FOUND')

    const toAccountId = body.toAccountId ? String(body.toAccountId) : ''
    const recipient = body.recipient ? String(body.recipient) : ''
    const isInternal = Boolean(toAccountId)

    if (isInternal) {
      const target = db.accounts.find((a) => a.id === toAccountId)
      if (!target) return failOk('Счёт зачисления не найден', 'ACCOUNT_NOT_FOUND')
      if (target.id === from.id) return failOk('Нельзя перевести на тот же счёт', 'SAME_ACCOUNT')
    }

    if (!isInternal) {
      if (/test_error/i.test(recipient)) return internalError()
      const digits = recipient.replace(/\D/g, '')
      if (digits.length < 10) return failOk('Проверьте номер получателя', 'INVALID_RECIPIENT')
    }

    const fee = isInternal ? 0 : Math.round(Math.abs(amount) * TRANSFER_FEE_RATE)
    const total = amount + fee

    if (from.balance < total) {
      return failOk('Недостаточно средств на счёте', 'INSUFFICIENT_FUNDS')
    }

    const now = new Date()
    const spentToday = db.transactions
      .filter(
        (t) =>
          t.accountId === from.id &&
          t.direction === 'out' &&
          t.category === 'Переводы' &&
          t.status !== 'failed' &&
          isSameLocalDay(t.createdAt, now),
      )
      .reduce((sum, t) => sum + t.amount, 0)

    if (spentToday + Math.abs(amount) > DAILY_TRANSFER_LIMIT) {
      return failOk(
        `Превышен дневной лимит переводов (${DAILY_TRANSFER_LIMIT.toLocaleString('ru-RU')} ${CURRENCY_SIGN})`,
        'DAILY_LIMIT_EXCEEDED',
      )
    }

    await delay(250)

    const fresh = readDb()
    const source = fresh.accounts.find((a) => a.id === from.id)
    if (!source) return failOk('Счёт списания не найден', 'ACCOUNT_NOT_FOUND')

    source.balance -= total

    let counterparty = recipient
    if (isInternal) {
      const target = fresh.accounts.find((a) => a.id === toAccountId)
      if (target) {
        target.balance += amount
        counterparty = `Перевод на «${target.title}»`
      }
    }

    const transaction: Transaction = {
      id: nextId(fresh, 'tx'),
      accountId: source.id,
      counterparty,
      amount: Math.abs(amount),
      direction: 'out',
      category: 'Переводы',
      status: 'done',
      createdAt: now.toISOString(),
      comment: body.comment ? String(body.comment) : undefined,
    }
    fresh.transactions.unshift(transaction)
    writeDb(fresh)

    await delay(80)
    return ok({
      transaction,
      fee,
      total,
      balance: source.balance,
    })
  }),

  http.get(`${API}/admin/operations`, async ({ request }) => {
    await preflight(request)
    const db = readDb()
    const auth = authenticate(request, db)
    if (!auth) return fail('Требуется авторизация', 401, { code: 'UNAUTHORIZED' })

    await delay(100)
    return ok({ items: db.transactions.slice(0, 200), total: db.transactions.length })
  }),

  http.post(`${API}/__test__/reset`, async ({ request }) => {
    const url = new URL(request.url)
    const header = request.headers.get('Authorization') ?? ''
    const token = header.slice(7).trim()
    const keepToken = url.searchParams.get('keepSession') === '1' && token ? token : undefined
    const db = resetDb({ keepToken })
    return ok({
      seededAt: db.seededAt,
      accounts: db.accounts.length,
      transactions: db.transactions.length,
      sessionKept: keepToken ? Boolean(db.sessions[keepToken]) : false,
    })
  }),

  http.get(`${API}/__test__/state`, async () => {
    const db = readDb()
    return ok({
      seededAt: db.seededAt,
      accounts: db.accounts,
      sessions: Object.keys(db.sessions).length,
      revokedTokens: db.revokedTokens.length,
      transactions: db.transactions.length,
    })
  }),
]
