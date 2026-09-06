/**
 * 查估案件的領域型別。
 *
 * 欄位一律 snake_case，與後端 `kernel/golden/case_1140901_99_001.json` 完全一致。
 * 原因見 `real-estate-valuation-py/api/CONTRACT.md`：factor_id 本身就是
 * `individual.road.frontage_road_width` 這種帶點的 snake，它是**資料的鍵**不是欄位名；
 * 為了 camelCase 而轉換，等於在前端與引擎之間插一層雙向對照表，只會製造對不上的機會。
 *
 * 只有回應信封（data / error / code / message）是 camelCase，那由 axiosService 處理。
 */

/** 一個欄位的來源：PDF 第幾頁、哪個位置、原始文字、走哪條辨識路徑 */
export interface FieldSource {
  page: number
  /** [x0, top, x1, bottom]，單位 pt，原點左上 */
  bbox: number[] | null
  raw_text: string
  /** `text_layer` = 文字層直接讀出；未來的 `vision` = 模型看圖 */
  backend: string
}

/** 欄位路徑 → 來源。鍵長得像 `表4.benchmark.facts.individual.parcel.area` */
export type Provenance = Record<string, FieldSource>

export type FactValue = number | string | null

// ==================== 表1 地價區段勘查表 ====================

/** 勘查表一格的結構化結果。`raw` 永遠保留，因為欄位型態太雜，結構化可能漏 */
export interface Survey {
  raw: string
  entries: SurveyEntry[]
  /** 可直接讀成數字的量測值（建蔽率 70、主要道路 18） */
  numeric: number | null
  unit: string | null
  /** 純文字型的填答（都市計畫內、已完全開發） */
  text: string | null
}

export interface SurveyEntry {
  option: string | null
  name: string | null
  quantity: number | null
  distance_m: number | null
  /** 是否在本區段內。null = 兩個圈都沒點 */
  in_segment: boolean | null
  /** 是否被圈選（●）。未圈選但填了名稱的也會保留，「無」本身就是事實 */
  marked: boolean
}

export interface Table1Grade {
  grade: number | null
  /** 總級數。**不一定是 5**：都市計畫內外、有無禁建、有無限建都是 2 級 */
  grade_count: number | null
  /** 這個細項在表1 上印的名稱，與表5-2 的寫法不同 */
  label_in_form: string
}

export interface Table1 {
  period: string | null
  segment_no: string | null
  segment_scope: string | null
  grades: Record<string, Table1Grade>
  surveys: Record<string, Survey>
  warnings: ParseWarning[]
}

// ==================== 表5-2 影響地價區域因素分析明細表 ====================

export interface GradeCell {
  grade: number | null
  label: string
}

export interface Table52Comparable {
  index: number
  example_no: string | null
  segment: string | null
  grades: Record<string, GradeCell>
  /** 估價師填的修正百分比 */
  filed_corrections: Record<string, number>
  /** 8 個主要項目的百分比小計 */
  filed_subtotals: Record<string, number>
  /** 影響地價區域因素總修正數。這個值要抄進表4 */
  filed_total: number | null
}

export interface Table52Group {
  label: string
  factor_ids: string[]
}

export interface Table52 {
  case_id: string
  land_use: string
  benchmark_segment: string | null
  benchmark_grades: Record<string, GradeCell>
  comparables: Table52Comparable[]
  groups: Table52Group[]
  /** factor_id → 書表上的中文細項名。對照表在後端，前端不自己抄一份 */
  factor_labels: Record<string, string>
  warnings: ParseWarning[]
}

// ==================== 表4 比較法調查估價表 ====================

export interface Table4Side {
  label?: string
  parcel: string | null
  segment: string | null
  facts: Record<string, FactValue>
  /** 帶名稱的距離欄的原始寫法，例如「中山路 18M」 */
  fact_labels: Record<string, string>
}

