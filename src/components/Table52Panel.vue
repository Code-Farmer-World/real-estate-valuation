<script setup lang="ts">
/**
 * 表5-2 影響地價區域因素分析明細表：28 個細項、8 個群組小計、1 個總修正數。
 *
 * 範本裡全部是 0.00%，因為比準地與比較標的同屬 P002-00 區段——環境一模一樣，
 * 當然不用調。畫面直接把這件事寫出來，免得看的人以為系統沒算。
 */
import type { Table1, Table52 } from '@/types/case'

const props = defineProps<{
  table: Table52
  /** 表1 的等級，用來標出兩表不一致的細項（審查重點第 vi 項） */
  table1: Table1 | null
}>()

const comparable = props.table.comparables[0] ?? null

function table1Grade(factorId: string) {
  return props.table1?.grades[factorId]?.grade ?? null
}

function mismatched(factorId: string) {
  const source = table1Grade(factorId)
  if (source === null) return false
  return source !== props.table.benchmark_grades[factorId]?.grade
}
</script>

<template>
  <div class="wrap">
    <div class="meta">
      <span><b>用地別</b> {{ table.land_use }}</span>
      <span><b>比準地區段</b> {{ table.benchmark_segment }}</span>
      <span v-if="comparable"><b>比較標的區段</b> {{ comparable.segment }}</span>
    </div>

    <p v-if="comparable && comparable.segment === table.benchmark_segment" class="same">
      兩者同屬 <b>{{ table.benchmark_segment }}</b> 區段，環境條件相同，
      所以 28 個細項的等級兩兩相同、修正百分比全為 0.00%。
    </p>

    <table>
      <thead>
        <tr>
          <th class="name">修正細項</th>
          <th class="ctr">表1</th>
          <th class="ctr">比準地</th>
          <th class="ctr">比較標的</th>
          <th class="num">修正%</th>
        </tr>
      </thead>
      <tbody v-for="group in table.groups" :key="group.label">
        <tr class="group">
          <td colspan="5">{{ group.label }}</td>
        </tr>
        <tr v-for="fid in group.factor_ids" :key="fid" :class="{ bad: mismatched(fid) }">
          <td class="name">{{ table.factor_labels[fid] ?? fid }}</td>
          <td class="ctr src">{{ table1Grade(fid) ?? '—' }}</td>
          <td class="ctr">
            <span class="chip">
              {{ table.benchmark_grades[fid]?.grade }} {{ table.benchmark_grades[fid]?.label }}
            </span>
          </td>
          <td class="ctr">
            <span v-if="comparable" class="chip">
              {{ comparable.grades[fid]?.grade }} {{ comparable.grades[fid]?.label }}
            </span>
          </td>
          <td class="num">{{ comparable?.filed_corrections[fid]?.toFixed(2) ?? '—' }}%</td>
        </tr>
        <tr class="subtotal">
          <td colspan="4">百分比小計</td>
          <td class="num">{{ comparable?.filed_subtotals[group.label]?.toFixed(2) ?? '—' }}%</td>
        </tr>
      </tbody>
      <tfoot>
        <tr>
          <td colspan="4">影響地價區域因素總修正數 =(1)+(2)+(3)+(4)+(5)+(6)+(7)+(8)</td>
          <td class="num">{{ comparable?.filed_total?.toFixed(2) ?? '—' }}%</td>
        </tr>
      </tfoot>
    </table>

    <p class="note">
      「表1」那一欄是從地價區段勘查表抽出來的等級。兩欄必須一致——這是作業手冊
      審查重點第 vi 項的原文要求，也是人工最難逐項核對的地方。
    </p>
  </div>
</template>

<style scoped>
.wrap {
  display: grid;
  gap: 0.9rem;
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
.same {
  margin: 0;
  padding: 0.6rem 0.8rem;
  background: var(--surface-2);
  border-radius: 8px;
  font-size: 0.82rem;
  color: var(--muted);
  line-height: 1.7;
}
.same b {
  color: var(--text);
  font-family: var(--mono);
}
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}
th,
td {
  padding: 0.35rem 0.55rem;
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
  width: 46%;
}
.ctr {
  text-align: center;
  white-space: nowrap;
}
.num {
  text-align: right;
  font-family: var(--mono);
  white-space: nowrap;
}
.src {
  font-family: var(--mono);
  color: var(--muted);
}
.chip {
  padding: 0.05rem 0.4rem;
  border-radius: 4px;
  background: var(--chip);
  font-size: 0.78rem;
  white-space: nowrap;
}
tr.group td {
  padding-top: 0.8rem;
  font-weight: 600;
  font-size: 0.8rem;
  color: var(--accent);
  border-bottom: none;
}
tr.subtotal td {
  color: var(--muted);
  font-size: 0.8rem;
}
tr.bad {
  background: var(--bad-bg);
}
tr.bad .chip {
  background: var(--bad);
  color: #fff;
}
tfoot td {
  padding-top: 0.7rem;
  font-weight: 600;
  border-bottom: none;
}
.note {
  margin: 0;
  font-size: 0.78rem;
  color: var(--muted);
  line-height: 1.7;
}
</style>
