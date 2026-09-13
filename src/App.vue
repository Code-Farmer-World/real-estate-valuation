<script setup lang="ts">
import { RouterView } from 'vue-router'
</script>

<template>
  <RouterView />
</template>

<style>
/* 設計權杖。刻意只用一組淺色，比賽現場投影多半偏亮，暗色反而看不清。 */
:root {
  --bg: #f7f7f5;
  --surface: #ffffff;
  --surface-2: #f2f2ef;
  --text: #1c1c1a;
  --muted: #6b6b66;
  --line: #e4e4df;
  --line-strong: #cfcfc8;
  --hover: #faf9f7;
  --chip: #eceae5;
  --accent: #9a5b2c;
  --ok: #2f6b45;
  --ok-bg: #eaf3ed;
  --bad: #a33b32;
  --bad-bg: #fbeeec;
  --warn: #8a6a1f;
  --warn-bg: #f7f1de;
  --mono: ui-monospace, 'SFMono-Regular', 'Cascadia Mono', Menlo, Consolas, monospace;
}

body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: 'Noto Sans TC', 'PingFang TC', 'Microsoft JhengHei', system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
}

* {
  box-sizing: border-box;
}

/* driver.js 導覽泡泡。掛在 body 底下，元件的 scoped 樣式管不到，
   所以覆寫放在設計權杖旁邊——泡泡要跟畫面同一套顏色，不是套件預設的藍。 */
.driver-popover {
  max-width: 24rem;
  border-radius: 10px;
  background: var(--surface);
  color: var(--text);
  font-family: inherit;
  box-shadow: 0 8px 30px rgb(0 0 0 / 18%);
}

.driver-popover-arrow {
  /* 箭頭用 border 畫，四個方向各自吃一邊的顏色，一起指定才不會有一面是預設白 */
  border-color: var(--surface);
}

.driver-popover-title {
  font-size: 0.95rem;
  font-weight: 600;
  line-height: 1.6;
}

.driver-popover-description {
  /* 說明寫的是「為什麼」，多半有好幾句，行高要夠鬆才讀得下去 */
  font-size: 0.83rem;
  line-height: 1.9;
  color: var(--muted);
}

.driver-popover-progress-text {
  font-size: 0.72rem;
  color: var(--muted);
}

.driver-popover-navigation-btns button {
  padding: 0.3rem 0.8rem;
  border: 1px solid var(--line-strong);
  border-radius: 6px;
  background: var(--surface-2);
  color: var(--text);
  font-family: inherit;
  font-size: 0.8rem;
  text-shadow: none;
}

/* 下一步是主要動作，用重點色；上一步維持次要 */
.driver-popover-navigation-btns button.driver-popover-next-btn {
  border-color: var(--accent);
  background: var(--accent);
  color: #fff;
  font-weight: 600;
}

.driver-popover-close-btn {
  color: var(--muted);
}
</style>
