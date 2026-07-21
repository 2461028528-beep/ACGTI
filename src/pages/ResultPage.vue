<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { useQuiz } from '../composables/useQuiz'
import { useSeo } from '../composables/useSeo'
import daruCharacterMessages from '../data/daruCharacterMessages.json'
import type { QuizResult } from '../types/quiz'
import { reportDaruResult } from '../utils/daruStatsReporter'

type DaruCharacterMessage = {
  name: string
  summary: string
  quote: string
  image: string
}

const MESSAGE_PLACEHOLDER = '完整人物解析即将上线。'
const nameAliases: Record<string, string> = {
  高烯月: '高晞月',
}
const messages = daruCharacterMessages as Record<string, DaruCharacterMessage>

const router = useRouter()
const quiz = useQuiz()
const isImageBroken = ref(false)
const hasQueuedReport = ref(false)
const result = computed(() => quiz.latestResult.value)
const matchedCharacter = computed(() => result.value?.matchedCharacter ?? null)
const winningMatch = computed(() => result.value?.daruCharacterMatches?.[0] ?? null)
const totalScore = computed(() => winningMatch.value?.totalScore ?? 0)
const characterMessage = computed(() => {
  const rawName = matchedCharacter.value?.name
  const messageName = rawName ? nameAliases[rawName] ?? rawName : ''
  return messageName ? messages[messageName] ?? null : null
})
const displayName = computed(() => characterMessage.value?.name ?? matchedCharacter.value?.name ?? '未知角色')
const displayMbti = computed(() => matchedCharacter.value?.mbti ?? result.value?.mbtiCode ?? '--')
const imageSrc = computed(() => visibleText(characterMessage.value?.image))
const quoteText = computed(() => visibleText(characterMessage.value?.quote))
const summaryText = computed(() => visibleText(characterMessage.value?.summary) || MESSAGE_PLACEHOLDER)

useSeo({
  title: computed(() => `${displayName.value} - 你的《如懿传》本命角色`),
  description: '查看你的《如懿传》本命角色、MBTI 类型和最终匹配度。',
  path: '/result',
})

onMounted(async () => {
  await quiz.ensureData()
  quiz.resumeLastResult()

  if (!quiz.latestResult.value) {
    void router.replace('/quiz')
  }
})

watch(
  () => quiz.latestResult.value,
  (loadedResult) => {
    if (!loadedResult) return
    reportResultOnce(loadedResult)
  },
  { immediate: true },
)

watch(
  () => imageSrc.value,
  () => {
    isImageBroken.value = false
  },
)

function visibleText(value: string | undefined) {
  const text = value?.trim()
  return text && text !== 'TODO' ? text : ''
}

function formatPercent(score: number | undefined) {
  return typeof score === 'number' && Number.isFinite(score) ? `${score.toFixed(1)}%` : '--'
}

function handleImageError() {
  isImageBroken.value = true
}

function reportResultOnce(quizResult: QuizResult) {
  if (hasQueuedReport.value) return
  hasQueuedReport.value = true
  void reportDaruResult(quizResult)
}

function retry() {
  quiz.resetQuiz()
  void router.push('/quiz')
}
</script>

<template>
  <main v-if="result" class="result-page">
    <section class="result-card">
      <div class="character-info">
        <p class="eyebrow">你的《如懿传》本命角色</p>
        <h1>{{ displayName }}</h1>

        <div class="meta-row">
          <span>{{ displayMbti }}</span>
          <span>匹配度 {{ formatPercent(totalScore) }}</span>
        </div>
      </div>

      <div class="character-visual">
        <img
          v-if="imageSrc && !isImageBroken"
          :src="imageSrc"
          :alt="displayName"
          @error="handleImageError"
        />
        <div v-else class="image-fallback">{{ displayName }}</div>
      </div>
    </section>

    <section class="result-copy">
      <p v-if="quoteText" class="quote">{{ quoteText }}</p>
      <p class="summary">{{ summaryText }}</p>
    </section>

    <section class="actions">
      <button type="button" @click="retry">重新测试</button>
      <RouterLink to="/">返回首页</RouterLink>
    </section>
  </main>
</template>

<style scoped>
.result-page {
  min-height: auto;
  background: #f6f4ee;
  color: #29313a;
  padding: 28px 18px 44px;
}

.result-card,
.result-copy,
.actions {
  width: min(980px, 100%);
  margin-left: auto;
  margin-right: auto;
}

