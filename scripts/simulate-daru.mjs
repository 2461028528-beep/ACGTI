import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createServer } from 'vite'

const RUNS = 100_000
const SEED = 20260710
const DIMENSIONS = /** @type {const} */ (['E_I', 'S_N', 'T_F', 'J_P'])
const DIMENSION_LABELS = {
  E_I: ['E', 'I'],
  S_N: ['S', 'N'],
  T_F: ['T', 'F'],
  J_P: ['J', 'P'],
}
const MBTI_TYPES = [
  'ISTJ', 'ISFJ', 'INFJ', 'INTJ',
  'ISTP', 'ISFP', 'INFP', 'INTP',
  'ESTP', 'ESFP', 'ENFP', 'ENTP',
  'ESTJ', 'ESFJ', 'ENFJ', 'ENTJ',
]

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const analysisDir = path.join(root, 'analysis')
const jsonOut = path.join(analysisDir, 'daru-simulation.json')
const csvOut = path.join(analysisDir, 'daru-simulation-summary.csv')

function createRng(seed) {
  let state = seed >>> 0
  return () => {
    state += 0x6D2B79F5
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function percent(count, total) {
  return total ? Number(((count / total) * 100).toFixed(4)) : 0
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
}

function stddev(values) {
  if (!values.length) return 0
  const avg = mean(values)
  return Math.sqrt(values.reduce((sum, value) => sum + ((value - avg) ** 2), 0) / values.length)
}

function median(values) {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

function round(value, digits = 4) {
  return Number(value.toFixed(digits))
}

function createCountMap(keys) {
  return Object.fromEntries(keys.map((key) => [key, 0]))
}

function optionIdToIndex(optionId) {
  return optionId.toLowerCase().charCodeAt(0) - 'a'.charCodeAt(0)
}

function randomAnswers(questions, rng) {
  return questions.map((question) => {
    const optionCount = question.options?.length ?? 4
    return Math.floor(rng() * optionCount)
  })
}

function runCase(name, answers, calculateQuizResult, questions) {
  const result = calculateQuizResult({ answers, questions })
  return {
    name,
    answers,
    mbtiCode: result.mbtiCode,
    rawDimensionScores: result.rawDimensionScores,
    matchedCharacter: result.matchedCharacter,
    top3: (result.daruCharacterMatches ?? []).slice(0, 3).map((match) => ({
      id: match.character.id,
      name: match.character.name,
      totalScore: match.totalScore,
      mbtiScore: match.mbtiScore,
      traitScore: match.traitScore,
      tendencyScore: match.tendencyScore,
    })),
  }
}

function summarizeFlags(percentValue, lowThreshold, highThreshold, lowLabel, highLabel) {
  const flags = []
  if (percentValue < lowThreshold) flags.push(lowLabel)
  if (percentValue > highThreshold) flags.push(highLabel)
  return flags
}

function toCsvCell(value) {
  const text = String(value ?? '')
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function pushCsvRow(rows, row) {
  rows.push([
    row.category,
    row.item,
    row.count ?? '',
    row.percent ?? '',
    row.mean ?? '',
    row.stddev ?? '',
    row.min ?? '',
    row.max ?? '',
    row.flags ?? '',
    row.extra ?? '',
  ].map(toCsvCell).join(','))
}

async function main() {
  const server = await createServer({
    root,
    configFile: false,
    logLevel: 'silent',
    server: { middlewareMode: true },
  })

  try {
    const [{ default: questions }, engine] = await Promise.all([
      server.ssrLoadModule('/src/data/questions.json'),
      server.ssrLoadModule('/src/utils/quizEngine.ts'),
    ])

    const { calculateQuizResult } = engine
    const rng = createRng(SEED)
    const mbtiCounts = createCountMap(MBTI_TYPES)
    const dimensionCounts = Object.fromEntries(DIMENSIONS.map((dimension) => [
      dimension,
      { [DIMENSION_LABELS[dimension][0]]: 0, [DIMENSION_LABELS[dimension][1]]: 0, zero: 0, rawValues: [] },
    ]))
    const characterNames = []
    const characterCounts = {}
    const top3Counts = {}
    const scoreGaps = []
    const sampleResults = []

    for (let run = 0; run < RUNS; run += 1) {
      const answers = randomAnswers(questions, rng)
      const result = calculateQuizResult({ answers, questions })
      const mbtiCode = result.mbtiCode
      mbtiCounts[mbtiCode] = (mbtiCounts[mbtiCode] ?? 0) + 1

      for (const dimension of DIMENSIONS) {
        const [left, right] = DIMENSION_LABELS[dimension]
        const raw = result.rawDimensionScores?.[dimension] ?? 0
        dimensionCounts[dimension].rawValues.push(raw)
        if (raw === 0) dimensionCounts[dimension].zero += 1
        if (result.scores[dimension].dominant === left) {
          dimensionCounts[dimension][left] += 1
        } else {
          dimensionCounts[dimension][right] += 1
        }
      }

      const matchedName = result.matchedCharacter?.name ?? 'UNKNOWN'
      if (!(matchedName in characterCounts)) {
        characterNames.push(matchedName)
        characterCounts[matchedName] = 0
        top3Counts[matchedName] = 0
      }
      characterCounts[matchedName] += 1

      const matches = result.daruCharacterMatches ?? []
      const first = matches[0]
      const second = matches[1]
      if (first && second) {
        scoreGaps.push(first.totalScore - second.totalScore)
      }

      for (const match of matches.slice(0, 3)) {
        const name = match.character.name
        if (!(name in top3Counts)) {
          top3Counts[name] = 0
        }
        top3Counts[name] += 1
      }

      if (run < 5) {
        sampleResults.push({
          answers,
          mbtiCode,
          rawDimensionScores: result.rawDimensionScores,
          matchedCharacter: result.matchedCharacter,
          top3: matches.slice(0, 3),
        })
      }
    }

    const mbtiDistribution = MBTI_TYPES.map((type) => {
      const count = mbtiCounts[type] ?? 0
      const pct = percent(count, RUNS)
      return {
        type,
        count,
        percent: pct,
        flags: summarizeFlags(pct, 1, 15, 'LOW_UNDER_1_PERCENT', 'HIGH_OVER_15_PERCENT'),
      }
    }).sort((a, b) => b.count - a.count || a.type.localeCompare(b.type))

    const dimensionDistribution = Object.fromEntries(DIMENSIONS.map((dimension) => {
      const [left, right] = DIMENSION_LABELS[dimension]
      const rawValues = dimensionCounts[dimension].rawValues
      const leftCount = dimensionCounts[dimension][left]
      const rightCount = dimensionCounts[dimension][right]
      const leftPercent = percent(leftCount, RUNS)
      const rightPercent = percent(rightCount, RUNS)
      return [dimension, {
        poles: {
          [left]: { count: leftCount, percent: leftPercent },
          [right]: { count: rightCount, percent: rightPercent },
        },
        rawScore: {
          mean: round(mean(rawValues)),
          stddev: round(stddev(rawValues)),
          min: Math.min(...rawValues),
          max: Math.max(...rawValues),
        },
        zero: {
          count: dimensionCounts[dimension].zero,
          percent: percent(dimensionCounts[dimension].zero, RUNS),
        },
        flags: [
          ...(leftPercent > 65 ? [`${left}_OVER_65_PERCENT`] : []),
          ...(rightPercent > 65 ? [`${right}_OVER_65_PERCENT`] : []),
        ],
      }]
    }))

    const allCharacterNames = [...new Set([...characterNames, ...Object.keys(top3Counts)])].sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'))
    const characterDistribution = allCharacterNames.map((name) => {
      const count = characterCounts[name] ?? 0
      const pct = percent(count, RUNS)
      const flags = summarizeFlags(pct, 2, 20, 'LOW_UNDER_2_PERCENT', 'HIGH_OVER_20_PERCENT')
      if (count === 0) flags.push('NEVER_FIRST')
      return {
        name,
        count,
        percent: pct,
        flags,
      }
    }).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-Hans-CN'))

    const top3Distribution = allCharacterNames.map((name) => ({
      name,
      count: top3Counts[name] ?? 0,
      percent: percent(top3Counts[name] ?? 0, RUNS),
    })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-Hans-CN'))

    const gapStats = {
      mean: round(mean(scoreGaps)),
      median: round(median(scoreGaps)),
      min: round(Math.min(...scoreGaps)),
      max: round(Math.max(...scoreGaps)),
      under2Percent: percent(scoreGaps.filter((gap) => gap < 2).length, scoreGaps.length),
      under5Percent: percent(scoreGaps.filter((gap) => gap < 5).length, scoreGaps.length),
      under10Percent: percent(scoreGaps.filter((gap) => gap < 10).length, scoreGaps.length),
    }

    const fixedRng = createRng(SEED + 1)
    const extremeCases = [
      runCase('all_A', questions.map(() => 0), calculateQuizResult, questions),
      runCase('all_B', questions.map(() => 1), calculateQuizResult, questions),
      runCase('all_C', questions.map(() => 2), calculateQuizResult, questions),
      runCase('all_D', questions.map(() => 3), calculateQuizResult, questions),
      runCase('cycle_A_B_C_D', questions.map((_, index) => index % 4), calculateQuizResult, questions),
      runCase('seeded_random_0_1_2_3', randomAnswers(questions, fixedRng), calculateQuizResult, questions),
    ]

    const biasNotes = {
      mbti: mbtiDistribution
        .filter((item) => item.flags.length)
        .map((item) => `${item.type}: ${item.percent}% ${item.flags.join('|')}`),
      dimensions: Object.entries(dimensionDistribution)
        .filter(([, item]) => item.flags.length)
        .map(([dimension, item]) => `${dimension}: ${item.flags.join('|')}`),
      characters: characterDistribution
        .filter((item) => item.flags.length)
        .map((item) => `${item.name}: ${item.percent}% ${item.flags.join('|')}`),
      likelySources: inferLikelySources(questions),
    }

    const output = {
      metadata: {
        runs: RUNS,
        seed: SEED,
        questionCount: questions.length,
        generatedAt: new Date().toISOString(),
      },
      mbtiDistribution,
      dimensionDistribution,
      characterDistribution,
      competition: {
        firstSecondGap: gapStats,
        top3Distribution,
      },
      extremeCases,
      sampleResults,
      biasNotes,
    }

    await mkdir(analysisDir, { recursive: true })
    await writeFile(jsonOut, JSON.stringify(output, null, 2), 'utf8')

    const rows = ['category,item,count,percent,mean,stddev,min,max,flags,extra']
    for (const item of mbtiDistribution) {
      pushCsvRow(rows, { category: 'mbti', item: item.type, count: item.count, percent: item.percent, flags: item.flags.join('|') })
    }
    for (const [dimension, item] of Object.entries(dimensionDistribution)) {
      for (const [pole, poleStats] of Object.entries(item.poles)) {
        pushCsvRow(rows, { category: 'dimension_pole', item: `${dimension}:${pole}`, count: poleStats.count, percent: poleStats.percent, flags: item.flags.join('|') })
      }
      pushCsvRow(rows, {
        category: 'dimension_raw',
        item: dimension,
        mean: item.rawScore.mean,
        stddev: item.rawScore.stddev,
        min: item.rawScore.min,
        max: item.rawScore.max,
        extra: `zeroPercent=${item.zero.percent}`,
      })
    }
    for (const item of characterDistribution) {
      pushCsvRow(rows, { category: 'matched_character', item: item.name, count: item.count, percent: item.percent, flags: item.flags.join('|') })
    }
    for (const item of top3Distribution) {
      pushCsvRow(rows, { category: 'character_top3', item: item.name, count: item.count, percent: item.percent })
    }
    pushCsvRow(rows, {
      category: 'competition',
      item: 'first_second_gap',
      mean: gapStats.mean,
      min: gapStats.min,
      max: gapStats.max,
      extra: `median=${gapStats.median};under2=${gapStats.under2Percent};under5=${gapStats.under5Percent};under10=${gapStats.under10Percent}`,
    })
    await writeFile(csvOut, `${rows.join('\n')}\n`, 'utf8')

    printSummary(output)
  } finally {
    await server.close()
  }
}

function inferLikelySources(questions) {
  return DIMENSIONS.map((dimension) => {
    const optionMeans = questions.map((question) => {
      const scores = (question.options ?? []).map((option) => option.dimensionScores?.[dimension] ?? 0)
      return {
        questionId: question.id,
        mean: mean(scores),
        spread: Math.max(...scores) - Math.min(...scores),
        options: scores,
      }
    })
    return {
      dimension,
      nonZeroQuestionMeans: optionMeans
        .filter((item) => Math.abs(item.mean) >= 0.25)
        .sort((a, b) => Math.abs(b.mean) - Math.abs(a.mean))
        .slice(0, 5),
      widestSpreads: optionMeans
        .sort((a, b) => b.spread - a.spread)
        .slice(0, 5),
    }
  })
}

function printSummary(output) {
  console.log('\nDaru simulation complete')
  console.log(`Runs: ${output.metadata.runs.toLocaleString()}  Seed: ${output.metadata.seed}  Questions: ${output.metadata.questionCount}`)
  console.log(`JSON: ${path.relative(root, jsonOut)}`)
  console.log(`CSV : ${path.relative(root, csvOut)}`)

  console.log('\nMBTI distribution')
  console.table(output.mbtiDistribution.map((item) => ({
    type: item.type,
    count: item.count,
    percent: item.percent,
    flags: item.flags.join(', '),
  })))

  console.log('\nDimension distribution')
  console.table(Object.entries(output.dimensionDistribution).map(([dimension, item]) => {
    const [left, right] = DIMENSION_LABELS[dimension]
    return {
      dimension,
      [`${left}%`]: item.poles[left].percent,
      [`${right}%`]: item.poles[right].percent,
      mean: item.rawScore.mean,
      stddev: item.rawScore.stddev,
      min: item.rawScore.min,
      max: item.rawScore.max,
      zeroPercent: item.zero.percent,
      flags: item.flags.join(', '),
    }
  }))

  console.log('\nMatched character distribution')
  console.table(output.characterDistribution.map((item) => ({
    name: item.name,
    count: item.count,
    percent: item.percent,
    flags: item.flags.join(', '),
  })))

  console.log('\nCompetition')
  console.table([output.competition.firstSecondGap])

  console.log('\nExtreme cases')
  console.table(output.extremeCases.map((item) => ({
    case: item.name,
    mbti: item.mbtiCode,
    raw: JSON.stringify(item.rawDimensionScores),
    matched: item.matchedCharacter?.name ?? 'UNKNOWN',
    top3: item.top3.map((match) => `${match.name}:${match.totalScore}`).join(' | '),
  })))

  console.log('\nBias notes')
  console.log(`MBTI flags: ${output.biasNotes.mbti.length ? output.biasNotes.mbti.join('; ') : 'none'}`)
  console.log(`Dimension flags: ${output.biasNotes.dimensions.length ? output.biasNotes.dimensions.join('; ') : 'none'}`)
  console.log(`Character flags: ${output.biasNotes.characters.length ? output.biasNotes.characters.join('; ') : 'none'}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