export interface Table4Comparable extends Table4Side {
  index: number
  example_no: string | null
  transaction_date: string | null
  normal_unit_price: number | null
  date_adjustment_pct: number | null
  /** 表上顯示的「調整至估價基準日單價」。**這是顯示欄位，不參與計算** */
  date_adjusted_unit_price_displayed: number | null
  regional_adjustment_pct: number | null
  /** 估價師填的差異率，審查模式用來跟引擎重算的值比對 */
  filed_corrections: Record<string, number>
  individual_total_pct: number | null
  abs_sum_pct: number | null
  similarity_label: string | null
  trial_price: number | null
  weight_pct: number | null
}

export interface Table4 {
  case_id: string
  appraisal_base_date: string
  benchmark: Table4Side
  comparables: Table4Comparable[]
  /** factor_id → 表4 上的列名（含列號，例如「14面前道路寬度」） */
  factor_labels: Record<string, string>
}

// ==================== API 回傳 ====================

export interface ParseWarning {
  code: string
  message: string
  path?: string
  table?: string
}

export interface ParsedTables {
  '表1'?: Table1
  '表5-2'?: Table52
  '表4'?: Table4
}

export interface PageInfo {
  page: number
  /** null 代表這頁不是書表（範本後三頁是區段圖） */
  table: string | null
}

export interface ParseResult {
  case_id: string | null
  pages: PageInfo[]
  tables: ParsedTables
  provenance: Provenance
  warnings: ParseWarning[]
}

/** 一項修正率的完整依據鏈，這是「每個數字都指得回來源」的資料結構 */
export interface Correction {
  factor_id: string
  label: string
  table4_row: number | null
  benchmark: GradeDetail
  comparable: GradeDetail
  correction_pct: number
  /** 矩陣查表的說明，例如「矩陣[比準地=2 稍優][比較標的=4 稍劣] = 5.00%」 */
  basis: string
  /** 評價基準明細表的頁碼 */
  source_page: number | null
}

export interface GradeDetail {
  value: FactValue
  grade: number
  label: string
  /** 分級理由，例如「18 落在『15m以上未滿20m』→ 第2級」 */
  reason: string
}

export interface ComputeComparable {
  index: number
  date_pct: number
  regional_pct: number
  individual_total_pct: number
  abs_sum_pct: number
  similarity_label: string
  weight_pct: number
  trial_price: number
  corrections: Correction[]
}

export interface ComputeResult {
  ruleset_individual: string
  comparables: ComputeComparable[]
  benchmark_comparison_price: number
  /** 依查估辦法第21條分段無條件進位後的比準地地價 */
  benchmark_land_price_rounded: number
}

export interface ReviewFinding {
  factor_id: string
  comparable_index?: number
  filed: unknown
  computed: unknown
  basis: string
  source_page?: number | null
}

export interface ReviewLayers {
  /** 第一層：表1 內部，量測值 vs 所填等級 */
  table1_internal: ReviewFinding[]
  /** 第二層：表1 → 表5-2（審查重點第 vi 項） */
  table1_to_table5_2: ReviewFinding[]
  /** 第三層：表5-2 → 表4（審查重點第 vii 項） */
  table5_2_to_table4: ReviewFinding[]
}

/** 查不動的項目。誠實列出來，不能靜靜跳過然後顯示「全部通過」 */
export interface NotCheckable {
  layer: string
  factor_id?: string
  reason: string
}

export interface ReviewResult {
  verdict: 'match' | 'mismatch'
  finding_count: number
  /** 各層實際查了幾格。沒有這個數字，「相符」就只是一句沒有份量的話 */
  checked: { table1_internal: number; table1_to_table5_2: number; table5_2_to_table4: number }
  checked_total: number
  layers: ReviewLayers
  not_checkable: NotCheckable[]
  price_impact: PriceImpact | null
}

export interface PriceImpact {
  filed: number | null
  computed: number
  benchmark_land_price: number
  diff_per_sqm: number | null
}

export interface Ruleset {
  ruleset_id: string
  kind: 'individual' | 'regional'
  district: string | null
  land_use: string | null
  status: string | null
  factor_count: number
}

/** 產出的書表檔案。形狀比照 axiosService 的 UploadedResponse（id / link） */
export interface GeneratedForm {
  table: string
  filename: string
  size: number
  /** 相對於 VITE_API_URL 的下載路徑 */
  link: string
}

export interface GeneratedForms {
  id: string
  files: GeneratedForm[]
}
