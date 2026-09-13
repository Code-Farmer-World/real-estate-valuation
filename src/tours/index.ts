/**
 * 導覽定義的載入與驗證。
 *
 * 導覽內容是「資料」不是「程式碼」：只要在本目錄新增一份 JSON，
 * 不必修改任何 .ts／.vue 就會被自動收錄。
 *
 * JSON 不受 TypeScript 保護，因此在此做執行期驗證：
 * 開發環境直接拋錯（讓格式問題立刻現形），正式環境略過該份導覽並記錄錯誤，
 * 避免輔助功能的設定錯誤導致主功能無法使用。
 */

import { useLogger } from '@/composables/useLogger'
import type { TourDefinition, TourStep, TourStepAlign, TourStepSide } from '@/types/tour'
import type { AppMode, TableTab } from '@/types/ui'

/** 泡泡位置的合法值 */
const VALID_SIDES: readonly string[] = ['top', 'right', 'bottom', 'left']

/** 泡泡對齊方式的合法值 */
const VALID_ALIGNS: readonly string[] = ['start', 'center', 'end']

/** 畫面模式的合法值 */
const VALID_MODES: readonly string[] = ['survey', 'review']

/** 表格分頁的合法值 */
const VALID_TABS: readonly string[] = ['表4', '表5-2', '表1']

/** 每份導覽必須明確列出的欄位 */
const REQUIRED_DEFINITION_KEYS: readonly string[] = ['id', 'name', 'order', 'requiresData', 'steps']

/** 每個步驟必須明確列出的欄位 */
const REQUIRED_STEP_KEYS: readonly string[] = [
  'anchor',
  'title',
  'description',
  'mode',
  'tab',
  'optional',
  'side',
  'align',
]

const logger = useLogger({ prefix: 'Tour', enabled: import.meta.env.DEV, showTimestamp: true })

/** Vite 在建置期展開，收集本目錄下所有導覽定義 */
const tourModules = import.meta.glob<{ default: unknown }>('@/tours/*.json', { eager: true })

/** 所有通過驗證的導覽定義，依教學順序排序 */
export const tourDefinitions: TourDefinition[] = collectTourDefinitions()

/**
 * 依 id 取得導覽定義
 * @param tourId 導覽識別碼
 * @returns 導覽定義；找不到時為 null
 */
export function findTourById(tourId: string): TourDefinition | null {
  return tourDefinitions.find((definition) => definition.id === tourId) ?? null
}

/**
 * 收集並驗證所有導覽定義
 * @returns 通過驗證的導覽定義，依 order 排序；order 相同時依 id
 */
function collectTourDefinitions(): TourDefinition[] {
  const definitions: TourDefinition[] = []
  const seenIds = new Set<string>()

  for (const [path, module] of Object.entries(tourModules)) {
    const issues: string[] = []
    const definition = parseDefinition(module.default, issues)

    if (definition === null) {
      reportIssues(path, issues)
      continue
    }

    if (seenIds.has(definition.id)) {
      reportIssues(path, [`導覽 id「${definition.id}」與其他定義檔重複，id 必須全站唯一`])
      continue
    }

    seenIds.add(definition.id)
    definitions.push(definition)
  }

  return definitions.sort((left, right) =>
    left.order === right.order ? left.id.localeCompare(right.id) : left.order - right.order,
  )
}

/**
 * 驗證單一導覽定義
 * @param raw 定義檔的原始內容
 * @param issues 驗證過程發現的問題，會就地追加
 * @returns 驗證通過的導覽定義；有問題時為 null
 */
function parseDefinition(raw: unknown, issues: string[]): TourDefinition | null {
  if (typeof raw !== 'object' || raw === null) {
    issues.push('內容不是物件')
    return null
  }

  const source = raw as Record<string, unknown>

  // 欄位固定，不允許省略：漏寫 requiresData 會讓還沒上傳檔案的人也點得下去，
  // 導覽只會卡在等不到的錨點上，不能靜默放行
  const missingKeys = REQUIRED_DEFINITION_KEYS.filter((key) => !(key in source))
  if (missingKeys.length > 0) {
    issues.push(`缺少欄位 ${missingKeys.join('、')}`)
    return null
  }

  if (!isNonEmptyString(source.id)) issues.push('id 必須是非空字串')
  if (!isNonEmptyString(source.name)) issues.push('name 必須是非空字串')
  if (typeof source.order !== 'number' || !Number.isFinite(source.order)) {
    issues.push('order 必須是數字')
  }
  if (source.requiresData !== null && !VALID_MODES.includes(source.requiresData as string)) {
    issues.push(`requiresData 必須是 ${VALID_MODES.join('／')} 或 null`)
  }
  if (!Array.isArray(source.steps) || source.steps.length === 0) {
    issues.push('steps 必須是至少有一個步驟的陣列')
    return null
  }

  const steps = source.steps.map((rawStep, index) => parseStep(rawStep, index, issues))

  if (issues.length > 0) return null

  return {
    id: source.id as string,
    name: source.name as string,
    order: source.order as number,
    requiresData: source.requiresData as AppMode | null,
    steps: steps as TourStep[],
  }
}

