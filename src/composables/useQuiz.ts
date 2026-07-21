import { computed, reactive, readonly, ref } from 'vue'

import type { CharacterMatch, Question, QuizRecord, QuizResult } from '../types/quiz'
import { calculateQuizResult } from '../utils/quizEngine'
import { clearLastRecord, loadLastRecord, saveLastRecord } from '../utils/storage'

// ── 异步加载数据 ──────────────────────────────────────────
// 数据不再顶层静态导入，改为首次使用时按需异步加载
let quizDataPromise: Promise<Question[]> | null = null

function loadQuizData() {
  if (!quizDataPromise) {
    quizDataPromise = import('../data/questions.json')
      .then((questionsModule) => questionsModule.default as Question[])
  }
  return quizDataPromise
}

// ── 同步数据引用（数据加载完毕后赋值） ──────────────────────
const questions = ref<Question[]>([])
// Legacy pages remain in the repository, but the Daru runtime never loads the old character dataset.
const characters = ref<CharacterMatch[]>([])

function hydrateDaruQuizRecord(record: QuizRecord | null): QuizRecord | null {
  if (!record) return null

  return {
    ...record,
    result: {
      ...record.result,
      submissionId: record.result.submissionId ?? record.submissionId,
    },
  }
}

// 数据是否已就绪
const dataReady = computed(() => questions.value.length > 0)

const UNANSWERED = -10

function isAnsweredValue(value: number) {
  return Number.isInteger(value) && value >= 0 && value <= 3
}

const emptyAnswers = () => Array.from({ length: questions.value.length }, () => UNANSWERED)

function createSubmissionId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = crypto.getRandomValues(new Uint8Array(16))
    bytes[6] = (bytes[6] & 0x0f) | 0x40
    bytes[8] = (bytes[8] & 0x3f) | 0x80
    const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
  }

  return `fallback-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

const state = reactive({
  currentIndex: 0,
  answers: emptyAnswers(),
  startedAt: null as string | null,
  latestRecord: hydrateDaruQuizRecord(loadLastRecord() as QuizRecord | null),
})

const currentQuestion = computed(() => questions.value[state.currentIndex] ?? null)
const selectedOptionIndex = computed(() => state.answers[state.currentIndex] ?? UNANSWERED)
const progress = computed(() => (questions.value.length ? (state.currentIndex + 1) / questions.value.length : 0))
const answeredCount = computed(() => state.answers.filter((answer) => isAnsweredValue(answer)).length)
const firstUnansweredIndex = computed(() => state.answers.findIndex((answer) => !isAnsweredValue(answer)))
const canGoNext = computed(() => isAnsweredValue(selectedOptionIndex.value))
const canGoPrev = computed(() => state.currentIndex > 0)
const isComplete = computed(() => state.answers.every((answer) => isAnsweredValue(answer)))
const latestResult = computed(() => state.latestRecord?.result ?? null)

function selectOption(optionIndex: number) {
  if (!isAnsweredValue(optionIndex)) return
  if (!state.startedAt) {
    state.startedAt = new Date().toISOString()
  }
  state.answers[state.currentIndex] = optionIndex
}

function selectOptionAt(questionIndex: number, optionValue: number) {
  if (!isAnsweredValue(optionValue)) return
  if (questionIndex < 0 || questionIndex >= questions.value.length) return
  if (!state.startedAt) {
    state.startedAt = new Date().toISOString()
  }
  state.answers[questionIndex] = optionValue
}

function goNext() {
  if (canGoNext.value && state.currentIndex < questions.value.length - 1) {
    state.currentIndex += 1
  }
}

function goPrev() {
  if (canGoPrev.value) {
    state.currentIndex -= 1
  }
}

function jumpToQuestion(index: number) {
  if (index >= 0 && index < questions.value.length) {
    state.currentIndex = index
  }
}

function resetQuiz(clearHistory = false) {
  state.currentIndex = 0
  state.answers = emptyAnswers()
  state.startedAt = null

  if (clearHistory) {
    state.latestRecord = null
    clearLastRecord()
  }
}

function finalizeQuiz(): QuizResult | null {
  if (!isComplete.value) {
    return null
  }

  const result = calculateQuizResult({
    answers: state.answers,
    questions: questions.value,
  })
  const submissionId = createSubmissionId()
  result.submissionId = submissionId

  const record: QuizRecord = {
    answers: [...state.answers],
    createdAt: new Date().toISOString(),
    startedAt: state.startedAt || undefined,
    submissionId,
    result,
  }

  state.latestRecord = hydrateDaruQuizRecord(record)
  saveLastRecord(record)

  return result
}

function resumeLastResult() {
  state.latestRecord = hydrateDaruQuizRecord(loadLastRecord())
}

export function useQuiz() {
  return {
    // 异步初始化：调用方在需要数据时 await
    ensureData: async () => {
      questions.value = await loadQuizData()
      // 如果 answers 长度和 questions 不匹配，重置
      if (
        state.answers.length !== questions.value.length ||
        state.answers.some((answer) => answer !== UNANSWERED && !isAnsweredValue(answer))
      ) {
        state.answers = emptyAnswers()
      }
    },
    dataReady,
    questions,
    characters,
    state: readonly(state),
    currentQuestion,
    selectedOptionIndex,
    progress,
    answeredCount,
    firstUnansweredIndex,
    canGoNext,
    canGoPrev,
    isComplete,
    latestResult,
    selectOption,
    selectOptionAt,
    goNext,
    goPrev,
    jumpToQuestion,
    resetQuiz,
    finalizeQuiz,
    resumeLastResult,
  }
}
