/**
 * 系統導覽的狀態管理。
 *
 * 導覽會跨模式、跨分頁播放，狀態必須在畫面切換後存活，因此放在 store 而非元件區域狀態。
 * driver.js 實例是命令式物件，不放進響應式狀態，改以模組層變數持有。
 */

import { computed, nextTick, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import { driver, type Driver } from 'driver.js'

import { useLogger } from '@/composables/useLogger'
import { useCaseStore } from '@/stores/case'
import { useUiStore } from '@/stores/ui'
import { findTourById, tourDefinitions } from '@/tours'
import type { TourDefinition, TourStep } from '@/types/tour'

import 'driver.js/dist/driver.css'

/** 等待錨點出現的逾時毫秒數，逾時就讓該步驟以置中泡泡呈現而不是卡住 */
const ANCHOR_WAIT_TIMEOUT = 5000

/** 記錄已看過導覽的 localStorage 鍵值 */
const SEEN_TOURS_KEY = 'seenTours'

const logger = useLogger({ prefix: 'Tour', enabled: import.meta.env.DEV, showTimestamp: true })

/** 目前的 driver.js 實例，沒有導覽進行時為 null */
let driverInstance: Driver | null = null

export const useTourStore = defineStore('tour', () => {
  const caseStore = useCaseStore()
  const uiStore = useUiStore()

  /** 已看過的導覽 id。存進 localStorage，重整後仍記得 */
  const seenTourIds = shallowRef<string[]>(readSeenTourIds())

  /** 目前正在播放的導覽，沒有播放時為 null */
  const activeTour = shallowRef<TourDefinition | null>(null)

  /**
   * 可以列在選單上的導覽。
   *
   * 這裡不做過濾：沒有權限系統，每份導覽人人看得到。需要先上傳檔案的那幾份
   * 仍然會列出來，只是點不下去並附上原因——看得到才知道有這個東西，
   * 傳完檔案之後自己會回來點。
   */
  const tours = computed<TourDefinition[]>(() => tourDefinitions)

  /** 目前是否有導覽正在播放 */
  const isRunning = computed<boolean>(() => activeTour.value !== null)

  /**
   * 啟動指定導覽
   * @param tourId 導覽識別碼
   */
  async function startTour(tourId: string) {
    const definition = findTourById(tourId)

    if (definition === null) {
      logger.warn(`找不到導覽定義：${tourId}`)
      return
    }

    if (!canStartTour(tourId)) {
      logger.warn(`導覽「${definition.id}」在目前狀態下無法啟動`, {
        需要資料: definition.requiresData,
      })
      return
    }

    // 同時只允許一份導覽播放，重複啟動先收掉前一份
    stopTour()

    const firstStep = definition.steps[0]
    if (firstStep === undefined) return

    // 第一步同樣可能需要先切模式，準備完才開始播放
    await prepareStep(firstStep)

    activeTour.value = definition
    driverInstance = createDriver(definition)
    driverInstance.drive(0)
  }

  /** 結束目前導覽 */
  function stopTour() {
    // 先清掉指標再銷毀：destroy 會同步觸發 onDestroyStarted，避免重入時重複銷毀
    const instance = driverInstance
    driverInstance = null
    activeTour.value = null

    instance?.destroy()
  }

  /**
   * 目前狀態能不能啟動指定導覽
   *
   * 只有一道關卡：需要資料的導覽得先有資料。產出與審查模式的畫面幾乎都掛在
   * 「有沒有上傳檔案」上，沒資料就沒有那些元素，導覽只會卡在等不到的錨點上。
   * @param tourId 導覽識別碼
   * @returns 可以啟動時為 true
   */
  function canStartTour(tourId: string): boolean {
    const definition = findTourById(tourId)

    if (definition === null) return false
    if (definition.requiresData === null) return true
    if (definition.requiresData === 'survey') return caseStore.survey !== null

    return caseStore.parsed !== null
  }

  /**
   * 導覽點不下去的原因，用於在選單上說明
   * @param tourId 導覽識別碼
   * @returns 原因；可以啟動時為 null
   */
  function getBlockedReason(tourId: string): string | null {
    if (canStartTour(tourId)) return null

    const definition = findTourById(tourId)
    if (definition === null) return '找不到這份導覽'

    return definition.requiresData === 'survey'
      ? '請先在產出模式上傳勘查表 xlsx'
      : '請先在審查模式上傳查估書表 PDF'
  }

  /**
   * 是否已看過指定導覽
   * @param tourId 導覽識別碼
   * @returns 已看過時為 true
   */
  function hasSeenTour(tourId: string): boolean {
    return seenTourIds.value.includes(tourId)
  }

  /**
   * 記錄指定導覽已看過
   * @param tourId 導覽識別碼
   */
  function markTourSeen(tourId: string) {
    if (hasSeenTour(tourId)) return

    // 指派新陣列而不是 push，shallowRef 才偵測得到變更
    seenTourIds.value = [...seenTourIds.value, tourId]
    writeSeenTourIds(seenTourIds.value)
  }

  /** 清除所有已看過紀錄，讓導覽重新標示為未看過 */
  function resetSeenTours() {
    seenTourIds.value = []
    writeSeenTourIds([])
  }

  /**
   * 建立 driver.js 實例，並接管上一步／下一步以支援非同步準備
   * @param definition 要播放的導覽定義
   * @returns driver.js 實例
   */
  function createDriver(definition: TourDefinition): Driver {
    return driver({
      showProgress: true,
      allowClose: true,
      // 方向鍵會直接前進而繞過非同步準備，關掉以避免步驟顯示在還沒就緒的畫面上
      allowKeyboardControl: false,
      overlayOpacity: 0.6,
      stagePadding: 6,
      stageRadius: 6,
      nextBtnText: '下一步',
      prevBtnText: '上一步',
      doneBtnText: '完成',
      progressText: '{{current}} / {{total}}',
      steps: definition.steps.map((step) => ({
        element: step.anchor === null ? undefined : buildAnchorSelector(step.anchor),
        popover: {
          title: step.title,
          description: step.description,
          side: step.side ?? undefined,
          align: step.align ?? undefined,
          showButtons: ['previous', 'next', 'close'],
        },
      })),
      // 設定 onNextClick／onPrevClick 後 driver.js 不會自動前進，
      // 由我們先完成模式切換與等待錨點，再手動推進到下一步
      onNextClick: () => {
        void moveToStep(definition, getActiveIndex() + 1, 1)
      },
      onPrevClick: () => {
        void moveToStep(definition, getActiveIndex() - 1, -1)
      },
      // 最後一步的按鈕會落到這裡，明確處理避免導覽走完卻關不掉
      onDoneClick: () => {
        markTourSeen(definition.id)
        stopTour()
      },
      onDestroyStarted: () => {
        // 不論是走完、略過或點遮罩關閉，都視為看過，之後在選單上標示為「可重看」
        markTourSeen(definition.id)
        stopTour()
      },
    })
  }

  /**
   * 準備並移動到指定步驟；超出範圍代表導覽結束
   * @param definition 播放中的導覽定義
   * @param index 目標步驟索引
   * @param direction 前進為 1、後退為 -1，用於略過 optional 步驟時決定往哪邊找
   */
  async function moveToStep(definition: TourDefinition, index: number, direction: 1 | -1) {
    if (driverInstance === null) return

    if (index < 0 || index >= definition.steps.length) {
      markTourSeen(definition.id)
      stopTour()
      return
    }

    const step = definition.steps[index]
    if (step === undefined) return

    const ready = await prepareStep(step)

    // 準備期間使用者可能已經關掉導覽
    if (driverInstance === null) return

    // optional 的步驟找不到錨點，代表這份案件沒有那個區塊，往同方向跳過它
    if (!ready) {
      await moveToStep(definition, index + direction, direction)
      return
    }

    driverInstance.moveTo(index)
  }

  /**
   * 取得 driver.js 目前所在的步驟索引
   * @returns 步驟索引，從 0 起算
   */
  function getActiveIndex(): number {
    return driverInstance?.getActiveIndex() ?? 0
  }

  /**
   * 切到步驟所屬的模式與分頁並等待錨點出現，確保泡泡不會指向還不存在的元素
   * @param step 要準備的步驟
   * @returns 這一步可以顯示時為 true；optional 且錨點不存在時為 false
   */
  async function prepareStep(step: TourStep): Promise<boolean> {
    if (step.mode !== null && uiStore.mode !== step.mode) uiStore.mode = step.mode
    if (step.tab !== null && uiStore.tab !== step.tab) uiStore.tab = step.tab

    await nextTick()

    if (step.anchor === null) return true

    // optional 的步驟不等待：會走到這裡代表資料早就載完了，錨點該在的話此刻就在。
    // 等滿逾時只會讓使用者對著遮罩乾等五秒，才發現這一步根本要略過。
    if (step.optional) {
      const element = document.querySelector<HTMLElement>(buildAnchorSelector(step.anchor))
      if (element === null) return false

      scrollAnchorIntoView(element)
      await nextTick()
      return true
    }

    const element = await waitForAnchor(step.anchor, ANCHOR_WAIT_TIMEOUT)

    if (element === null) {
      logger.warn(
        `錨點在 ${ANCHOR_WAIT_TIMEOUT}ms 內沒有出現，該步驟將以置中泡泡呈現：data-tour="${step.anchor}"`,
      )
      return true
    }

    scrollAnchorIntoView(element)
    await nextTick()
    return true
  }

  return {
    // 狀態
    activeTour,
    tours,
    isRunning,

    // 方法
    startTour,
    stopTour,
    canStartTour,
    getBlockedReason,
    hasSeenTour,
    markTourSeen,
    resetSeenTours,
  }
})

/**
 * 組出錨點的選擇器；一律以 data-tour 定位，不依賴 class 或位置
 * @param anchor 錨點名稱
 * @returns CSS 選擇器
 */
export function buildAnchorSelector(anchor: string): string {
  return `[data-tour="${anchor}"]`
}

/**
 * 把錨點捲進視野，讓遮罩挖在使用者看得到的地方
 *
 * 步驟之間畫面可能已經捲到很下面，光是找到錨點還不夠：
 * 錨點若整個在畫面外，使用者只會看到遮罩框住一片空白。
 * @param element 錨點元素
 */
function scrollAnchorIntoView(element: HTMLElement) {
  element.scrollIntoView({ block: 'center', inline: 'nearest' })
}

/**
 * 等待錨點出現在畫面上
 * @param anchor 錨點名稱
 * @param timeout 逾時毫秒數
 * @returns 錨點元素；逾時時為 null
 */
function waitForAnchor(anchor: string, timeout: number): Promise<HTMLElement | null> {
  const selector = buildAnchorSelector(anchor)
  const existing = document.querySelector<HTMLElement>(selector)

  if (existing !== null) return Promise.resolve(existing)

  return new Promise((resolve) => {
    const timer = window.setTimeout(() => {
      observer.disconnect()
      resolve(null)
    }, timeout)

    // 資料是非同步載入的，錨點可能在任何時間點才掛上 DOM
    const observer = new MutationObserver(() => {
      const element = document.querySelector<HTMLElement>(selector)
      if (element === null) return

      window.clearTimeout(timer)
      observer.disconnect()
      resolve(element)
    })

    observer.observe(document.body, { childList: true, subtree: true })
  })
}

/**
 * 讀取已看過的導覽 id
 *
 * localStorage 在無痕視窗或封鎖第三方儲存時會直接丟例外，內容也可能被手動改壞。
 * 導覽是輔助功能，讀不到就當作沒看過，不能讓它拖垮整個畫面。
 * @returns 已看過的導覽識別碼
 */
function readSeenTourIds(): string[] {
  try {
    const raw = window.localStorage.getItem(SEEN_TOURS_KEY)
    if (raw === null) return []

    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    return parsed.filter((id): id is string => typeof id === 'string')
  } catch {
    return []
  }
}

/**
 * 寫回已看過的導覽 id
 * @param tourIds 已看過的導覽識別碼
 */
function writeSeenTourIds(tourIds: string[]) {
  try {
    window.localStorage.setItem(SEEN_TOURS_KEY, JSON.stringify(tourIds))
  } catch {
    // 寫不進去只影響「下次還會標示為未看過」，不值得中斷導覽
  }
}
