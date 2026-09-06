/**
 * 查估案件狀態。
 *
 * 一次上傳會連打三支 API：辨識 → 計算 → 審查。三者共用同一份 `tables`，
 * 所以在 store 裡串起來，畫面只要等一個 `loading`。
 */

import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { compute, parseForms, review } from '@/services/valuationService'
import type {
  ComputeResult,
  Correction,
  ParseResult,
  ReviewResult,
} from '@/types/case'

export const useCaseStore = defineStore('case', () => {
  const fileName = ref<string | null>(null)
  const parsed = ref<ParseResult | null>(null)
  const computed_ = ref<ComputeResult | null>(null)
  const reviewed = ref<ReviewResult | null>(null)
  const loading = ref(false)
  const errorMessage = ref<string | null>(null)

  const table1 = computed(() => parsed.value?.tables['表1'] ?? null)
  const table52 = computed(() => parsed.value?.tables['表5-2'] ?? null)
  const table4 = computed(() => parsed.value?.tables['表4'] ?? null)

  /** 第一個比較標的的計算結果。範本只有 1 件，辦法上限 3 件 */
  const firstComparable = computed(() => computed_.value?.comparables[0] ?? null)

  /** factor_id → 依據鏈，供表4 逐列查詢 */
  const correctionsByFactor = computed(() => {
    const map: Record<string, Correction> = {}
    for (const c of firstComparable.value?.corrections ?? []) map[c.factor_id] = c
    return map
  })

  async function analyze(file: File) {
    loading.value = true
    errorMessage.value = null
    parsed.value = null
    computed_.value = null
    reviewed.value = null
    fileName.value = file.name

    try {
      const p = await parseForms(file)
      const parseData = p.result.data
      if (!parseData) throw new Error(p.result.error?.message ?? '辨識失敗')
      parsed.value = parseData

      // 計算需要表4；只送了表1 或表5-2 時仍然可以看辨識結果與跨表比對。
      if (parseData.tables['表4']) {
        const c = await compute(parseData.tables)
        computed_.value = c.result.data
      }
      const r = await review(parseData.tables)
      reviewed.value = r.result.data
    } catch (e) {
      // axiosService 的攔截器會把錯誤轉成 ResponseStructure 再 reject，
      // 所以優先讀 errorMessage；一般 Error 才退回 message。
      const structured = e as { errorMessage?: string }
      errorMessage.value =
        structured?.errorMessage ?? (e instanceof Error ? e.message : '未預期的錯誤')
    } finally {
      loading.value = false
    }
  }

  function reset() {
    fileName.value = null
    parsed.value = null
    computed_.value = null
    reviewed.value = null
    errorMessage.value = null
  }

  return {
    fileName,
    parsed,
    computed: computed_,
    reviewed,
    loading,
    errorMessage,
    table1,
    table52,
    table4,
    firstComparable,
    correctionsByFactor,
    analyze,
    reset,
  }
})
