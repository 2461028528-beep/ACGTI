import type { QuizRecord } from '../types/quiz'

const STORAGE_KEY = 'daru:last-result'
const LEGACY_STORAGE_KEY = 'acgti:last-result'

export function loadLastRecord(): QuizRecord | null {
  if (typeof window === 'undefined') {
    return null
  }

  window.localStorage.removeItem(LEGACY_STORAGE_KEY)
  const raw = window.localStorage.getItem(STORAGE_KEY)

  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw) as QuizRecord
  } catch {
    window.localStorage.removeItem(STORAGE_KEY)
    return null
  }
}

export function saveLastRecord(record: QuizRecord) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.removeItem(LEGACY_STORAGE_KEY)
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(record))
}

export function clearLastRecord() {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.removeItem(LEGACY_STORAGE_KEY)
  window.localStorage.removeItem(STORAGE_KEY)
}
