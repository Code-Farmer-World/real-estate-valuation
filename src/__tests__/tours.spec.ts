import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import { findTourById, tourDefinitions } from '../tours'
import { useCaseStore } from '../stores/case'
import { useTourStore } from '../stores/tour'

/**
 * 導覽定義的防呆。
 *
 * 導覽內容是資料不是程式碼——JSON 不受 TypeScript 保護，格式寫錯只有執行期才發現。
 * 載入模組時就會做驗證並在開發環境拋錯，所以這支測試光是 import 成功就已經驗到一部分；
 * 下面再補幾條「驗證器不會檢查、但錯了會很難查」的整體性質。
 *
 * 錨點是否真的存在於畫面上，不在這裡驗——那需要整個 app 渲染出來，由 e2e/tour.spec.ts 負責。
 */
describe('導覽定義', () => {
  it('全部通過驗證並被收錄', () => {
    // 驗證失敗的定義檔在開發環境會直接拋錯，所以走到這裡代表每一份都過了。
    // 數量寫死沒有意義（新增一份就要改測試），改驗「至少有東西」與新手上路一定在。
    expect(tourDefinitions.length).toBeGreaterThan(0)
    expect(findTourById('getting-started')).not.toBeNull()
  })

  it('id 全站唯一', () => {
    const ids = tourDefinitions.map((definition) => definition.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('依 order 由小到大排好，選單才會照教學順序列出', () => {
    const orders = tourDefinitions.map((definition) => definition.order)
    expect(orders).toStrictEqual([...orders].sort((left, right) => left - right))
  })

  it('每一份都有步驟，且每一步都有標題與說明', () => {
    // 先收集問題再一次斷言：失敗時一眼看得到全部缺漏，不必修一筆跑一次
    const problems: string[] = []

    for (const definition of tourDefinitions) {
      if (definition.steps.length === 0) problems.push(`${definition.id}：沒有任何步驟`)

      for (const [index, step] of definition.steps.entries()) {
        const label = `${definition.id} 第 ${index + 1} 步`
        if (step.title.trim() === '') problems.push(`${label}：缺標題`)
        if (step.description.trim() === '') problems.push(`${label}：缺說明`)
      }
    }

    expect(problems).toStrictEqual([])
  })

  it('指定分頁的步驟一定停在審查模式，因為分頁只存在於審查模式', () => {
    const problems = tourDefinitions.flatMap((definition) =>
      definition.steps
        .filter((step) => step.tab !== null && step.mode !== 'review')
        .map((step) => `${definition.id}「${step.title}」：指定了 tab 卻不在審查模式`),
    )

    expect(problems).toStrictEqual([])
  })

  it('findTourById 找不到時回 null 而不是丟錯', () => {
    expect(findTourById('這份導覽不存在')).toBeNull()
  })

  it('每個錨點都在某個 .vue 裡宣告過', () => {
    /*
     * 導覽找不到錨點時會退化成置中泡泡而不是報錯，所以錨點被刪掉或改名不容易被發現。
     *
     * 最完整的檢查是 e2e/tour.spec.ts——它把導覽真的走一遍。但需要上傳檔案的那兩份
     * 得等後端起著才跑得動，平常會整支跳過，等於那些錨點沒人在看。這裡退而求其次，
     * 直接掃原始碼確認宣告還在：擋不住「元素被 v-if 藏起來」，但擋得住改名與誤刪，
     * 而那才是這種東西最常見的死法。
     */
    const declared = collectDeclaredAnchors()

    const missing = tourDefinitions.flatMap((definition) =>
      definition.steps
        .filter((step) => step.anchor !== null && !declared.has(step.anchor))
        .map(
          (step) => `src/tours/${definition.id}.json「${step.title}」→ data-tour="${step.anchor}"`,
        ),
    )

    // 列出來的每一筆都指得出是哪份定義檔的哪一步：把 data-tour 加回原本的元素，
    // 或同步修改那一份定義檔的該步驟。
    expect(missing).toStrictEqual([])
  })
})

/** src/ 底下所有 .vue 的原始碼。走 Vite 的 glob 而不是 fs，路徑由打包器解析，不必自己算 */
const vueSources = import.meta.glob<string>('@/**/*.vue', {
  eager: true,
  query: '?raw',
  import: 'default',
})

/**
 * 掃出所有 .vue 檔宣告過的 data-tour 名稱
 * @returns 錨點名稱
 */
function collectDeclaredAnchors(): Set<string> {
  const anchors = new Set<string>()

  for (const source of Object.values(vueSources)) {
    for (const line of source.split(/\r?\n/)) {
      if (!line.includes('data-tour')) continue

      // 靜態寫法：data-tour="名稱"
      for (const match of line.matchAll(/data-tour="([^"']+)"/g)) anchors.add(match[1]!)

      // 綁定寫法：:data-tour="條件 ? '名稱' : undefined"
      for (const match of line.matchAll(/'([^']+)'/g)) anchors.add(match[1]!)
    }
  }

  return anchors
}

describe('導覽狀態', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    window.localStorage.clear()
  })

  it('需要資料的導覽在沒上傳檔案時點不下去，並說明缺什麼', () => {
    const tourStore = useTourStore()

    expect(tourStore.canStartTour('survey-mode')).toBe(false)
    expect(tourStore.getBlockedReason('survey-mode')).toContain('勘查表')

    expect(tourStore.canStartTour('review-mode')).toBe(false)
    expect(tourStore.getBlockedReason('review-mode')).toContain('PDF')
  })

  it('不需要資料的導覽隨時都能開', () => {
    const tourStore = useTourStore()

    expect(tourStore.canStartTour('getting-started')).toBe(true)
    expect(tourStore.getBlockedReason('getting-started')).toBeNull()
  })

  it('上傳勘查表之後，產出模式的導覽才解鎖', () => {
    const tourStore = useTourStore()
    const caseStore = useCaseStore()

    expect(tourStore.canStartTour('survey-mode')).toBe(false)

    // 這份導覽只看「有沒有資料」，不看資料內容，所以塞一個非 null 的值就夠了
    caseStore.survey = {} as never

    expect(tourStore.canStartTour('survey-mode')).toBe(true)
    // 審查模式走的是另一份資料，不該被一起解鎖
    expect(tourStore.canStartTour('review-mode')).toBe(false)
  })

  it('已看過的紀錄寫得進 localStorage，重建 store 後仍記得', () => {
    const tourStore = useTourStore()

    expect(tourStore.hasSeenTour('getting-started')).toBe(false)

    tourStore.markTourSeen('getting-started')
    expect(tourStore.hasSeenTour('getting-started')).toBe(true)

    // 換一個新的 pinia，模擬重新整理頁面
    setActivePinia(createPinia())
    expect(useTourStore().hasSeenTour('getting-started')).toBe(true)
  })

  it('重複標記同一份不會在紀錄裡留下重複項目', () => {
    const tourStore = useTourStore()

    tourStore.markTourSeen('getting-started')
    tourStore.markTourSeen('getting-started')

    expect(JSON.parse(window.localStorage.getItem('seenTours') ?? '[]')).toStrictEqual([
      'getting-started',
    ])
  })

  it('清除紀錄後全部回到未看過', () => {
    const tourStore = useTourStore()

    tourStore.markTourSeen('getting-started')
    tourStore.resetSeenTours()

    expect(tourStore.hasSeenTour('getting-started')).toBe(false)
  })

  it('localStorage 裡是壞資料時當作沒看過，不讓導覽拖垮畫面', () => {
    window.localStorage.setItem('seenTours', '這不是 JSON')

    expect(() => useTourStore()).not.toThrow()
    expect(useTourStore().hasSeenTour('getting-started')).toBe(false)
  })
})
