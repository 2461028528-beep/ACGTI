type D1Statement = {
  bind(...values: unknown[]): D1Statement
  run(): Promise<unknown>
}

type D1Database = {
  prepare(query: string): D1Statement
}

type PagesFunction<Environment> = (context: {
  request: Request
  env: Environment
}) => Response | Promise<Response>

type Env = {
  DB: D1Database
}

type DimensionPair = 'E_I' | 'S_N' | 'T_F' | 'J_P'
type TraitName = '体面' | '少年郎' | '安分' | '道德资本' | '出身' | '心机'

type ResultPayload = {
  submissionId?: unknown
  characterName?: unknown
  mbti?: unknown
  matchingScore?: unknown
  dimensions?: Partial<Record<DimensionPair, unknown>>
  traits?: Partial<Record<TraitName, unknown>>
}

const VALID_CHARACTERS = new Set([
  '如懿',
  '魏嬿婉',
  '苏绿筠',
  '富察琅嬅',
  '高晞月',
  '高烯月',
  '海兰',
  '凌云彻',
  '进忠',
  '金玉妍',
  '皇帝',
])

const VALID_MBTI = /^[EI][SN][TF][JP]$/
const TRAIT_NAMES: TraitName[] = ['体面', '少年郎', '安分', '道德资本', '出身', '心机']

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...init.headers,
    },
  })

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

const readRequiredNumber = (value: unknown) => {
  return isFiniteNumber(value) ? value : null
}

const readRangeNumber = (value: unknown, min: number, max: number) => {
  return isFiniteNumber(value) && value >= min && value <= max ? value : null
}

const normalizeCharacterName = (value: unknown) => {
  if (typeof value !== 'string') return null
  const name = value.trim()
  if (!VALID_CHARACTERS.has(name)) return null
  return name === '高烯月' ? '高晞月' : name
}

export const onRequest: PagesFunction<Env> = async (context) => {
  if (context.request.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, { status: 405, headers: { Allow: 'POST' } })
  }

  let payload: ResultPayload

  try {
    payload = await context.request.json() as ResultPayload
  } catch {
    return json({ error: 'invalid_json' }, { status: 400 })
  }

  const submissionId = typeof payload.submissionId === 'string' ? payload.submissionId.trim() : ''
  const characterName = normalizeCharacterName(payload.characterName)
  const mbti = typeof payload.mbti === 'string' ? payload.mbti.trim().toUpperCase() : ''
  const matchingScore = readRangeNumber(payload.matchingScore, 0, 100)

  const eIScore = readRequiredNumber(payload.dimensions?.E_I)
  const sNScore = readRequiredNumber(payload.dimensions?.S_N)
  const tFScore = readRequiredNumber(payload.dimensions?.T_F)
  const jPScore = readRequiredNumber(payload.dimensions?.J_P)

  const dignityScore = readRangeNumber(payload.traits?.体面, 1, 5)
  const youthScore = readRangeNumber(payload.traits?.少年郎, 1, 5)
  const stabilityScore = readRangeNumber(payload.traits?.安分, 1, 5)
  const moralityScore = readRangeNumber(payload.traits?.道德资本, 1, 5)
  const originScore = readRangeNumber(payload.traits?.出身, 1, 5)
  const schemingScore = readRangeNumber(payload.traits?.心机, 1, 5)

  const hasAllTraits = TRAIT_NAMES.every((trait) => readRangeNumber(payload.traits?.[trait], 1, 5) !== null)

  if (
    !submissionId ||
    submissionId.length > 128 ||
    !characterName ||
    !VALID_MBTI.test(mbti) ||
    matchingScore === null ||
    eIScore === null ||
    sNScore === null ||
    tFScore === null ||
    jPScore === null ||
    !hasAllTraits ||
    dignityScore === null ||
    youthScore === null ||
    stabilityScore === null ||
    moralityScore === null ||
    originScore === null ||
    schemingScore === null
  ) {
    return json({ error: 'invalid_payload' }, { status: 400 })
  }

  try {
    await context.env.DB.prepare(
      `INSERT OR IGNORE INTO test_results (
        submission_id,
        character_name,
        mbti,
        matching_score,
        e_i_score,
        s_n_score,
        t_f_score,
        j_p_score,
        dignity_score,
        youth_score,
        stability_score,
        morality_score,
        origin_score,
        scheming_score
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        submissionId,
        characterName,
        mbti,
        matchingScore,
        eIScore,
        sNScore,
        tFScore,
        jPScore,
        dignityScore,
        youthScore,
        stabilityScore,
        moralityScore,
        originScore,
        schemingScore,
      )
      .run()

    return json({ ok: true })
  } catch (err) {
    console.error('Daru result insert failed:', err)
    return json({ error: 'internal' }, { status: 500 })
  }
}
