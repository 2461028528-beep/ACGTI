type D1Statement = {
  first<T = unknown>(): Promise<T | null>
  all<T = unknown>(): Promise<{ results?: T[] }>
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

type CountRow = {
  name: string
  count: number
}

type DimensionAggregate = {
  positive_count: number
  negative_count: number
}

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=60',
      ...init.headers,
    },
  })

const percent = (count: number, total: number) => {
  return total > 0 ? Number(((count / total) * 100).toFixed(1)) : 0
}

const formatRanking = (rows: CountRow[], total: number) =>
  rows.map((row) => ({
    name: row.name,
    count: row.count,
    percent: percent(row.count, total),
  }))

async function readDimension(DB: D1Database, column: string) {
  const row = await DB.prepare(
    `SELECT
      SUM(CASE WHEN ${column} >= 0 THEN 1 ELSE 0 END) AS positive_count,
      SUM(CASE WHEN ${column} < 0 THEN 1 ELSE 0 END) AS negative_count
     FROM test_results`
  ).first<DimensionAggregate>()

  const positiveCount = row?.positive_count ?? 0
  const negativeCount = row?.negative_count ?? 0
  const total = positiveCount + negativeCount

  return {
    positivePercent: percent(positiveCount, total),
    negativePercent: percent(negativeCount, total),
  }
}

export const onRequest: PagesFunction<Env> = async (context) => {
  if (context.request.method !== 'GET') {
    return json({ error: 'method_not_allowed' }, { status: 405, headers: { Allow: 'GET' } })
  }

  try {
    const totalRow = await context.env.DB.prepare(
      'SELECT COUNT(*) AS total FROM test_results'
    ).first<{ total: number }>()
    const total = totalRow?.total ?? 0

    const characterRows = await context.env.DB.prepare(
      `SELECT character_name AS name, COUNT(*) AS count
       FROM test_results
       GROUP BY character_name
       ORDER BY count DESC, character_name ASC`
    ).all<CountRow>()

    const mbtiRows = await context.env.DB.prepare(
      `SELECT mbti AS name, COUNT(*) AS count
       FROM test_results
       GROUP BY mbti
       ORDER BY count DESC, mbti ASC`
    ).all<CountRow>()

    const dimensions = {
      E_I: await readDimension(context.env.DB, 'e_i_score'),
      S_N: await readDimension(context.env.DB, 's_n_score'),
      T_F: await readDimension(context.env.DB, 't_f_score'),
      J_P: await readDimension(context.env.DB, 'j_p_score'),
    }

    return json({
      total,
      characters: formatRanking(characterRows.results ?? [], total),
      mbti: formatRanking(mbtiRows.results ?? [], total),
      dimensions,
    })
  } catch (err) {
    console.error('Daru stats query failed:', err)
    return json({ error: 'internal' }, { status: 500 })
  }
}
