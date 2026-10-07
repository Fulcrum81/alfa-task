import type { Account, Card, Transaction, TxDirection, TxStatus, User } from '../api/types'

/**
 * Детерминированное сидирование: одинаковый набор данных у каждого
 * кандидата, чтобы автотесты не зависели от случайности.
 */
export const SEED = 20240517

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function seedUsers(): User[] {
  return [
    {
      id: 'u-1',
      login: 'ivanov',
      password: 'password123',
      fullName: 'Иван Иванов',
      role: 'user',
      phone: '+7 900 000-00-01',
    },
    {
      id: 'u-2',
      login: 'petrova',
      password: 'qwerty123',
      fullName: 'Мария Петрова',
      role: 'user',
      phone: '+7 900 000-00-02',
    },
    {
      id: 'u-3',
      login: 'admin',
      password: 'admin123',
      fullName: 'Администратор Стенда',
      role: 'admin',
      phone: '+7 900 000-00-03',
    },
  ]
}

export function seedAccounts(): Account[] {
  return [
    {
      id: 'acc-1',
      ownerId: 'u-1',
      title: 'Текущий счёт',
      number: '40817810099910004312',
      currency: 'BYN',
      balance: 1284.51,
      kind: 'current',
    },
    {
      id: 'acc-2',
      ownerId: 'u-1',
      title: 'Накопительный счёт',
      number: '40817810599910001127',
      currency: 'BYN',
      balance: 5400,
      kind: 'savings',
    },
    {
      id: 'acc-3',
      ownerId: 'u-2',
      title: 'Текущий счёт',
      number: '40817810099910007788',
      currency: 'BYN',
      balance: 932.1,
      kind: 'current',
    },
    {
      id: 'acc-4',
      ownerId: 'u-2',
      title: 'Вклад «Копилка»',
      number: '40817810599910009901',
      currency: 'BYN',
      balance: 150,
      kind: 'savings',
    },
  ]
}

export function seedCards(): Card[] {
  return [
    {
      id: 'card-1',
      ownerId: 'u-1',
      accountId: 'acc-1',
      pan: '4276380012345678',
      cvv: '482',
      expiry: '12/27',
      holder: 'IVAN IVANOV',
      blocked: false,
      dailyLimit: 1500,
    },
    {
      id: 'card-2',
      ownerId: 'u-2',
      accountId: 'acc-3',
      pan: '4276380098765432',
      cvv: '915',
      expiry: '04/28',
      holder: 'MARIIA PETROVA',
      blocked: false,
      dailyLimit: 1000,
    },
  ]
}

const EXPENSES: Array<[string, string]> = [
  ['Пятёрочка', 'Супермаркеты'],
  ['Магнит', 'Супермаркеты'],
  ['ВкусВилл', 'Супермаркеты'],
  ['Яндекс Такси', 'Транспорт'],
  ['Метро Москва', 'Транспорт'],
  ['АЗС Лукойл', 'Транспорт'],
  ['МТС', 'Связь'],
  ['МегаФон', 'Связь'],
  ['ЖКХ Москва', 'ЖКХ'],
  ['Аптека 36,6', 'Здоровье'],
  ['Кафе Пушкин', 'Кафе и рестораны'],
  ['Кофейня Daily Cup', 'Кафе и рестораны'],
  ['Ozon', 'Маркетплейсы'],
  ['Wildberries', 'Маркетплейсы'],
  ['Кино Октябрь', 'Развлечения'],
  ['Steam', 'Развлечения'],
]

const INCOMES: Array<[string, string]> = [
  ['Зарплата ООО «Ромашка»', 'Зарплата'],
  ['Перевод от Анны К.', 'Переводы'],
  ['Кэшбэк по карте', 'Бонусы'],
  ['Возврат Ozon', 'Возвраты'],
]

export function seedTransactions(): Transaction[] {
  const rnd = mulberry32(SEED)
  const out: Transaction[] = []
  const now = Date.now()
  let n = 1

  const push = (
    accountId: string,
    when: Date,
    amount: number,
    direction: TxDirection,
    counterparty: string,
    category: string,
    status: TxStatus = 'done',
  ) => {
    out.push({
      id: `tx-${String(n++).padStart(4, '0')}`,
      accountId,
      counterparty,
      amount: Number(Math.abs(amount).toFixed(2)),
      direction,
      category,
      status,
      createdAt: when.toISOString(),
    })
  }

  const randomDay = (daysBack: number) => {
    const d = new Date(now - Math.floor(rnd() * daysBack) * 86_400_000)
    d.setHours(8 + Math.floor(rnd() * 13), Math.floor(rnd() * 60), 0, 0)
    // Операция не может быть датирована будущим временем.
    if (d.getTime() > now) d.setDate(d.getDate() - 1)
    return d
  }

  const pick = <T,>(list: T[]): T => list[Math.floor(rnd() * list.length)]

  // acc-1: 187 расходов + 8 зачислений + 2 операции сегодня + 2 незавершённые
  // = 199 записей. 199 не делится на 10 нацело — поэтому потеря последней
  // страницы видна на счётчике «страниц: 19» при 20 фактических.
  for (let i = 0; i < 187; i++) {
    const [cp, cat] = pick(EXPENSES)
    push('acc-1', randomDay(120), 2.5 + rnd() * 90, 'out', cp, cat)
  }
  for (let i = 0; i < 8; i++) {
    const [cp, cat] = pick(INCOMES)
    push('acc-1', randomDay(120), 400 + Math.floor(rnd() * 2_100), 'in', cp, cat)
  }

  // Операции, сделанные «сегодня» сразу после местной полуночи.
  // Нужны для проверки фильтра периода «Сегодня».
  const midnight = new Date()
  midnight.setHours(0, 0, 0, 0)
  const clamp = (d: Date) => (d.getTime() > now ? new Date(now) : d)
  push('acc-1', clamp(new Date(midnight.getTime() + 30 * 60_000)), 18.9, 'out', 'Прокат самокатов Whoosh', 'Транспорт')
  push('acc-1', clamp(new Date(midnight.getTime() + 75 * 60_000)), 4.5, 'out', 'Кофейня Daily Cup', 'Кафе и рестораны')

  // Операции в незавершённых состояниях.
  push('acc-1', new Date(now - 2 * 3_600_000), 32.9, 'out', 'Ozon', 'Маркетплейсы', 'pending')
  push('acc-1', new Date(now - 5 * 3_600_000), 12.9, 'out', 'Steam', 'Развлечения', 'failed')

  // acc-2: накопительный счёт владельца.
  for (let i = 0; i < 40; i++) {
    const [cp, cat] = pick(INCOMES)
    push('acc-2', randomDay(180), 50 + Math.floor(rnd() * 450), 'in', cp, cat)
  }

  // acc-3: счёт второго пользователя — нужен для проверки доступа к чужим данным.
  for (let i = 0; i < 33; i++) {
    const [cp, cat] = pick(EXPENSES)
    push('acc-3', randomDay(90), 3 + Math.floor(rnd() * 60), 'out', cp, cat)
  }

  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}
