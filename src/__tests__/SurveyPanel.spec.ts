import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

import SurveyPanel from '../components/SurveyPanel.vue'
import { useCaseStore } from '../stores/case'
import type { SurveyResult } from '../types/case'

/**
 * 產出模式的畫面。
 *
 * 這個元件刻意不做任何計算，等級、修正率、小計、價格連敘述都來自後端。
 * 所以測試餵一份與 `/api/survey/xlsx` 形狀相同的假資料，驗畫面有沒有把該顯示的
 * 東西顯示出來，特別是那些「少了就會被誤讀」的部分：個別因素以 0 計的前提、
 * 自我驗證的結果、以及每一格的依據。
 */
function fakeResult(overrides: Partial<SurveyResult> = {}): SurveyResult {
  return {
    id: 'abc123',
    case_id: '1110901-99-XXX',
    ruleset_id: 'shulin-residential-regional',
    benchmark: 'P001-00',
    comparables: ['P002-00', 'P003-00'],
    cell_counts: { grades: 116, corrections: 87, subtotals: 24, totals: 3 },
    table5_1: {
      groups: ['交通運輸(2)'],
      factor_ids: ['regional.transport.main_road_width'],
      grades: {
        'P001-00': { 'regional.transport.main_road_width': '1' },
        'P002-00': { 'regional.transport.main_road_width': '5' },
        'P003-00': { 'regional.transport.main_road_width': '4' },
      },
      subtotals: { 'P002-00': { '交通運輸(2)': 23.5 }, 'P003-00': { '交通運輸(2)': 14.75 } },
      totals: { 'P002-00': 23.5, 'P003-00': 14.75 },
    },
    table4: {
      regional_pct: { 'P002-00': 23.5, 'P003-00': 14.75 },
      abs_sum_pct: { 'P002-00': 29.46, 'P003-00': 18.84 },
      similarity: { 'P002-00': '較低', 'P003-00': '較高' },
      weight_pct: { 'P002-00': 20, 'P003-00': 50 },
      trial_price: { 'P002-00': 170337, 'P003-00': 161577 },
      benchmark_comparison_price: 176921,
      benchmark_land_price: 177000,
    },
    premise: '表4 個別因素（項目7至25）題目未提供宗地個別條件資料，依表4 註記由地價查估單位辦理，本次計算以 0% 計。',
    evidence: [
      {
        segment: 'P002-00',
        total_pct: '23.50',
        narrative: '比較標的 P002-00 的影響地價區域因素總修正數為 +23.50%。',
        groups: [
          {
            group: '交通運輸(2)',
            segment: 'P002-00',
            subtotal_pct: '23.50',
            counted: [{ label: '主要道路寬度', pct: '15.00' }],
            skipped: [],
            narrative: '「交通運輸(2)」小計 +23.50%。',
          },
        ],
        factors: [
          {
            factor_id: 'regional.transport.main_road_width',
            label: '主要道路寬度',
            group: '交通運輸(2)',
            unit: 'm',
            source_page: 2,
            benchmark: {
              segment: 'P001-00',
              value: 28,
              grade: 1,
              grade_label: '優',
              reason: '28m 落在「28m以上」→ 第1級',
            },
            comparable: {
              segment: 'P002-00',
              value: 7,
              grade: 5,
              grade_label: '劣',
              reason: '7m 落在「未滿8m」→ 第5級',
            },
            correction_pct: '15.00',
            correction_reason: '矩陣[比準地=1 優][比較標的=5 劣] = 15.00%',
            counted: true,
            exclusion_reason: '',
            override_note: '',
            narrative: '比準地（P001-00）的「主要道路寬度」為28m，判為第 1 級（優）（評價基準明細表第 2 頁）。',
          },
        ],
      },
    ],
    verification: {
      passed: true,
      total: 10,
      failed: 0,
      checks: [{ name: '與已驗證的數字一致', passed: true, detail: '全數相符' }],
    },
    read_warnings: [],
    files: [
      { filename: '表5-final.xlsx', size: 150000, link: '/api/survey/abc123/表5-final.xlsx' },
      {
        filename: 'verification-report.json',
        size: 2000,
        link: '/api/survey/abc123/verification-report.json',
      },
    ],
    ...overrides,
  }
}

