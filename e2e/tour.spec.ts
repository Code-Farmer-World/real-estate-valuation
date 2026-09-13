import { test, expect, type Locator, type Page } from '@playwright/test'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * 導覽錨點防呆。
 *
 * 掃過 src/tours/ 的每一份導覽定義，實際把導覽走一遍，確認每個步驟的 data-tour
 * 錨點都存在於真正渲染出來的畫面上、而且看得到。
 *
 * 這裡刻意走使用者的真實路徑（從右下角的導覽按鈕啟動、按下一步前進），
 * 而不是自行維護一份「步驟對應元素」的表——那種表本身就會過期。
 * 導覽找不到錨點時會退化成置中泡泡，因此「錨點有沒有被高亮」正好是判準。
 *
 * 需要先上傳檔案的導覽沿用 integration.spec.ts 的慣例：後端沒起或找不到測試檔
 * 就整支跳過，不讓 CI 因環境紅掉。
 */

/** 這個檔案是 ES module，沒有 __dirname，要自己從 import.meta.url 換算 */
const HERE = dirname(fileURLToPath(import.meta.url))

const TOURS_DIR = resolve(HERE, '../src/tours')

const API = process.env.VITE_API_URL ?? 'http://localhost:8000'

/** 產出模式的輸入檔，與 integration.spec.ts 同一份 */
const SURVEY_XLSX =
  process.env.SURVEY_XLSX ?? resolve(HERE, '../../real-estate-valuation-py/tmp/表3-填好.xlsx')

/**
 * 等待泡泡出現的逾時，必須大於 stores/tour.ts 的 ANCHOR_WAIT_TIMEOUT（5 秒）。
 * 錨點不存在時，導覽會先等滿那 5 秒才改以置中泡泡顯示。這裡若設得比它短，
 * 會在泡泡出現前就逾時，錯誤訊息就會變成「導覽卡住」而蓋掉真正的原因（某個錨點不見了）。
 */
const POPOVER_TIMEOUT = 10_000

/** 導覽定義檔的形狀，只取本測試需要的欄位 */
interface TourStep {
  anchor: string | null
  title: string
  optional: boolean
}

/** 一份導覽定義，附帶來源檔名以便錯誤訊息指路 */
interface TourFile {
  fileName: string
  id: string
  name: string
  requiresData: 'survey' | 'review' | null
  steps: TourStep[]
}

const TOURS = loadTours()

/*
 * 這支測試是資料驅動的：步驟數量、某一步有沒有錨點、是不是 optional，都由 JSON 決定。
 * 迴圈內的分支是在描述資料的形狀，不是測試邏輯的不確定分支，因此關閉前兩條規則。
 *
 * 第三條（expect-expect）是誤判：斷言集中在 assertAnchor／walkTour 這些共用函式裡，
 * 規則看不進去。斷言確實存在，只是不寫在 test() 的大括號裡。
 */
/* eslint-disable playwright/no-conditional-in-test, playwright/no-conditional-expect, playwright/expect-expect */

test('每一份導覽定義都通過驗證並出現在導覽選單', async ({ page }) => {
  await page.goto('/')
  await openLauncher(page)

  const fileList = TOURS.map((tour) => tour.fileName).join('、')

  await expect(
    launcherItems(page),
    `src/tours/ 共有 ${TOURS.length} 份導覽定義（${fileList}），但導覽選單列出的數量不符，` +
      `代表有定義檔沒有通過格式驗證而被略過`,
  ).toHaveCount(TOURS.length)
})

test('沒上傳檔案時，需要資料的導覽點不下去並說明缺什麼', async ({ page }) => {
  await page.goto('/')
  await openLauncher(page)

  for (const tour of TOURS) {
    const item = launcherItems(page).filter({ hasText: tour.name })

    if (tour.requiresData === null) {
      await expect(item, `「${tour.name}」不需要資料，應該隨時都能開`).toBeEnabled()
      continue
    }

    await expect(item, `「${tour.name}」需要先上傳檔案，沒資料時應該是停用的`).toBeDisabled()
    await expect(item, `「${tour.name}」停用時要說明缺什麼，不能只是點不下去`).toContainText('請先')
  }
})

for (const tour of TOURS) {
  test(`導覽「${tour.name}」的每個錨點都存在於畫面上`, async ({ page }) => {
    await prepareData(page, tour)

    await page.goto('/')
    await startTour(page, tour)
    await walkTour(page, tour)
  })
}

/**
 * 備妥這份導覽需要的資料；備不了就跳過整支測試
 * @param page 測試頁面
 * @param tour 導覽定義
 */
async function prepareData(page: Page, tour: TourFile) {
  if (tour.requiresData === null) return

  // 審查模式吃的是填好的查估書表 PDF，repo 裡沒有這種 fixture，
  // 有了再把上傳步驟補在這裡即可，其餘邏輯都是共用的。
  test.skip(
    tour.requiresData === 'review',
    `導覽「${tour.name}」需要已辨識的查估書表 PDF，repo 內沒有可用的 fixture，跳過`,
  )

  let alive = false
  try {
    const res = await fetch(`${API}/api/health`)
    alive = res.ok
  } catch {
    alive = false
  }
  test.skip(!alive, `後端沒在 ${API} 跑，無法備妥「${tour.name}」需要的資料，跳過`)
  test.skip(!existsSync(SURVEY_XLSX), `找不到測試用勘查表 ${SURVEY_XLSX}，跳過`)

  await page.goto('/')
  await page.locator('input[type="file"]').setInputFiles(SURVEY_XLSX)

  // 自我驗證排在結果區最前面，它出現就代表整份資料都算完了
  await expect(page.getByText('自我驗證通過')).toBeVisible({ timeout: 30_000 })
}

