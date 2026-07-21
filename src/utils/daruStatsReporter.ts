import type { DimensionPair, QuizResult } from '../types/quiz'

const REPORTED_STORAGE_KEY = 'daru:reported-submissions'
const REPORTED_STORAGE_PREFIX = 'daru_reported_'

const CHARACTER_NAME_ALIASES: Record<string, string> = {
  高烯月: '高晞月',
}

type DaruResultPayload = {
  submissionId: string
  characterName: string
  mbti: string
  matchingScore: number
  dimensions: Record<DimensionPair, number>
  traits: {
    体面: number
    少年郎: number
    安分: number
    道德资本: number
    出身: number
    心机: number
  }
}

function isDebugRuntime() {
  return import.meta.env.DEV ||
    (typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname))
}

function debugLog(message: string, data?: unknown) {
  if (!isDebugRuntime()) return
  if (data === undefined) {
    console.info(`[daru-report] ${message}`)
    return
  }
  console.info(`[daru-report] ${message}`, data)
}

async function readResponseBody(response: Response) {
  const contentType = response.headers.get('Content-Type') ?? ''
  try {
    return contentType.includes('application/json') ? await response.json() : await response.text()
  } catch {
    return null
  }
}

function readReportedIds() {
  try {
    return new Set(JSON.parse(localStorage.getItem(REPORTED_STORAGE_KEY) || '[]') as string[])
  } catch {
    return new Set<string>()
  }
}

function isReported(submissionId: string) {
  try {
    return localStorage.getItem(`${REPORTED_STORAGE_PREFIX}${submissionId}`) === '1' ||
      readReportedIds().has(submissionId)
  } catch {
    return false
  }
}

function markReported(submissionId: string) {
  try {
    const ids = readReportedIds()
    ids.add(submissionId)
    localStorage.setItem(REPORTED_STORAGE_KEY, JSON.stringify([...ids].slice(-100)))
    localStorage.setItem(`${REPORTED_STORAGE_PREFIX}${submissionId}`, '1')
  } catch {
    // Reporting is best effort and must never block result display.
  }
}

function normalizeCharacterName(name: string) {
  return CHARACTER_NAME_ALIASES[name] ?? name
}

function toPayload(result: QuizResult): DaruResultPayload | null {
  const submissionId = result.submissionId
  const matchedCharacter = result.matchedCharacter
  const topMatch = result.daruCharacterMatches?.[0]
  const dimensions = result.rawDimensionScores
  const traits = result.daruTraitScores

  if (!submissionId || !matchedCharacter || !topMatch || !dimensions || !traits) {
    return null
  }

  return {
    submissionId,
    characterName: normalizeCharacterName(matchedCharacter.name),
    mbti: result.mbtiCode,
    matchingScore: topMatch.totalScore,
    dimensions: {
      E_I: dimensions.E_I,
      S_N: dimensions.S_N,
      T_F: dimensions.T_F,
      J_P: dimensions.J_P,
    },
    traits: {
      体面: traits.体面,
      少年郎: traits.少年郎,
      安分: traits.安分,
      道德资本: traits.道德资本,
      出身: traits.出身,
      心机: traits.心机,
    },
  }
}

export async function reportDaruResult(result: QuizResult) {
  debugLog('submissionId', result.submissionId)
  const payload = toPayload(result)
  if (!payload) {
    debugLog('skip: missing required payload fields', {
      hasSubmissionId: !!result.submissionId,
      hasMatchedCharacter: !!result.matchedCharacter,
      hasTopMatch: !!result.daruCharacterMatches?.[0],
      hasDimensions: !!result.rawDimensionScores,
      hasTraits: !!result.daruTraitScores,
    })
    return
  }

  debugLog('start', payload)

  if (isReported(payload.submissionId)) {
    debugLog('skip: already reported', payload.submissionId)
    return
  }

  try {
    debugLog('request: sending')
    const response = await fetch('/api/results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const responseBody = await readResponseBody(response)
    debugLog(response.ok ? 'response: ok' : 'response: failed', {
      status: response.status,
      body: responseBody,
    })

    if (response.ok) {
      markReported(payload.submissionId)
    }
  } catch (err) {
    debugLog('exception', err instanceof Error ? err.message : err)
    // Network/API failures should not affect the visible result page.
  }
}
