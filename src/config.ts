export const BASE_URL = import.meta.env.BASE_URL

/** Префикс «API». Учитывает base path GitHub Pages. */
export const API = `${BASE_URL.replace(/\/$/, '')}/api`

export const APP_NAME = 'Наш банк'
export const SUPPORT_PHONE = '+375 17 000-00-00'

/** Белорусский рубль. */
export const CURRENCY_CODE = 'BYN'
export const CURRENCY_SIGN = 'Br'

/** Сколько неудачных вводов пароля допускается до блокировки (требование ТЗ). */
export const MAX_LOGIN_ATTEMPTS = 3
/** Длительность блокировки входа (требование ТЗ). */
export const LOGIN_LOCK_MS = 5 * 60_000

/** Тариф: 1,5 % с округлением до копеек. */
export const TRANSFER_FEE_RATE = 0.015
/** Дневной лимит переводов (требование ТЗ). */
export const DAILY_TRANSFER_LIMIT = 1_000
