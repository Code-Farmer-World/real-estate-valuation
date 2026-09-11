import { test, expect } from '@playwright/test'

// Playwright 說明文件：https://playwright.dev/docs/intro
// dev server 由 playwright.config.ts 的 webServer 自動啟動。

test('首頁顯示標題與上傳區', async ({ page }) => {
  await page.goto('/')

  // 標題來自 src/views/HomeView.vue 的 <h1>
  await expect(page.locator('h1')).toHaveText('不動產估價案件審查')

  // 尚未上傳任何 PDF 時，畫面只有上傳提示。
  // 三張表與審查結果都被 HomeView 的 v-if="parsed" 關掉，
  // 所以這裡是「空狀態」的驗證。
  await expect(page.getByText('把查估書表 PDF 拖進來')).toBeVisible()
})