/**
 * 打開右下角的導覽選單
 * @param page 測試頁面
 */
async function openLauncher(page: Page) {
  await page.locator('[data-tour="tour-launcher"]').click()
  await expect(page.getByRole('dialog', { name: '系統導覽' })).toBeVisible()
}

/**
 * 導覽選單裡的每一列
 * @param page 測試頁面
 * @returns 選單項目的 Locator
 */
function launcherItems(page: Page): Locator {
  return page.getByRole('dialog', { name: '系統導覽' }).getByRole('button')
}

/**
 * 從導覽選單啟動指定導覽
 * @param page 測試頁面
 * @param tour 導覽定義
 */
async function startTour(page: Page, tour: TourFile) {
  await openLauncher(page)

  const entry = launcherItems(page).filter({ hasText: tour.name })

  await expect(
    entry,
    `導覽選單裡找不到「${tour.name}」，請確認 src/tours/${tour.fileName} 有通過格式驗證`,
  ).toHaveCount(1)

  await entry.click()
}

/**
 * 把導覽從頭走到尾，逐步驗證錨點
 *
 * 不預測哪幾步會出現，而是讀泡泡實際顯示的標題再回頭對定義檔——
 * optional 的步驟在資料裡沒有對應區塊時會被導覽略過，那是預期行為。
 * @param page 測試頁面
 * @param tour 導覽定義
 */
async function walkTour(page: Page, tour: TourFile) {
  const popover = page.locator('.driver-popover')
  const shownTitles: string[] = []

  await expect(popover, `導覽「${tour.name}」沒有啟動`).toBeVisible({ timeout: POPOVER_TIMEOUT })

  // 上限比步驟數多一點，導覽若因故繞不出去也不會在這裡無限迴圈
  for (let guard = 0; guard <= tour.steps.length; guard++) {
    if (!(await popover.isVisible())) break

    const title = (await popover.locator('.driver-popover-title').innerText()).trim()
    const step = tour.steps.find((candidate) => candidate.title === title)

    expect(
      step,
      `泡泡顯示的標題「${title}」不在 src/tours/${tour.fileName} 裡，定義檔與畫面對不起來`,
    ).toBeDefined()

    shownTitles.push(title)
    await assertAnchor(page, tour, step!)

    await popover.locator('.driver-popover-next-btn').click()

    // 按下去之後畫面可能要先切模式、等錨點，標題不會立刻變；
    // 最後一步按的是「完成」，泡泡會直接消失。
    await expect
      .poll(async () => ((await popover.isVisible()) ? await titleOf(popover) : null), {
        timeout: POPOVER_TIMEOUT,
        message: `「${title}」按下一步之後導覽沒有前進，可能卡在等不到的錨點上`,
      })
      .not.toBe(title)
  }

  assertNoRequiredStepSkipped(tour, shownTitles)
}

/**
 * 驗證某一步的錨點確實存在、被高亮、而且看得到
 * @param page 測試頁面
 * @param tour 導覽定義
 * @param step 要驗證的步驟
 */
async function assertAnchor(page: Page, tour: TourFile, step: TourStep) {
  // anchor 為 null 代表這一步刻意不指向元素，泡泡置中顯示
  if (step.anchor === null) return

  const label = `[${tour.id}]「${step.title}」`
  const anchor = page.locator(`[data-tour="${step.anchor}"]`)

  await expect(
    anchor,
    `${label}找不到錨點 data-tour="${step.anchor}"。該元素可能已被移除或改名。\n` +
      `請把 data-tour 加回原本的元素，或同步修改 src/tours/${tour.fileName} 的這一步。`,
  ).toHaveClass(/driver-active-element/)

  // 錨點存在、也被高亮了，仍可能整個在畫面外——那時使用者只會看到遮罩框住空白處。
  // 導覽負責把目標捲進視野，這一條就是在守那件事。
  await expect(
    anchor,
    `${label}的錨點不在可視範圍內。導覽應該先把它捲進畫面再顯示說明，` +
      `否則使用者會看到遮罩框在空白處。`,
  ).toBeInViewport()
}

/**
 * 確認被略過的步驟都是 optional 的
 *
 * 非 optional 的步驟被略過代表導覽中途斷了，那是真的壞掉，不能當成正常。
 * @param tour 導覽定義
 * @param shownTitles 實際顯示過的步驟標題
 */
function assertNoRequiredStepSkipped(tour: TourFile, shownTitles: string[]) {
  const skipped = tour.steps.filter((step) => !step.optional && !shownTitles.includes(step.title))

  expect(
    skipped.map((step) => step.title),
    `導覽「${tour.name}」有必要步驟沒有被顯示出來，代表導覽中途就結束了`,
  ).toStrictEqual([])
}

/**
 * 讀出泡泡目前的標題
 * @param popover 泡泡的 Locator
 * @returns 標題文字
 */
async function titleOf(popover: Locator): Promise<string> {
  return (await popover.locator('.driver-popover-title').innerText()).trim()
}

/**
 * 讀取所有導覽定義檔
 * @returns 導覽定義，依檔名排序
 */
function loadTours(): TourFile[] {
  return readdirSync(TOURS_DIR)
    .filter((fileName) => fileName.endsWith('.json'))
    .sort()
    .map((fileName) => {
      const fullPath = join(TOURS_DIR, fileName)

      try {
        const raw = JSON.parse(readFileSync(fullPath, 'utf8')) as TourFile
        return { ...raw, fileName }
      } catch (error) {
        throw new Error(
          `導覽定義 src/tours/${fileName} 不是合法的 JSON：${(error as Error).message}`,
        )
      }
    })
}
