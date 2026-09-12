import { test, expect } from '@playwright/test'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * 產 Demo 用的畫面截圖。不是驗證測試，是給錄影片與說明文件用的素材。
 *
 *     npx playwright test e2e/screenshot.spec.ts --project=chromium
 *
 * 需要後端在 :8000 跑著。截圖存到 /tmp/shots/。
 */

const HERE = dirname(fileURLToPath(import.meta.url))
const SAMPLE =
  process.env.SURVEY_XLSX ?? resolve(HERE, '../../交付/表3地價區段勘查表-filled.xlsx')
const OUT = '/tmp/shots'

test('產出模式的畫面截圖', async ({ page }) => {
  test.skip(!existsSync(SAMPLE), `找不到 ${SAMPLE}`)

  await page.setViewportSize({ width: 1280, height: 1600 })
  await page.goto('/')

  await page.screenshot({ path: `${OUT}/1-空狀態.png`, fullPage: true })

  await page.locator('input[type="file"]').setInputFiles(SAMPLE)
  await expect(page.getByText('自我驗證通過')).toBeVisible({ timeout: 30_000 })

  // 上半部：驗證、前提、格數、表4 的結果
  await page.screenshot({ path: `${OUT}/2-結果上半.png`, fullPage: false })

  // 依據鏈那一區
  await page.locator('.evidence').scrollIntoViewIfNeeded()
  await page.screenshot({ path: `${OUT}/3-依據鏈.png`, fullPage: false })

  // 點開一列看判級依據
  const row = page.locator('.evidence tr.row').first()
  await row.click()
  await expect(page.locator('.evidence tr.detail').first()).toContainText('比準地判級依據')
  await page.locator('.evidence tr.detail').first().scrollIntoViewIfNeeded()
  await page.screenshot({ path: `${OUT}/4-展開依據.png`, fullPage: false })

  // 可交件的檔案清單
  await page.getByText('可交件的檔案').scrollIntoViewIfNeeded()
  await page.screenshot({ path: `${OUT}/5-檔案清單.png`, fullPage: false })
})
