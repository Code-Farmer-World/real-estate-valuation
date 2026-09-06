<script setup lang="ts">
/**
 * 表1 地價區段勘查表：28 個細項的等級、級數與現場量測值。
 *
 * 「級數」單獨顯示是有原因的：**它不一定是 5**。都市計畫內外、有無禁止建築、
 * 有無限制建築都是 2 級，把 5 當常數會讓這三項的等級語意整個錯掉。
 *
 * 量測值欄顯示原文（`raw`）而不只是結構化後的數字，因為這張表的欄位型態太雜
 * （圈選、名稱＋距離、純文字、百分比、複選），任何結構化都可能漏掉某種寫法。
 */
import type { Survey, Table1 } from '@/types/case'

const props = defineProps<{ table: Table1 }>()

/** 逐列組好，避免在樣板裡做索引存取（tsconfig 開了 noUncheckedIndexedAccess） */
const rows = Object.entries(props.table.grades).map(([factorId, grade]) => ({
  factorId,
  grade,
  survey: props.table.surveys[factorId],
}))

/** 一格的摘要：優先顯示量測值，其次顯示圈選到的設施與距離 */
function summary(survey: Survey | undefined): string {
  if (!survey) return '—'
  if (survey.numeric !== null) return `${survey.numeric}${survey.unit ?? ''}`
  if (survey.text) return survey.text

  const marked = survey.entries.filter((e) => e.marked)
  if (marked.length) {
    return marked
      .map((e) => {
        const name = e.option ?? e.name ?? ''
        return e.distance_m === null ? name : `${name} ${e.distance_m}M`
      })
      .join('、')
  }
  const named = survey.entries.find((e) => e.name)
  return named?.name ?? '—'
}

/** 多設施取最劣（作業手冊 p.24「以對當地地價影響最大者填寫」）時的最近距離 */
function nearest(survey: Survey | undefined): number | null {
  const distances = (survey?.entries ?? [])
    .filter((e) => e.marked && e.distance_m !== null)
    .map((e) => e.distance_m as number)
  return distances.length > 1 ? Math.min(...distances) : null
}
</script>

<template>
  <div class="wrap">
    <div class="meta">
      <span><b>年期</b> {{ table.period }}</span>
      <span><b>區段編號</b> {{ table.segment_no }}</span>
    </div>
    <p v-if="table.segment_scope" class="scope">{{ table.segment_scope }}</p>

    <table>
      <thead>
        <tr>
          <th class="name">細項</th>
          <th class="ctr">等級</th>
          <th class="ctr">級數</th>
          <th>現場量測／填答</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.factorId">
          <td class="name">{{ row.grade.label_in_form }}</td>
          <td class="ctr"><span class="chip">{{ row.grade.grade }}</span></td>
          <td class="ctr" :class="{ two: row.grade.grade_count === 2 }">
            {{ row.grade.grade_count }}
          </td>
          <td class="val">
            {{ summary(row.survey) }}
            <span v-if="nearest(row.survey) !== null" class="worst">
              取最劣 {{ nearest(row.survey) }}M
            </span>
          </td>
        </tr>
      </tbody>
    </table>

    <p class="note">
      級數標色的三項是<b>二級制</b>（都市計畫內外、有無禁止建築、有無限制建築）。
      「取最劣」出現在一個細項對應多個設施時——例如電業設施同時有變電所 700M
      與儲油槽 440M，依作業手冊 p.24 取影響最大者，也就是 440M。
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
  gap: 1.4rem;
  font-size: 0.82rem;
  color: var(--muted);
}
.meta b {
  color: var(--text);
  font-weight: 600;
  margin-right: 0.3rem;
}
.scope {
  margin: 0;
  padding: 0.6rem 0.8rem;
  background: var(--surface-2);
  border-radius: 8px;
  font-size: 0.8rem;
  color: var(--muted);
  line-height: 1.7;
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
  width: 34%;
}
.ctr {
  text-align: center;
  font-family: var(--mono);
  white-space: nowrap;
}
.ctr.two {
  color: var(--accent);
  font-weight: 600;
}
.chip {
  padding: 0.05rem 0.45rem;
  border-radius: 4px;
  background: var(--chip);
}
.val {
  color: var(--muted);
}
.worst {
  margin-left: 0.5rem;
  padding: 0.05rem 0.4rem;
  border-radius: 4px;
  background: var(--warn-bg);
  color: var(--warn);
  font-size: 0.72rem;
  white-space: nowrap;
}
.note {
  margin: 0;
  font-size: 0.78rem;
  color: var(--muted);
  line-height: 1.7;
}
.note b {
  color: var(--text);
}
</style>
