import { test, expect } from '@playwright/test'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * 整條鏈在畫面上跑一次：上傳填好的表3 勘查表 → 後端算 → 畫面出數字與依據。
 *
 * 這支需要後端在 VITE_API_URL（預設 http://localhost:8000）跑著，
 * 起法見 ../real-estate-valuation-py/README.md，要帶
 * VALUATION_DOC_DIR 與 VALUATION_TEMPLATE_DIR 兩個環境變數。
 * 後端沒起或找不到測試用的 xlsx 就整支跳過，不讓 CI 因環境紅掉。
 */

const API = process.env.VITE_API_URL ?? 'http://localhost:8000'

/** 這個檔案是 ES module，沒有 __dirname，要自己從 import.meta.url 換算 */
const HERE = dirname(fileURLToPath(import.meta.url))

/** 產出模式的輸入檔。用 CLI 產一份即可：見後端 README 的 xlsxform.cli */
const SAMPLE =
  process.env.SURVEY_XLSX ?? resolve(HERE, '../../real-estate-valuation-py/tmp/表3-填好.xlsx')

/** 已驗證的期望值。個別因素以 0 計，前提寫在表4 全案備註 */
const EXPECTED = {
  benchmarkComparisonPrice: '176,921',
  benchmarkLandPrice: '177,000',
  totals: ['23.50', '14.75'],
}

test.describe('產出模式整條鏈', () => {
  test.beforeAll(async () => {
    let alive = false
    try {
      const res = await fetch(`${API}/api/health`)
      alive = res.ok
    } catch {
      alive = false
    }
    test.skip(!alive, `後端沒在 ${API} 跑，跳過整合測試`)
    test.skip(!existsSync(SAMPLE), `找不到測試用勘查表 ${SAMPLE}，跳過整合測試`)
  })

  test('上傳勘查表後畫面出現驗證結果、總修正數與比準地地價', async ({ page }) => {
    await page.goto('/')

    await page.locator('input[type="file"]').setInputFiles(SAMPLE)

    // 自我驗證放在結果區最前面，因為它決定下面的數字能不能信
    await expect(page.getByText('自我驗證通過')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText('10 / 10 項')).toBeVisible()

    const body = page.locator('body')
    for (const t of EXPECTED.totals) {
      await expect(body).toContainText(t)
    }
    await expect(body).toContainText(EXPECTED.benchmarkComparisonPrice)
    await expect(body).toContainText(EXPECTED.benchmarkLandPrice)

    // 個別因素為 0 的前提必須看得到，否則試算價格會被當成完整答案
    await expect(body).toContainText('個別因素')
  })

  test('可以點開任一列看計算依據', async ({ page }) => {
    await page.goto('/')
    await page.locator('input[type="file"]').setInputFiles(SAMPLE)
    await expect(page.getByText('自我驗證通過')).toBeVisible({ timeout: 30_000 })

    // 依據鏈的每一列都可展開看判級理由。表4 那張摘要表的列不可展開，
    // 所以要限定在 .evidence 區塊裡的 .row。
    const firstRow = page.locator('.evidence tr.row').first()
    await expect(firstRow).toHaveAttribute('aria-expanded', 'false')

    await firstRow.click()

    await expect(firstRow).toHaveAttribute('aria-expanded', 'true')
    const detail = page.locator('.evidence tr.detail').first()
    await expect(detail).toContainText('比準地判級依據')
    await expect(detail).toContainText('矩陣查表')

    // 再點一次收起來
    await firstRow.click()
    await expect(page.locator('.evidence tr.detail')).toHaveCount(0)
  })
})
