# real-estate-valuation

2026 新北市 AI 智慧城市黑客松「AI 輔助不動產估價案件審查」（地政局命題）的**前端**。

## 這個系統在做什麼

政府徵收土地要發補償金，金額由估價師依《土地徵收補償市價查估辦法》計算，填在三張
官方書表上（表1 地價區段勘查表、表5-2 影響地價區域因素分析明細表、表4 比較法調查
估價表）。這些表會填錯，而且錯一格會沿計算鏈影響到最終補償金。過去複查得由人拿著
捲尺與法規手冊逐格核對。

**這個系統做那件核對的事**：上傳估價師填好的書表 PDF，系統依官方評價基準自己重算一遍，
三層逐格比對，指出不符之處，每個結論都附法源與金額衝擊。

> 核心設計主張：**每一個數字都指得回官方文件的具體位置，沒有任何一個是模型生成的。**
> 因為徵收補償金會被提起訴願，數字必須能舉證。

## 兩個 repo

前後端分離，各自獨立部署（前端 Amplify Hosting、後端 Elastic Beanstalk／EC2），
溝通只透過 HTTP。

| repo | 內容 |
|---|---|
| **`real-estate-valuation`**（本專案） | Vue 3 + TypeScript 前端 |
| [`real-estate-valuation-py`](https://github.com/MoreFoodQ/real-estate-valuation-py) | FastAPI 後端、規則引擎、PDF 辨識、產表，以及**完整專案文件** |

📖 **專案的權威決策紀錄、競賽規範整理、穩健性稽核報告都在後端 repo 的 `docs/`。**
架構層級的問題請先查那裡。

## 前端在整條鏈裡的位置

```
使用者拖入 PDF
  └─ HomeView.onPick / onDrop
      └─ store.analyze(file)                    src/stores/case.ts
          ├─ POST /api/parse    → 辨識三張表
          ├─ POST /api/compute  → 重算 + 依據鏈
          └─ POST /api/review   → 三層逐格比對
          畫面 v-if="parsed" 成立，三張表與審查結果才渲染
```

**前端不做任何估價計算**，只負責顯示與互動。所有數字由後端的規則引擎產生。

啟動時不打任何 API（`src/` 裡沒有 `onMounted`），所以後端關著畫面照樣出來，
只是一上傳就會失敗。這對 debug 很有用：畫面沒出來是前端問題，
畫面出來但上傳失敗才需要看後端。

後端需另外啟動，預設 `http://localhost:8000`，位置設定在 `.env.development`。

## 系統導覽

畫面右下角的浮動按鈕列出所有導覽。導覽**不會自動跳出來**打斷操作，需要時自己點開，
清單會標示哪幾份還沒看過（記在 `localStorage` 的 `seenTours`）。

導覽內容是**資料不是程式碼**：在 `src/tours/` 新增一份 JSON 就會被自動收錄，
不必改任何 `.ts` 或 `.vue`。

```
src/tours/*.json      導覽定義。一份一個檔，order 決定在選單上的順序
src/tours/index.ts    載入與執行期驗證。格式錯了開發環境直接拋錯，正式環境略過該份
src/types/tour.ts     定義檔的欄位與各欄的意思
src/stores/tour.ts    播放狀態。用 driver.js 播，跨模式／分頁時會先切畫面再等錨點出現
src/components/TourLauncher.vue   右下角的入口
```

每個步驟用 `anchor` 指向畫面上的 `data-tour="..."`，並可用 `mode`／`tab`
指定這一步要停在哪個模式、哪張表——導覽會先把畫面切過去，等錨點出現再顯示說明。

幾個容易踩到的欄位：

- `requiresData`：這份導覽需要先上傳哪一種檔案。沒有資料時畫面上根本沒有那些區塊，
  所以清單上會停用並寫明缺什麼，而不是讓人點了才卡住。
- `optional`：這一步指向的區塊可能不存在（例如沒有不符之處就沒有「審查發現」區）。
  設 `true` 時找不到錨點就整步略過，而不是顯示一個指著空白的泡泡。

**錨點改名或誤刪會被測試擋下來**——這正是導覽最容易壞掉又最不容易被發現的地方
（找不到錨點時只會默默退化成置中泡泡，不會報錯）：

```sh
npx vitest run src/__tests__/tours.spec.ts   # 掃原始碼確認每個錨點都還宣告著
npm run test:e2e:tour                        # 把導覽真的走一遍（見下方 e2e 說明）
```

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

## Recommended Browser Setup

- Chromium-based browsers (Chrome, Edge, Brave, etc.):
  - [Vue.js devtools](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd)
  - [Turn on Custom Object Formatter in Chrome DevTools](http://bit.ly/object-formatters)
- Firefox:
  - [Vue.js devtools](https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/)
  - [Turn on Custom Object Formatter in Firefox DevTools](https://fxdx.dev/firefox-devtools-custom-object-formatters/)

## Type Support for `.vue` Imports in TS

TypeScript cannot handle type information for `.vue` imports by default, so we replace the `tsc` CLI with `vue-tsc` for type checking. In editors, we need [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) to make the TypeScript language service aware of `.vue` types.

## Customize configuration

See [Vite Configuration Reference](https://vite.dev/config/).

## Project Setup

本機已準備 Node.js 22.18.0，放在專案的 `.tools/`（不納入版控）。每次開新終端機先加入 PATH：

```sh
export PATH="$PWD/.tools/bin:$PATH"
node --version
npm --version
```

```sh
npm ci
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Type-Check, Compile and Minify for Production

```sh
npm run build
```

### Run Unit Tests with [Vitest](https://vitest.dev/)

```sh
npm run test:unit
```

### Run End-to-End Tests with [Playwright](https://playwright.dev)

```sh
# Install browsers for the first run
npx playwright install

# When testing on CI, must build the project first
npm run build

# Runs the end-to-end tests
npm run test:e2e
# Runs the tests only on Chromium
npm run test:e2e -- --project=chromium
# Runs the tests of a specific file
npm run test:e2e -- tests/example.spec.ts
# Runs the tests in debug mode
npm run test:e2e -- --debug
```

`e2e/vue.spec.ts` 只驗空狀態與模式切換，不需要後端。

`e2e/tour.spec.ts` 掃過 `src/tours/` 的每一份定義，從右下角的導覽按鈕啟動、
一步步按下去，確認每個 `data-tour` 錨點都在畫面上、被高亮、而且在可視範圍內。
不需要資料的導覽（新手上路）隨時都跑；需要先上傳檔案的那兩份沿用下面
`integration.spec.ts` 的前置條件，缺了就整支跳過。審查模式的那份還需要一份
填好的查估書表 PDF，repo 裡目前沒有，所以恆跳過——有了 fixture 之後補進
`prepareData()` 即可，其餘邏輯是共用的。

```sh
npm run test:e2e:tour
```

`e2e/integration.spec.ts` 走完整條鏈（上傳勘查表 → 後端算 → 畫面出數字與依據），
需要兩個前置條件，缺任一個就整支跳過而不是紅掉：

1. 後端在 `VITE_API_URL`（預設 `http://localhost:8000`）跑著。
   起法見 `../real-estate-valuation-py/README.md`，要帶 `VALUATION_DOC_DIR`
   與 `VALUATION_TEMPLATE_DIR` 兩個環境變數。
2. 一份填好的表3 勘查表 xlsx。預設找
   `../real-estate-valuation-py/tmp/表3-填好.xlsx`，可用 `SURVEY_XLSX` 指定別的路徑。
   產一份的方法：

```sh
cd ../real-estate-valuation-py
.venv/bin/python -m xlsxform.cli --templates ../正式題目 --out tmp
cp tmp/表3地價區段勘查表-filled.xlsx tmp/表3-填好.xlsx
```

它斷言的是已驗證過的數字（比準地比較價格 176,921、地價 177,000、
總修正數 +23.50%／+14.75%／+14.75%）。這些值在個別因素以 0 計的前提下成立，
局處把個別因素填進表4 之後會變，屆時要一起更新斷言。

### Lint with [ESLint](https://eslint.org/)

```sh
npm run lint
```
