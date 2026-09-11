# 前端技術棧與啟動方式

Vue 3.5 + TypeScript 6 + Vite 8，Pinia 4 管狀態，vue-router 5 做路由，
axios 打 API。測試用 Vitest 5 與 Playwright。Lint 用 oxlint + eslint，
格式用 oxfmt。

## ⚠️ node 與 npm 不在系統 PATH 上

沒有 nvm、沒有 homebrew node。可攜式 Node.js（v22.18.0）放在專案內的
`.tools/`，**每次開新終端機都必須先設 PATH**，否則 `npm` 會因為 shebang
找不到 node 而失敗：

```bash
export PATH="$PWD/.tools/bin:$PATH"
```

`package.json` 的 `engines` 要求 `^22.18.0 || >=24.12.0`，`.tools` 內的版本符合。

## 指令

```bash
npm run dev          # 開發伺服器 :5173（長時間執行，需獨立終端機）
npm run build        # type-check + 建置
npm run type-check   # vue-tsc --build
npx vitest run       # 單次執行單元測試
npm run lint         # oxlint + eslint，會自動修
npm run format       # oxfmt src/
```

## 已知環境問題

- **Playwright 瀏覽器未安裝。** 要跑 e2e 需先 `npx playwright install chromium`
  （下載約 150MB+）。`playwright.config.ts` 會自動啟動 dev server。
- **`npm run type-check` 檢查不到 `e2e/`。** `tsconfig.json` 的 references 只
  包含 node / app / vitest 三個。要檢查 e2e 得另外指定：
  `npx tsc --noEmit -p e2e/tsconfig.json`

## 後端在哪

後端是獨立的 repo（`real-estate-valuation-py`），獨立執行、獨立部署。

```
前端  Vite dev server  :5173
後端  uvicorn          :8000
```

前端唯一知道後端的方式是 `.env.development` 的 `VITE_API_URL`。
**啟動時不打任何 API**——`src/` 裡沒有任何 `onMounted`，所以後端關著畫面
照樣正常出來，只是一上傳檔案就會失敗。這對 debug 很有用：畫面沒出來就是
前端問題，畫面出來但上傳失敗才需要看後端。

## 結構

```
src/
├── main.ts              入口：createApp → use(pinia) → use(router) → mount
├── App.vue              只有 <RouterView />，但全域 CSS 變數定義在這裡
├── router/index.ts      只有一個路由：'/' → HomeView
├── views/HomeView.vue   唯一的頁面
├── components/
│   ├── Table1Panel.vue      地價區段勘查表
│   ├── Table52Panel.vue     區域因素分析明細表
│   ├── Table4Panel.vue      比較法調查估價表，可點格子
│   └── EvidencePanel.vue    依據面板，顯示後端算好的依據鏈
├── stores/case.ts       Pinia store：一次上傳串三支 API
├── services/
│   ├── axiosService.ts      通用層：baseURL、攔截器、{data,error} 信封解析
│   └── valuationService.ts  端點與型別
├── types/case.ts        後端回傳資料的型別
└── composables/useLogger.ts
```

### 幾個關鍵事實

- **整個系統只有一個路由。** 網址永遠是 `/`。
- **首屏九成內容被 `v-if="parsed"` 關掉。** `parsed` 初始值是 `null`，
  那一大段 template 不是隱藏，是根本沒有建立 DOM。
- **全域配色在 `App.vue` 的非 scoped `<style>`。** `--accent`、`--ok`、`--bad`
  等 CSS 變數都在那裡，改視覺風格從那 20 行下手，不用動每個元件。
- `EvidencePanel.vue` **刻意不做任何運算**，只顯示後端算好的依據鏈。

## 資料流

```
使用者拖入 PDF
  └─ HomeView.onPick / onDrop
      └─ store.analyze(file)                    stores/case.ts
          ├─ parseForms(file)   POST /api/parse    → parsed
          ├─ compute(tables)    POST /api/compute  → computed
          └─ review(tables)     POST /api/review   → reviewed
              ↓ 三者共用同一份 tables，所以在 store 串起來，畫面只等一個 loading
          畫面 v-if="parsed" 成立，三張表與審查結果才渲染
```

產表是**分開觸發**的（`store.makeForms()`），因為要花幾秒。書表必須從同一份
原始檔產生，所以 store 留了 `sourceFile`。

## 改完要跑什麼

| 改動範圍 | 至少要跑 |
| --- | --- |
| `src/` | `npm run type-check` + `npx vitest run` |
| `e2e/` | `npx tsc --noEmit -p e2e/tsconfig.json` |

## 紅線

- **不要在前端做任何估價計算。** 所有數字由後端的規則引擎產生，前端只顯示。
  這是整個專案可信度的基礎——每個數字都要能指回官方文件。
- **不要讓 AI 生成任何數字。** 同上。
- 顯示後端的 `warnings`、`not_checkable`、`sanity` 時不要過濾或美化。
  「查不到什麼」與「哪個值可疑」必須讓審查員看到。
