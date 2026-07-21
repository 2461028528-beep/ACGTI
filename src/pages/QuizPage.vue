<template>
  <div class="quiz-page">
    <div class="quiz-progress-rail" role="progressbar" :aria-valuenow="answeredCount" :aria-valuemax="questions.length" aria-label="答题进度">
      <div
        v-for="(answer, i) in state.answers"
        :key="i"
        class="quiz-progress-segment"
        :class="{ answered: answer >= 0 && answer <= 3 }"
      ></div>
    </div>

    <main class="quiz-main">
      <section ref="questionPanelRef" class="question-panel" aria-label="测试题目">
        <article v-if="currentQuestion" class="question-block" v-reveal>
          <div class="question-meta">
            <span class="question-count">{{ currentQuestionIndex + 1 }} / {{ questions.length }}</span>
          </div>

          <h1>{{ currentQuestion.text || currentQuestion.prompt || '题目加载中' }}</h1>

          <div class="option-list" role="radiogroup" :aria-label="`第 ${currentQuestionIndex + 1} 题`">
            <button
              v-for="(option, optionIndex) in currentQuestion.options ?? []"
              :key="option.id"
              type="button"
              class="option-btn"
              :class="{ selected: selectedOptionIndex === optionIndex }"
              :aria-checked="selectedOptionIndex === optionIndex"
              :aria-label="option.label"
              :disabled="isAdvancing"
              @click="onSelect(optionIndex)"
            >
              <span class="option-marker">{{ option.id.toUpperCase() }}</span>
              <span class="option-text">{{ option.label }}</span>
            </button>
          </div>
        </article>
      </section>

      <section class="quiz-controls">
        <button
          class="nav-btn"
          type="button"
          :disabled="currentQuestionIndex <= 0"
          @click="goPreviousQuestion"
        >
          上一题
        </button>
        <p class="progress-hint">已完成 {{ answeredCount }} / {{ questions.length }}</p>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import { useQuiz } from '../composables/useQuiz'
import { useSeo } from '../composables/useSeo'

useSeo({
  title: 'LYSG 性格测试｜开始测试',
  description: '墙头马上摇香菇，测测你是哪位主。',
  path: '/quiz',
})

const AUTO_ADVANCE_DELAY_MS = 200

const router = useRouter()
const {
  questions,
  state,
  answeredCount,
  selectOptionAt,
  finalizeQuiz,
  ensureData,
} = useQuiz()

const currentQuestionIndex = ref(0)
const questionPanelRef = ref<HTMLElement | null>(null)
const isAdvancing = ref(false)
let advanceTimer: ReturnType<typeof setTimeout> | null = null

const currentQuestion = computed(() => questions.value[currentQuestionIndex.value] ?? null)
const selectedOptionIndex = computed(() => state.answers[currentQuestionIndex.value] ?? -10)

onMounted(async () => {
  await ensureData()
  currentQuestionIndex.value = clampQuestionIndex(currentQuestionIndex.value)
})

onBeforeUnmount(() => {
  clearAdvanceTimer()
})

function clampQuestionIndex(index: number) {
  return Math.max(0, Math.min(index, Math.max(questions.value.length - 1, 0)))
}

function clearAdvanceTimer() {
  if (!advanceTimer) return
  clearTimeout(advanceTimer)
  advanceTimer = null
}

async function scrollToQuestionTop() {
  await nextTick()
  questionPanelRef.value?.scrollIntoView({
    behavior: 'smooth',
    block: 'start',
    inline: 'nearest',
  })
}

function onSelect(optionIndex: number) {
  if (!currentQuestion.value || isAdvancing.value) return

  selectOptionAt(currentQuestionIndex.value, optionIndex)
  clearAdvanceTimer()
  isAdvancing.value = true

  advanceTimer = setTimeout(() => {
    void advanceAfterSelection()
  }, AUTO_ADVANCE_DELAY_MS)
}

async function advanceAfterSelection() {
  clearAdvanceTimer()
  isAdvancing.value = false

  if (currentQuestionIndex.value >= questions.value.length - 1) {
    submitQuiz()
    return
  }

  currentQuestionIndex.value += 1
  await scrollToQuestionTop()
}

