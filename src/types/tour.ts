import type { AppMode, TableTab } from '@/types/ui'

/** 導覽泡泡相對於錨點的位置 */
export type TourStepSide = 'top' | 'right' | 'bottom' | 'left'

/** 導覽泡泡在該側的對齊方式 */
export type TourStepAlign = 'start' | 'center' | 'end'

/** 導覽的單一步驟 */
export interface TourStep {
  /** 錨點名稱，對應畫面上的 data-tour 屬性值；為 null 代表不指向特定元素，泡泡置中顯示 */
  anchor: string | null
  /** 步驟標題 */
  title: string
  /** 步驟說明，寫這一步在做什麼、為什麼要這樣做 */
  description: string
  /**
   * 這一步所在的畫面模式；與目前模式不同時會先切過去、等畫面就緒再顯示。
   * 為 null 代表沿用使用者當下的模式。
   */
  mode: AppMode | null
  /** 這一步所在的表格分頁，只有審查模式用得到；為 null 代表不切換分頁 */
  tab: TableTab | null
  /**
   * 這一步指向的區塊是否可能不存在。
   *
   * 畫面上不少區塊掛在 v-if 上，有沒有完全看資料：沒有不符之處就沒有「審查發現」區，
   * 沒有可疑值就沒有「輸入值有疑慮」區。那不是畫面壞了，是這份案件剛好沒有。
   * 設 true 時找不到錨點就整步略過；設 false 則照常等待，逾時退化成置中泡泡。
   */
  optional: boolean
  /** 泡泡相對錨點的位置，為 null 時由套件自動決定 */
  side: TourStepSide | null
  /** 泡泡在該側的對齊方式，為 null 時由套件自動決定 */
  align: TourStepAlign | null
}

/** 一份完整的導覽定義 */
export interface TourDefinition {
  /** 導覽識別碼，需全站唯一，同時作為「已看過」的紀錄鍵值 */
  id: string
  /** 導覽名稱，顯示在導覽選單 */
  name: string
  /**
   * 在導覽選單上的排序，數字小的排前面。
   *
   * 導覽之間有教學順序（先看懂這套工具在做什麼、再學怎麼操作），依 id 或名稱排都排不出來，
   * 只能明寫。習慣留 10 的間隔，之後要插進兩份之間不必重編其他份。
   */
  order: number
  /**
   * 需要先上傳哪一種檔案才播得動，為 null 代表任何狀態都能播。
   *
   * 產出與審查模式的畫面幾乎都掛在「有沒有資料」上：沒上傳勘查表，
   * 自我驗證、依據鏈、可交件的檔案全都不存在，導覽只會卡在等不到的錨點上。
   * 導覽也無法代替使用者決定要用哪一份檔案，所以這種導覽只能等使用者自己上傳完再開。
   */
  requiresData: AppMode | null
  /** 導覽步驟，依序播放 */
  steps: TourStep[]
}