/**
 * 驗證單一步驟
 * @param raw 步驟的原始內容
 * @param index 步驟序號，從 0 起算
 * @param issues 驗證過程發現的問題，會就地追加
 * @returns 驗證通過的步驟；有問題時為 null
 */
function parseStep(raw: unknown, index: number, issues: string[]): TourStep | null {
  const stepLabel = `第 ${index + 1} 步`

  if (typeof raw !== 'object' || raw === null) {
    issues.push(`${stepLabel}：內容不是物件`)
    return null
  }

  const source = raw as Record<string, unknown>

  // 欄位固定，不允許省略：漏寫時要在這裡就被指出，而不是導覽跑到一半才出狀況
  const missingKeys = REQUIRED_STEP_KEYS.filter((key) => !(key in source))
  if (missingKeys.length > 0) {
    issues.push(`${stepLabel}：缺少欄位 ${missingKeys.join('、')}`)
    return null
  }

  if (source.anchor !== null && !isNonEmptyString(source.anchor)) {
    issues.push(`${stepLabel}：anchor 必須是非空字串或 null`)
  }
  if (!isNonEmptyString(source.title)) issues.push(`${stepLabel}：title 必須是非空字串`)
  if (!isNonEmptyString(source.description)) {
    issues.push(`${stepLabel}：description 必須是非空字串`)
  }
  if (source.mode !== null && !VALID_MODES.includes(source.mode as string)) {
    issues.push(`${stepLabel}：mode 必須是 ${VALID_MODES.join('／')} 或 null`)
  }
  if (source.tab !== null && !VALID_TABS.includes(source.tab as string)) {
    issues.push(`${stepLabel}：tab 必須是 ${VALID_TABS.join('／')} 或 null`)
  }
  if (typeof source.optional !== 'boolean') {
    issues.push(`${stepLabel}：optional 必須是 true 或 false`)
  }
  if (source.side !== null && !VALID_SIDES.includes(source.side as string)) {
    issues.push(`${stepLabel}：side 必須是 ${VALID_SIDES.join('／')} 或 null`)
  }
  if (source.align !== null && !VALID_ALIGNS.includes(source.align as string)) {
    issues.push(`${stepLabel}：align 必須是 ${VALID_ALIGNS.join('／')} 或 null`)
  }

  // 指定了分頁卻不在審查模式，是定義檔寫錯：分頁只存在於審查模式的畫面
  if (source.tab !== null && source.mode !== 'review') {
    issues.push(`${stepLabel}：指定了 tab 就必須把 mode 設為 review，分頁只存在於審查模式`)
  }

  if (issues.length > 0) return null

  return {
    anchor: source.anchor as string | null,
    title: source.title as string,
    description: source.description as string,
    mode: source.mode as AppMode | null,
    tab: source.tab as TableTab | null,
    optional: source.optional as boolean,
    side: source.side as TourStepSide | null,
    align: source.align as TourStepAlign | null,
  }
}

/**
 * 回報定義檔問題：開發環境直接拋錯，正式環境記錄後略過
 * @param path 定義檔路徑
 * @param issues 發現的問題
 */
function reportIssues(path: string, issues: string[]): void {
  const message = `導覽定義 ${path} 格式錯誤：\n- ${issues.join('\n- ')}`

  if (import.meta.env.DEV) throw new Error(message)

  logger.error(message)
}

/**
 * 是否為非空字串
 * @param value 待檢查的值
 * @returns 是非空字串時為 true
 */
function isNonEmptyString(value: unknown): boolean {
  return typeof value === 'string' && value.trim() !== ''
}
