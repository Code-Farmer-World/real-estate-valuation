/**
 * 畫面狀態。
 *
 * 模式與分頁原本是 HomeView 的區域 ref，導覽要「先切到該模式再指元素」之後就有了
 * 第二個消費者——狀態被兩處共用就該提升。這裡只放使用者當下在看哪裡，不放任何資料，
 * 案件資料在 stores/case.ts。
 */

import { ref } from 'vue'
import { defineStore } from 'pinia'

import type { AppMode, TableTab } from '@/types/ui'

export const useUiStore = defineStore('ui', () => {
  /** 預設產出模式，那是正式題目要的方向：從勘查表算出該填什麼 */
  const mode = ref<AppMode>('survey')

  /** 審查模式下方看的是哪一張表 */
  const tab = ref<TableTab>('表4')

  return { mode, tab }
})
