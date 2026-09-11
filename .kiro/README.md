# .kiro（前端）

Kiro 在這個專案的使用紀錄。依 2026 新北市 AI 智慧城市黑客松競賽規範，
本資料夾必須存在於專案根目錄，且不得加入 `.gitignore`。

```
.kiro/
├── steering/     專案背景知識，每次對話自動載入
└── specs/        功能開發紀錄（需求 → 設計 → 任務）
```

## 這是前後端分離的其中一半

| repo | 內容 |
| --- | --- |
| **`real-estate-valuation`**（本 repo） | Vue 3 + TypeScript 前端 |
| `real-estate-valuation-py` | FastAPI 後端、規則引擎、PDF 辨識、產表、**完整專案文件** |

兩者各自獨立部署：前端走 Amplify Hosting，後端走 Elastic Beanstalk／EC2。
溝通只透過 HTTP，前端唯一知道後端的方式是 `.env.development` 的 `VITE_API_URL`。

**專案的權威決策紀錄、競賽規範整理、穩健性稽核報告都在後端 repo 的 `docs/`。**
架構層級的決定請先查那裡，不要在這邊重新推導。

## steering/

| 檔案 | 內容 |
| --- | --- |
| `product.md` | 這個系統在解什麼問題（土地徵收查估書表的三層審查） |
| `frontend.md` | 前端技術棧、啟動指令、環境陷阱、資料流 |

⚠️ 最重要的環境陷阱：**`node` 與 `npm` 不在系統 PATH 上**，
可攜式 Node 在 `.tools/`，每次開新終端機都要先設 PATH。詳見 `frontend.md`。

## specs/

目前是空的。既有程式是在導入 Kiro 之前完成的，替寫好的程式倒推 spec 沒有意義。
後續功能開發會實際走 spec 流程，紀錄會出現在這裡。

候選題目：

- **接上 `/api/rulesets`**：後端端點已可用，`valuationService.ts` 也已定義
  `listRulesets()`，但前端沒有任何地方呼叫它。接起來可在畫面上抽換不同行政區
  的評價基準
- **PDF 證據疊圖**：`provenance` 已提供每個欄位的頁碼與 bbox（共 305 個），
  在畫面上渲染原始 PDF 並框出來源格子