function mountWith(result: SurveyResult | null) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const store = useCaseStore()
  store.survey = result
  if (result) store.surveySegment = result.comparables[0] ?? null
  return { wrapper: mount(SurveyPanel, { global: { plugins: [pinia] } }), store }
}

describe('SurveyPanel', () => {
  it('沒有結果時只顯示上傳區', () => {
    const { wrapper } = mountWith(null)
    expect(wrapper.text()).toContain('把填好的表3 xlsx 拖進來')
    expect(wrapper.text()).not.toContain('比準地比較價格')
  })

  it('顯示填出來的格數', () => {
    const { wrapper } = mountWith(fakeResult())
    const text = wrapper.text()
    expect(text).toContain('116 格')
    expect(text).toContain('87 格')
    expect(text).toContain('24 格')
  })

  it('顯示表4 的價格與權重', () => {
    const { wrapper } = mountWith(fakeResult())
    const text = wrapper.text()
    expect(text).toContain('176,921')
    expect(text).toContain('177,000')
    expect(text).toContain('170,337')
    expect(text).toContain('較低')
    expect(text).toContain('20%')
  })

  it('把個別因素以 0 計的前提顯示出來', () => {
    // 少了這句，試算價格會被當成完整答案
    const { wrapper } = mountWith(fakeResult())
    expect(wrapper.text()).toContain('個別因素')
    expect(wrapper.text()).toContain('地價查估單位')
  })

  it('自我驗證通過時顯示通過與項數', () => {
    const { wrapper } = mountWith(fakeResult())
    expect(wrapper.text()).toContain('自我驗證通過')
    expect(wrapper.text()).toContain('10 / 10 項')
  })

  it('自我驗證未通過時列出未通過的項目', () => {
    const { wrapper } = mountWith(
      fakeResult({
        verification: {
          passed: false,
          total: 10,
          failed: 1,
          checks: [
            { name: '群組小計等於各細項相加', passed: false, detail: '不符：G18' },
            { name: '其他', passed: true, detail: '' },
          ],
        },
      }),
    )
    expect(wrapper.text()).toContain('自我驗證未通過')
    expect(wrapper.text()).toContain('群組小計等於各細項相加')
    expect(wrapper.text()).toContain('不符：G18')
  })

  it('零不帶正號', () => {
    const r = fakeResult()
    r.table4.regional_pct['P002-00'] = 0
    const { wrapper } = mountWith(r)
    expect(wrapper.text()).toContain('0.00%')
    expect(wrapper.text()).not.toContain('+0.00%')
  })

  it('點一列才展開那一格的依據', async () => {
    const { wrapper } = mountWith(fakeResult())
    expect(wrapper.text()).not.toContain('矩陣[比準地=1 優]')
    await wrapper.find('tbody tr.row').trigger('click')
    const text = wrapper.text()
    expect(text).toContain('28m 落在「28m以上」→ 第1級')
    expect(text).toContain('7m 落在「未滿8m」→ 第5級')
    expect(text).toContain('矩陣[比準地=1 優][比較標的=5 劣] = 15.00%')
  })

  it('顯示基準表頁碼，讓每一格對得回原文', () => {
    const { wrapper } = mountWith(fakeResult())
    expect(wrapper.text()).toContain('第 2 頁')
  })

  it('切換比較標的', async () => {
    const { wrapper, store } = mountWith(fakeResult())
    const tabs = wrapper.findAll('.tabs [role="tab"]')
    expect(tabs).toHaveLength(2)
    await tabs[1]!.trigger('click')
    expect(store.surveySegment).toBe('P003-00')
  })

  it('列出可下載的檔案', () => {
    const { wrapper } = mountWith(fakeResult())
    const links = wrapper.findAll('.files a')
    expect(links).toHaveLength(2)
    expect(links[0]!.text()).toBe('表5-final.xlsx')
    expect(links[1]!.text()).toBe('verification-report.json')
  })

  it('讀取警告要顯示出來，不能靜默', () => {
    const { wrapper } = mountWith(
      fakeResult({
        read_warnings: [
          { segment: 'P002-00', factor_id: 'regional.nature.sunlight', reason: '讀到空白' },
        ],
      }),
    )
    expect(wrapper.text()).toContain('讀到空白')
    expect(wrapper.text()).toContain('regional.nature.sunlight')
  })
})
