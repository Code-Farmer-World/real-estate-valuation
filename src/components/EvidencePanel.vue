<script setup lang="ts">
/**
 * 依據面板：點一格，看它是怎麼來的。
 *
 * 這是整個系統對評審的核心論述——「每個結論都能指回評分表的哪一列、
 * 法規手冊的哪一條，我們沒讓 AI 生成任何一個數字」——的畫面呈現。
 * 所以這裡只顯示後端算好的依據鏈與來源，**不做任何運算與推論**。
 */
import type { Correction, FieldSource } from '@/types/case'

defineProps<{
  title: string
  correction: Correction | null
  source: FieldSource | null
}>()
</script>

<template>
  <aside class="evidence">
    <h3>依據</h3>

    <p v-if="!correction && !source" class="hint">
      點左邊任一列，看這個數字是怎麼來的。
    </p>

    <template v-else>
      <div class="head">{{ title }}</div>

      <template v-if="correction">
        <div class="rate" :class="{ zero: correction.correction_pct === 0 }">
          {{ correction.correction_pct > 0 ? '+' : '' }}{{ correction.correction_pct }}%
        </div>

        <ol class="chain">
          <li>
            <span class="who">比準地</span>
            <span class="val">{{ correction.benchmark.value }}</span>
            <span class="grade">{{ correction.benchmark.grade }} {{ correction.benchmark.label }}</span>
            <p class="reason">{{ correction.benchmark.reason }}</p>
          </li>
          <li>
            <span class="who">比較標的</span>
            <span class="val">{{ correction.comparable.value }}</span>
            <span class="grade">{{ correction.comparable.grade }} {{ correction.comparable.label }}</span>
            <p class="reason">{{ correction.comparable.reason }}</p>
          </li>
          <li>
            <span class="who">查表</span>
            <p class="reason">{{ correction.basis }}</p>
          </li>
        </ol>

        <p v-if="correction.source_page" class="src">
          出處：評價基準明細表範例.pdf 第 {{ correction.source_page }} 頁
        </p>
      </template>

      <div v-if="source" class="prov">
        <div class="prov-title">辨識來源</div>
        <p class="raw">{{ source.raw_text }}</p>
        <p class="meta">
          查估書表 PDF 第 {{ source.page }} 頁
          <span v-if="source.bbox">· 座標 {{ source.bbox.map((n) => Math.round(n)).join(', ') }}</span>
          <span class="backend" :class="source.backend">{{
            source.backend === 'text_layer' ? '文字層' : source.backend
          }}</span>
        </p>
      </div>
    </template>
  </aside>
</template>

<style scoped>
.evidence {
  position: sticky;
  top: 1rem;
  padding: 1rem 1.1rem;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface);
}
h3 {
  margin: 0 0 0.75rem;
  font-size: 0.95rem;
  letter-spacing: 0.05em;
  color: var(--muted);
}
.hint {
  margin: 0;
  color: var(--muted);
  font-size: 0.875rem;
  line-height: 1.7;
}
.head {
  font-weight: 600;
  margin-bottom: 0.35rem;
}
.rate {
  font-family: var(--mono);
  font-size: 1.75rem;
  font-weight: 600;
  color: var(--accent);
  margin-bottom: 0.75rem;
}
.rate.zero {
  color: var(--muted);
}
.chain {
  margin: 0;
  padding-left: 1.1rem;
  display: grid;
  gap: 0.7rem;
}
.chain li {
  font-size: 0.85rem;
}
.who {
  color: var(--muted);
  margin-right: 0.4rem;
}
.val {
  font-family: var(--mono);
  font-weight: 600;
}
.grade {
  margin-left: 0.4rem;
  padding: 0.05rem 0.4rem;
  border-radius: 4px;
  background: var(--chip);
  font-size: 0.78rem;
}
.reason {
  margin: 0.3rem 0 0;
  color: var(--muted);
  line-height: 1.6;
}
.src {
  margin: 0.9rem 0 0;
  font-size: 0.8rem;
  color: var(--muted);
}
.prov {
  margin-top: 1rem;
  padding-top: 0.9rem;
  border-top: 1px dashed var(--line);
}
.prov-title {
  font-size: 0.8rem;
  color: var(--muted);
  margin-bottom: 0.4rem;
}
.raw {
  margin: 0;
  font-family: var(--mono);
  font-size: 0.85rem;
  word-break: break-all;
}
.meta {
  margin: 0.4rem 0 0;
  font-size: 0.75rem;
  color: var(--muted);
}
.backend {
  margin-left: 0.4rem;
  padding: 0.05rem 0.4rem;
  border-radius: 4px;
  background: var(--ok-bg);
  color: var(--ok);
}
</style>
