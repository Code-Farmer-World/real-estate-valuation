import { test, expect } from '@playwright/test'

// Playwright 說明文件：https://playwright.dev/docs/intro
// dev server 由 playwright.config.ts 的 webServer 自動啟動。
//
// 這支測試只驗空狀態與模式切換，不打後端。要驗完整的一條鏈
// （上傳勘查表 → 算出表5-1 與表4 → 下載書表）得先起後端，
// 那屬於整合測試，起法見 ../real-estate-valuation-py/README.md。

test('首頁預設進產出模式，顯示標題與上傳區', async ({ page }) => {
  await page.goto('/')

  await expect(page.locator('h1')).toHaveText('不動產估價查估書表')

  // 預設是產出模式，那是正式題目要的方向：從勘查表算出該填什麼。
  await expect(page.getByRole('tab', { name: /產出模式/ })).toHaveAttribute(
    'aria-selected',
    'true',
  )

  // 尚未上傳時，結果區都被 v-if 關掉，畫面只有上傳提示。
  await expect(page.getByText('把填好的表3 xlsx 拖進來')).toBeVisible()
})

test('切到審查模式換成 PDF 上傳區', async ({ page }) => {
  await page.goto('/')

  await page.getByRole('tab', { name: /審查模式/ }).click()

  await expect(page.getByText('把查估書表 PDF 拖進來')).toBeVisible()
  await expect(page.getByText('把填好的表3 xlsx 拖進來')).toBeHidden()
})