async function goPreviousQuestion() {
  if (currentQuestionIndex.value <= 0) return

  clearAdvanceTimer()
  isAdvancing.value = false
  currentQuestionIndex.value -= 1
  await scrollToQuestionTop()
}

function submitQuiz() {
  const result = finalizeQuiz()
  if (!result) return
  void router.push({ name: 'result' })
}
</script>

<style scoped>
.quiz-page {
  min-height: auto;
  background: #f6f4ee;
  color: #1f3d34;
}

.quiz-progress-rail {
  position: sticky;
  top: 56px;
  left: 0;
  right: 0;
  height: 5px;
  z-index: 40;
  display: flex;
  gap: 1px;
  background: rgba(255, 255, 255, 0.8);
}

.quiz-progress-segment {
  flex: 1;
  height: 100%;
  background: rgba(31, 61, 52, 0.12);
  transition: background-color 0.3s ease;
}

.quiz-progress-segment.answered {
  background: #33a474;
}

.quiz-main {
  width: min(880px, 100%);
  margin: 0 auto;
  padding: 26px 16px 36px;
}

.question-panel {
  scroll-margin-top: 82px;
}

.question-block {
  padding: 26px 20px 30px;
  border-radius: 18px;
  border: 1px solid rgba(31, 61, 52, 0.08);
  background: rgba(255, 255, 255, 0.78);
  box-shadow: 0 10px 24px rgba(31, 61, 52, 0.07);
}

.question-meta {
  margin-bottom: 12px;
  color: #33a474;
  font-size: 14px;
  font-weight: 800;
}

.question-block h1 {
  margin: 0 0 20px;
  text-align: center;
  color: #1f3d34;
  font-size: clamp(24px, 3vw, 28px);
  line-height: 1.4;
}

.option-list {
  display: grid;
  gap: 10px;
}

.option-btn {
  width: 100%;
  min-height: 54px;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 14px;
  border: 2px solid #e3e9e5;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.78);
  color: #34414d;
  cursor: pointer;
  text-align: left;
  transition: border-color 0.18s ease, background-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
  user-select: none;
  -webkit-user-select: none;
  -webkit-user-drag: none;
  -webkit-touch-callout: none;
  touch-action: pan-y;
}

.option-btn:disabled {
  cursor: default;
}

.option-btn.selected {
  border-color: #33a474;
  background: #f3fbf7;
  box-shadow: 0 8px 22px rgba(51, 164, 116, 0.14);
}

.option-marker {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #edf3ef;
  color: #61746c;
  font-size: 13px;
  font-weight: 800;
}

.option-btn.selected .option-marker {
  background: #33a474;
  color: #ffffff;
}

.option-text {
  flex: 1;
  min-width: 0;
  font-size: 16px;
  font-weight: 600;
  line-height: 1.55;
}

.quiz-controls {
  margin-top: 12px;
  padding: 0 4px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.progress-hint {
  display: none;
}

.nav-btn {
  border: 1px solid rgba(31, 61, 52, 0.16);
  border-radius: 999px;
  min-height: 46px;
  padding: 0 20px;
  color: #1f3d34;
  background: rgba(255, 255, 255, 0.82);
  font-weight: 800;
  cursor: pointer;
}

.nav-btn:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

@media (hover: hover) {
  .option-btn:not(:disabled):hover,
  .nav-btn:not(:disabled):hover {
    border-color: #a8cbbc;
    transform: translateY(-1px);
  }
}

@media (max-width: 640px) {
  .quiz-page {
    min-height: auto;
  }

  .quiz-progress-rail {
    top: 50px;
    height: 4px;
  }

  .quiz-main {
    padding: 14px 10px 28px;
  }

  .question-panel {
    scroll-margin-top: 72px;
  }

  .question-block {
    padding: 18px 14px 20px;
    border-radius: 16px;
  }

  .question-meta {
    margin-bottom: 12px;
  }

  .question-block h1 {
    margin-bottom: 16px;
    font-size: clamp(23px, 6.2vw, 26px);
    line-height: 1.35;
  }

  .option-btn {
    min-height: 52px;
    align-items: flex-start;
    padding: 12px 14px;
  }

  .option-text {
    font-size: 15px;
  }

  .quiz-controls {
    align-items: stretch;
    gap: 0;
  }

  .nav-btn {
    width: 100%;
  }

  .progress-hint {
    text-align: center;
  }
}
</style>
