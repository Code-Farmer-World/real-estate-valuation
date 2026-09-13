<script setup lang="ts">
/**
 * 導覽入口：固定在右下角的浮動按鈕。
 *
 * 導覽不會主動跳出來打斷操作，全部列在這裡讓使用者需要時自己點開。
 * 這個專案沒有頂部欄，浮在右下角才能在表格捲到很下面時仍然找得到。
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import { useTourStore } from '@/stores/tour'

const tourStore = useTourStore()

const open = ref(false)
const root = ref<HTMLElement | null>(null)

/** 清單是否為空。定義檔全被驗證擋下時會發生，正常情況不會 */
const isEmpty = computed(() => tourStore.tours.length === 0)

onMounted(() => {
  document.addEventListener('pointerdown', onPointerDown)
  document.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onPointerDown)
  document.removeEventListener('keydown', onKeydown)
})

/** 點到元件外面就收起清單 */
function onPointerDown(event: PointerEvent) {
  if (!open.value) return
  if (root.value?.contains(event.target as Node)) return
  open.value = false
}

/** Esc 收起清單。導覽播放中的 Esc 由 driver.js 自己處理，這裡不攔 */
function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') open.value = false
}

/**
 * 開始播放指定導覽
 *
 * 先收清單再啟動：清單蓋在畫面上，第一步的錨點若在它底下就會被遮住。
 * 按鈕本身留著不隱藏——它是「新手上路」其中一步要指的對象。
 * @param tourId 導覽識別碼
 */
async function handleStart(tourId: string) {
  open.value = false
  await tourStore.startTour(tourId)
}

/**
 * 導覽在清單上的說明文字
 * @param tourId 導覽識別碼
 * @returns 說明文字
 */
function buildHint(tourId: string): string {
  const blockedReason = tourStore.getBlockedReason(tourId)
  if (blockedReason !== null) return blockedReason

  return tourStore.hasSeenTour(tourId) ? '已看過，可重看' : '尚未看過'
}
</script>

<template>
  <div ref="root" class="launcher">
    <!-- 清單放在按鈕上方：按鈕貼著視窗右下角，往下展開會超出畫面 -->
    <div v-if="open" class="panel" role="dialog" aria-label="系統導覽">
      <p class="ph">系統導覽</p>

      <ul v-if="!isEmpty" class="list">
        <li v-for="tour in tourStore.tours" :key="tour.id">
          <button
            type="button"
            :disabled="!tourStore.canStartTour(tour.id)"
            @click="handleStart(tour.id)"
          >
            <span class="name">{{ tour.name }}</span>
            <span class="hint">{{ buildHint(tour.id) }}</span>
          </button>
        </li>
      </ul>

      <p v-else class="empty">目前沒有可用的導覽</p>

      <p class="foot">導覽不會自動跳出，需要時再回到這裡。</p>
    </div>

    <button
      type="button"
      class="fab"
      data-tour="tour-launcher"
      aria-haspopup="dialog"
      :aria-expanded="open"
      :title="open ? '收起系統導覽' : '系統導覽'"
      @click="open = !open"
    >
      <!-- 羅盤圖示。與參考專案的 mdi-compass-outline 同一個意象：帶路 -->
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <circle cx="12" cy="12" r="9" />
        <path d="M15.5 8.5 10.8 10.8 8.5 15.5 13.2 13.2Z" />
      </svg>
      <span>導覽</span>
    </button>
  </div>
</template>

<style scoped>
.launcher {
  position: fixed;
  right: 1.25rem;
  bottom: 1.25rem;
  display: grid;
  justify-items: end;
  gap: 0.5rem;
  /* 要蓋過頁面內容，但低於 driver.js 的遮罩（約 10000），
     否則導覽播放時按鈕會浮在遮罩上方而不是被挖出來 */
  z-index: 100;
}

.fab {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.55rem 0.9rem;
  border: 1px solid var(--accent);
  border-radius: 999px;
  background: var(--accent);
  color: #fff;
  font: inherit;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 2px 10px rgb(0 0 0 / 18%);
}

.fab:hover {
  filter: brightness(1.08);
}

.fab svg {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.6;
  stroke-linejoin: round;
}

.fab svg path {
  fill: currentColor;
  stroke: none;
}

.panel {
  width: min(19rem, calc(100vw - 2.5rem));
  padding: 0.6rem 0;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface);
  box-shadow: 0 6px 24px rgb(0 0 0 / 12%);
}

.ph {
  margin: 0 0 0.35rem;
  padding: 0 0.9rem;
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--muted);
  letter-spacing: 0.04em;
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.list button {
  display: grid;
  gap: 0.15rem;
  width: 100%;
  padding: 0.5rem 0.9rem;
  border: none;
  background: none;
  font: inherit;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.list button:hover:not(:disabled) {
  background: var(--hover);
}

.list button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.name {
  font-size: 0.85rem;
  font-weight: 600;
}

.hint {
  font-size: 0.72rem;
  color: var(--muted);
}

.empty {
  margin: 0;
  padding: 0.2rem 0.9rem 0.4rem;
  font-size: 0.78rem;
  color: var(--muted);
}

.foot {
  margin: 0.35rem 0 0;
  padding: 0.45rem 0.9rem 0;
  border-top: 1px solid var(--line);
  font-size: 0.7rem;
  color: var(--muted);
  line-height: 1.6;
}
</style>
