<script setup lang="ts">
/**
 * 表4 比較法調查估價表：19 個個別因素與價格鏈。
 *
 * 「估價師填的」與「引擎重算的」兩欄並排是刻意的——審查要看的就是這兩欄
 * 有沒有一致。相同就淡淡地放著，不同就標紅，讓眼睛只需要停在紅的地方。
 */
import type { Correction, Table4, Table4Comparable } from '@/types/case'

const props = defineProps<{
  table: Table4
  comparable: Table4Comparable
  corrections: Record<string, Correction>
  selected: string | null
}>()

defineEmits<{ select: [factorId: string] }>()

/** 19 個 factor_id，順序照表4 的列序（辨識器維持了書表順序） */
const factorIds = Object.keys(props.table.benchmark.facts)

function show(side: Table4Comparable | Table4['benchmark'], factorId: string) {
  return side.fact_labels[factorId] ?? side.facts[factorId] ?? '—'
}
</script>

<template>
  <div class="wrap">
    <div class="meta">
      <span><b>比準地</b> {{ table.benchmark.parcel }}</span>
      <span><b>比較標的{{ comparable.index }}</b> {{ comparable.parcel }}</span>
      <span><b>交易日期</b> {{ comparable.transaction_date }}</span>
      <span><b>正常單價</b> {{ comparable.normal_unit_price?.toLocaleString() }}</span>
    </div>

    <table>
      <thead>
        <tr>
          <th class="name">細項</th>
          <th>比準地</th>
          <th>比較標的{{ comparable.index }}</th>
          <th class="num">表上填的</th>
          <th class="num">引擎重算</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="fid in factorIds"
          :key="fid"
          :class="{
            active: selected === fid,
            nonzero: (corrections[fid]?.correction_pct ?? 0) !== 0,
            diff:
              corrections[fid] &&
              corrections[fid].correction_pct !== comparable.filed_corrections[fid],
          }"
          @click="$emit('select', fid)"
        >
          <td class="name">{{ table.factor_labels[fid] ?? fid }}</td>
          <td>{{ show(table.benchmark, fid) }}</td>
          <td>{{ show(comparable, fid) }}</td>
          <td class="num">{{ comparable.filed_corrections[fid]?.toFixed(2) ?? '—' }}%</td>
          <td class="num engine">
            {{ corrections[fid] ? corrections[fid].correction_pct.toFixed(2) + '%' : '—' }}
          </td>
        </tr>
      </tbody>
      <tfoot>
        <tr>
          <td class="name">合計</td>
          <td colspan="2"></td>
          <td class="num">{{ comparable.individual_total_pct?.toFixed(2) }}%</td>
          <td class="num engine">
            {{
              Object.values(corrections)
                .reduce((s, c) => s + c.correction_pct, 0)
                .toFixed(2)
            }}%
          </td>
        </tr>
      </tfoot>
    </table>

    <div class="chain">
      <div class="formula">
        <span class="mono">{{ comparable.normal_unit_price?.toLocaleString() }}</span>
        <span class="op">×</span>
        <span class="mono">(1 + {{ comparable.date_adjustment_pct }}%)</span>
        <span class="lab">交易日期</span>
        <span class="op">×</span>
        <span class="mono">(1 + {{ comparable.regional_adjustment_pct }}%)</span>
        <span class="lab">區域因素</span>
        <span class="op">×</span>
        <span class="mono">(1 + {{ comparable.individual_total_pct }}%)</span>
        <span class="lab">個別因素</span>
      </div>
      <p class="note">
        表上的「調整至估價基準日單價
        {{ comparable.date_adjusted_unit_price_displayed?.toLocaleString() }}」是<b>顯示欄位</b>，
        不參與計算——拿它續算會差 1 元。引擎全程保留精度，只在最後取整。
      </p>
    </div>
  </div>
</template>

<style scoped>
.wrap {
  display: grid;
  gap: 1rem;
}
.meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 1.4rem;
  font-size: 0.82rem;
  color: var(--muted);
}
.meta b {
  color: var(--text);
  font-weight: 600;
  margin-right: 0.3rem;
}
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}
th,
td {
  padding: 0.4rem 0.55rem;
  text-align: left;
  border-bottom: 1px solid var(--line);
}
th {
  font-weight: 600;
  color: var(--muted);
  font-size: 0.78rem;
  white-space: nowrap;
}
.name {
  width: 30%;
}
.num {
  text-align: right;
  font-family: var(--mono);
  white-space: nowrap;
}
.engine {
  color: var(--muted);
}
tbody tr {
  cursor: pointer;
}
tbody tr:hover {
  background: var(--hover);
}
tbody tr.nonzero .num {
  color: var(--accent);
  font-weight: 600;
}
tbody tr.active {
  background: var(--chip);
}
tbody tr.diff {
  background: var(--bad-bg);
}
tbody tr.diff .engine {
  color: var(--bad);
  font-weight: 600;
}
tfoot td {
  padding-top: 0.6rem;
  font-weight: 600;
  border-bottom: none;
}
.chain {
  padding: 0.85rem 1rem;
  background: var(--surface-2);
  border-radius: 8px;
}
.formula {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.35rem;
  font-size: 0.85rem;
}
.mono {
  font-family: var(--mono);
}
.op {
  color: var(--muted);
}
.lab {
  font-size: 0.7rem;
  color: var(--muted);
  margin-right: 0.5rem;
}
.note {
  margin: 0.6rem 0 0;
  font-size: 0.78rem;
  color: var(--muted);
  line-height: 1.7;
}
.note b {
  color: var(--text);
}
</style>
