/**
 * 查估案件 API。
 *
 * 走既有的 `axiosService`：回應信封 `{ data, error }` 的解析、錯誤攔截、
 * 日誌都已經在那裡處理好了，這裡只負責端點與型別。
 */

import { request, type ResponseStructure } from './axiosService'
import type {
  ComputeResult,
  GeneratedForms,
  ParsedTables,
  ParseResult,
  ReviewResult,
  Ruleset,
} from '@/types/case'

/** 可用的規則集。Demo 現場抽換不同行政區的基準表要用 */
export function listRulesets(): Promise<ResponseStructure<{ rulesets: Ruleset[] }>> {
  return request<{ rulesets: Ruleset[] }>({ method: 'GET', url: '/api/rulesets' })
}

/**
 * 上傳查估書表 PDF，逐頁判斷表別並辨識。
 *
 * 不設 Content-Type：交給 axios 依 FormData 自動帶上 multipart 的 boundary，
 * 手動指定反而會漏掉 boundary 而讓後端解不出檔案。
 */
export function parseForms(file: File): Promise<ResponseStructure<ParseResult>> {
  const form = new FormData()
  form.append('file', file)
  return request<ParseResult>({ method: 'POST', url: '/api/parse', data: form })
}

/** 依規則集重算表4 全鏈路，回傳結果與每一項修正的依據鏈 */
export function compute(
  tables: ParsedTables,
  rulesetIndividual?: string,
): Promise<ResponseStructure<ComputeResult>> {
  return request<ComputeResult>({
    method: 'POST',
    url: '/api/compute',
    data: { tables, ruleset_individual: rulesetIndividual },
  })
}

/** 審查模式：三層逐格比對，並算出賠償金差額 */
export function review(tables: ParsedTables): Promise<ResponseStructure<ReviewResult>> {
  return request<ReviewResult>({ method: 'POST', url: '/api/review', data: { tables } })
}

/**
 * 產出三張填好的官方書表。
 *
 * 回傳的是下載連結而不是檔案本身——回應信封規定 body 必須是 `{data, error}`，
 * 二進位塞不進去（見 api/CONTRACT.md）。
 */
export function generateForms(file: File): Promise<ResponseStructure<GeneratedForms>> {
  const form = new FormData()
  form.append('file', file)
  return request<GeneratedForms>({ method: 'POST', url: '/api/forms', data: form })
}

/** 把後端回的相對連結接成可直接開的絕對網址 */
export function formDownloadUrl(link: string): string {
  return `${import.meta.env.VITE_API_URL ?? ''}${link}`
}
