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
</style>