.result-card {
  display: grid;
  grid-template-columns: minmax(320px, 420px) minmax(0, 1fr);
  gap: 28px;
  align-items: center;
  background: rgba(255, 255, 255, 0.78);
  border: 1px solid rgba(31, 61, 52, 0.08);
  border-radius: 22px;
  box-shadow: 0 14px 34px rgba(31, 61, 52, 0.08);
  padding: 24px;
}

.character-info {
  grid-column: 2;
  grid-row: 1;
  padding: 18px 8px 18px 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.character-visual {
  grid-column: 1;
  grid-row: 1;
  min-height: 420px;
  max-height: 520px;
  display: grid;
  place-items: center;
  overflow: hidden;
  border-radius: 20px;
  background: linear-gradient(180deg, #f4fbf7, #eef3f6);
  border: 1px solid #e4ece8;
}

.character-visual img {
  width: 100%;
  height: 100%;
  max-height: 520px;
  object-fit: contain;
  display: block;
}

.image-fallback {
  padding: 28px;
  color: #33a474;
  font-size: 32px;
  font-weight: 900;
  text-align: center;
}

.eyebrow {
  margin: 0;
  color: #33a474;
  font-size: 13px;
  font-weight: 800;
}

.character-info h1 {
  margin: 10px 0 12px;
  font-size: clamp(46px, 7vw, 76px);
  line-height: 1;
}

.meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 0;
}

.meta-row span {
  min-height: 34px;
  padding: 0 14px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  background: #eff8f4;
  color: #2f7d5e;
  font-size: 14px;
  font-weight: 900;
}

.result-copy {
  margin-top: 14px;
  padding: 22px 24px;
  background: rgba(255, 255, 255, 0.78);
  border: 1px solid rgba(31, 61, 52, 0.08);
  border-radius: 20px;
  box-shadow: 0 10px 24px rgba(31, 61, 52, 0.06);
}

.quote {
  margin: 0 0 18px;
  padding-left: 16px;
  border-left: 4px solid #33a474;
  color: #29313a;
  font-size: 22px;
  font-weight: 900;
  line-height: 1.55;
}

.summary {
  margin: 0;
  color: #4f5d69;
  font-size: 17px;
  line-height: 1.9;
  white-space: pre-line;
}

.actions {
  margin-top: 14px;
  padding: 14px;
  display: flex;
  justify-content: center;
  gap: 12px;
  background: rgba(255, 255, 255, 0.78);
  border: 1px solid rgba(31, 61, 52, 0.08);
  border-radius: 18px;
  box-shadow: 0 10px 24px rgba(31, 61, 52, 0.06);
}

.actions button,
.actions a {
  min-height: 42px;
  padding: 0 22px;
  border-radius: 999px;
  border: 1px solid #dce2e8;
  background: #ffffff;
  color: #29313a;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
  font-weight: 800;
  cursor: pointer;
}

.actions button {
  border-color: #33a474;
  background: #33a474;
  color: #ffffff;
}

@media (max-width: 760px) {
  .result-page {
    min-height: auto;
    padding: 8px 10px 18px;
  }

  .result-card {
    grid-template-columns: 1fr;
    gap: 12px;
    border-radius: 18px;
    padding: 12px;
  }

  .character-info {
    grid-column: auto;
    grid-row: auto;
    padding: 2px 4px 0;
  }

  .character-visual {
    grid-column: auto;
    grid-row: auto;
    width: 100%;
    height: 290px;
    min-height: 0;
    max-height: 300px;
    border-radius: 18px;
    padding: 10px;
    box-sizing: border-box;
  }

  .character-visual img {
    height: 100%;
  }

  .eyebrow {
    font-size: 12px;
  }

  .character-info h1 {
    margin: 4px 0 6px;
    font-size: clamp(40px, 11vw, 46px);
  }

  .meta-row {
    gap: 8px;
    margin-bottom: 0;
  }

  .meta-row span {
    min-height: 30px;
    padding: 0 12px;
    font-size: 13px;
  }

  .quote {
    margin-bottom: 12px;
    padding-left: 12px;
    font-size: clamp(20px, 5.4vw, 22px);
    line-height: 1.42;
  }

  .summary {
    font-size: 15px;
    line-height: 1.7;
  }

  .result-copy {
    margin-top: 12px;
    padding: 14px 12px;
    border-radius: 16px;
  }

  .actions {
    margin-top: 16px;
    padding: 8px;
    flex-direction: row;
    gap: 10px;
    border-radius: 16px;
  }

  .actions button,
  .actions a {
    flex: 1;
    min-height: 46px;
    padding: 0 12px;
  }
}

@media (max-width: 380px) {
  .character-visual {
    height: 270px;
  }
}
</style>
