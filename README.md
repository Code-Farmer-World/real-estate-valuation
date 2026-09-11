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

```sh
npm install
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

### Lint with [ESLint](https://eslint.org/)

```sh
npm run lint
```
