<script setup lang="ts">
/**
 * 產出模式：上傳填好的表3 勘查表 xlsx，看算出來的表5-1 與表4，並下載可交件的書表。
 *
 * 與審查模式（上傳已填好的 PDF 去比對）方向相反。這裡的表是空的，系統算出
 * 每一格該填什麼。正式題目的勘查表沒有優劣等級這一欄，所以沒有對照對象可比。
 *
 * 這個元件刻意不做任何計算。等級、修正率、小計、價格全部來自後端，
 * 連敘述都是後端的規則引擎產生的。畫面只負責呈現與讓人點開依據。
 */

import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'

import { formDownloadUrl } from '@/services/valuationService'
import { useCaseStore } from '@/stores/case'
import type { FactorEvidence } from '@/types/case'

const store = useCaseStore()
const { survey, surveyLoading, surveyFileName, surveySegment, surveyEvidence, surveyFailures } =
  storeToRefs(store)

const fileInput = ref<HTMLInputElement | null>(null)
/** 點開的那一列依據。null 代表沒有選 */
const openFactor = ref<string | null>(null)

function pick() {
  fileInput.value?.click()
}

function onPick(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file) store.analyzeSurvey(file)
}

function onDrop(event: DragEvent) {
  const file = event.dataTransfer?.files?.[0]
  if (file) store.analyzeSurvey(file)
}

function toggle(factorId: string) {
  openFactor.value = openFactor.value === factorId ? null : factorId
}

/** 依據列表依群組分段，與書表上的排列一致 */
const grouped = computed(() => {
  const ev = surveyEvidence.value
  if (!ev) return []
  const out: { group: string; subtotal: string; factors: FactorEvidence[] }[] = []
  for (const g of ev.groups) {
    out.push({
      group: g.group,
      subtotal: g.subtotal_pct,
      factors: ev.factors.filter((f) => f.group === g.group),
    })
  }
  return out
})

/**
 * 百分比。零不帶正號，與後端的敘述一致（「+0.00%」讀起來像刻意標記）。
 *
 * 接受 undefined 是因為 tsconfig 開了 noUncheckedIndexedAccess，
 * 而這些值都是用區段編號去索引 Record 拿到的。缺值顯示破折號而不是 NaN。
 */
function pct(value: string | number | undefined): string {
  if (value === undefined) return '—'
  const n = typeof value === 'string' ? Number(value) : value
  if (Number.isNaN(n)) return String(value)
  return `${n === 0 ? '' : n > 0 ? '+' : ''}${n.toFixed(2)}%`
}

function money(value: number | undefined): string {
  return value === undefined ? '—' : value.toLocaleString('zh-TW')
}
</script>

<template>
  <section class="survey">
    <header class="head">
      <div>
        <h2>從勘查表算出該填什麼</h2>
        <p class="sub">
          上傳填好的表3 地價區段勘查表（xlsx），系統依評價基準明細表算出表5-1
          的每一格與表4 的價格，並產出可交件的書表。
        </p>
      </div>
      <div class="actions">
        <button type="button" @click="pick" :disabled="surveyLoading">
          {{ surveyLoading ? '計算中…' : '選擇 xlsx' }}
        </button>
        <button v-if="survey" type="button" class="ghost" @click="store.resetSurvey()">
          清除
        </button>
      </div>
    </header>

    <div
      class="drop"
      @click="pick"
      @dragover.prevent
      @drop.prevent="onDrop"
      role="button"
      tabindex="0"
      @keydown.enter="pick"
      @keydown.space.prevent="pick"
      :aria-label="'上傳填好的表3 勘查表 xlsx'"
    >
      <template v-if="surveyLoading">正在讀取勘查表並計算…</template>
      <template v-else-if="surveyFileName">{{ surveyFileName }}</template>
      <template v-else>把填好的表3 xlsx 拖進來，或點這裡選檔</template>
    </div>
    <input
      ref="fileInput"
      type="file"
      accept=".xlsx"
      class="hidden-input"
      @change="onPick"
      aria-hidden="true"
      tabindex="-1"
    />

    <template v-if="survey">
      <!-- 自我驗證。放在最前面，因為它決定下面的數字能不能信 -->
      <div class="verify" :class="{ bad: !survey.verification.passed }">
        <strong>
          {{ survey.verification.passed ? '自我驗證通過' : '自我驗證未通過' }}
        </strong>
        <span>
          {{ survey.verification.total - survey.verification.failed }} /
          {{ survey.verification.total }} 項
        </span>
        <ul v-if="surveyFailures.length" class="failures">
          <li v-for="c in surveyFailures" :key="c.name">{{ c.name }}：{{ c.detail }}</li>
        </ul>
      </div>

      <p class="premise">{{ survey.premise }}</p>

      <ul v-if="survey.read_warnings.length" class="warnings">
        <li v-for="(w, i) in survey.read_warnings" :key="i">
          {{ w.segment }}　{{ w.factor_id }}：{{ w.reason }}
        </li>
      </ul>

      <!-- 填出來的格數。命題點名的痛點就是這些格子容易抄錯。
           優劣等級在書表上是兩欄（左欄級數、右欄等級文字，
           依新北市查估書表製作手冊第 5 章第 42 頁），所以細項數乘二才是格數。 -->
      <dl class="counts">
        <div>
          <dt>優劣等級</dt>
          <dd>
            {{ survey.cell_counts.grades }} 項
            <small>級數與等級文字共 {{ survey.cell_counts.grades * 2 }} 格</small>
          </dd>
        </div>
        <div>
          <dt>修正百分比</dt>
          <dd>{{ survey.cell_counts.corrections }} 格</dd>
        </div>
        <div>
          <dt>群組小計</dt>
          <dd>{{ survey.cell_counts.subtotals }} 格</dd>
        </div>
        <div>
          <dt>總修正數</dt>
          <dd>{{ survey.cell_counts.totals }} 格</dd>
        </div>
      </dl>

      <!-- 表4 的結果 -->
      <table class="result">
        <caption>
          表4 比較法調查估價表（案號 {{ survey.case_id }}）
        </caption>
        <thead>
          <tr>
            <th scope="col">比較標的</th>
            <th scope="col">區域因素調整百分率</th>
            <th scope="col">調整百分率絕對值加總</th>
            <th scope="col">相近程度</th>
            <th scope="col">權重</th>
            <th scope="col">試算價格（元/㎡）</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="seg in survey.comparables" :key="seg">
            <th scope="row">{{ seg }}</th>
            <td class="num">{{ pct(survey.table4.regional_pct[seg]) }}</td>
            <td class="num">{{ pct(survey.table4.abs_sum_pct[seg]) }}</td>
            <td>{{ survey.table4.similarity[seg] }}</td>
            <td class="num">{{ survey.table4.weight_pct[seg] }}%</td>
            <td class="num">{{ money(survey.table4.trial_price[seg]) }}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" colspan="5">比準地比較價格</th>
            <td class="num">{{ money(survey.table4.benchmark_comparison_price) }}</td>
          </tr>
          <tr>
            <th scope="row" colspan="5">比準地地價（查估辦法第21條分段進位）</th>
            <td class="num">{{ money(survey.table4.benchmark_land_price) }}</td>
          </tr>
        </tfoot>
      </table>

      <!-- 依據鏈。切換標的只換這一份，不必重打 API -->
      <div class="evidence">
        <div class="tabs" role="tablist" aria-label="選擇比較標的">
          <button
            v-for="seg in survey.comparables"
            :key="seg"
            type="button"
            role="tab"
            :aria-selected="surveySegment === seg"
            :class="{ on: surveySegment === seg }"
            @click="store.selectSurveySegment(seg)"
          >
            {{ seg }}
            <small>{{ pct(survey.table5_1.totals[seg]) }}</small>
          </button>
        </div>

        <p v-if="surveyEvidence" class="narrative">{{ surveyEvidence.narrative }}</p>

        <div v-for="g in grouped" :key="g.group" class="group">
          <h3>
            {{ g.group }}
            <span class="num">{{ pct(g.subtotal) }}</span>
          </h3>
          <table class="factors">
            <thead>
              <tr>
                <th scope="col">修正細項</th>
                <th scope="col">比準地</th>
                <th scope="col">比較標的</th>
                <th scope="col">修正率</th>
                <th scope="col">基準表</th>
              </tr>
            </thead>
            <tbody>
              <template v-for="f in g.factors" :key="f.factor_id">
                <tr
                  class="row"
                  :class="{ muted: !f.counted, open: openFactor === f.factor_id }"
                  @click="toggle(f.factor_id)"
                  role="button"
                  tabindex="0"
                  @keydown.enter="toggle(f.factor_id)"
                  @keydown.space.prevent="toggle(f.factor_id)"
                  :aria-expanded="openFactor === f.factor_id"
                >
                  <td>{{ f.label }}</td>
                  <td>
                    {{ f.benchmark.value ?? '無' }}
                    <small>{{ f.benchmark.grade ?? '-' }} {{ f.benchmark.grade_label }}</small>
                  </td>
                  <td>
                    {{ f.comparable.value ?? '無' }}
                    <small>{{ f.comparable.grade ?? '-' }} {{ f.comparable.grade_label }}</small>
                  </td>
                  <td class="num">{{ pct(f.correction_pct) }}</td>
                  <td class="num">{{ f.source_page ? `第 ${f.source_page} 頁` : '—' }}</td>
                </tr>
                <tr v-if="openFactor === f.factor_id" class="detail">
                  <td colspan="5">
                    <p class="say">{{ f.narrative }}</p>
                    <dl>
                      <dt>比準地判級依據</dt>
                      <dd>{{ f.benchmark.reason }}</dd>
                      <dt>比較標的判級依據</dt>
                      <dd>{{ f.comparable.reason }}</dd>
                      <dt>矩陣查表</dt>
                      <dd>{{ f.correction_reason }}</dd>
                      <template v-if="!f.counted">
                        <dt>未計入小計</dt>
                        <dd>{{ f.exclusion_reason }}</dd>
                      </template>
                    </dl>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 產出的檔案 -->
      <div class="files">
        <h3>可交件的檔案</h3>
        <ul>
          <li v-for="f in survey.files" :key="f.filename">
            <a :href="formDownloadUrl(f.link)" target="_blank" rel="noopener">{{ f.filename }}</a>
            <span class="size">{{ Math.round(f.size / 1024) }} KB</span>
          </li>
        </ul>
        <p class="hint">
          活版（live）的加總與四則運算是 Excel 公式，把個別因素填進表4 之後下游會自動
          更新。定版（final）全部是算好的數值，用於對照答案與轉 PDF。兩份的數字一致。
        </p>
      </div>
    </template>
  </section>
</template>

<style scoped>
.survey {
  display: grid;
  gap: 1rem;
}

.head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  flex-wrap: wrap;
}

h2 {
  margin: 0 0 0.25rem;
  font-size: 1.15rem;
}

.sub {
  margin: 0;
  max-width: 52ch;
  color: var(--muted, #667);
  font-size: 0.86rem;
  line-height: 1.6;
}

.actions {
  display: flex;
  gap: 0.5rem;
}

button {
  border: 1px solid var(--accent, #35a);
  background: var(--accent, #35a);
  color: #fff;
  border-radius: 6px;
  padding: 0.45rem 0.9rem;
  font: inherit;
  cursor: pointer;
}

button:disabled {
  opacity: 0.55;
  cursor: progress;
}

button.ghost {
  background: transparent;
  color: var(--accent, #35a);
}

.drop {
  border: 1.5px dashed var(--line, #ccd);
  border-radius: 8px;
  padding: 1.4rem;
  text-align: center;
  color: var(--muted, #667);
  cursor: pointer;
  font-size: 0.9rem;
}

.drop:hover,
.drop:focus-visible {
  border-color: var(--accent, #35a);
  color: var(--accent, #35a);
}

.hidden-input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

.verify {
  display: flex;
  align-items: baseline;
  gap: 0.6rem;
  flex-wrap: wrap;
  border-left: 4px solid var(--ok, #2a7);
  background: color-mix(in srgb, var(--ok, #2a7) 8%, transparent);
  padding: 0.6rem 0.8rem;
  border-radius: 0 6px 6px 0;
  font-size: 0.9rem;
}

.verify.bad {
  border-left-color: var(--bad, #c33);
  background: color-mix(in srgb, var(--bad, #c33) 8%, transparent);
}

.failures {
  flex-basis: 100%;
  margin: 0.3rem 0 0;
  padding-left: 1.1rem;
  font-size: 0.85rem;
}

.premise {
  margin: 0;
  font-size: 0.84rem;
  line-height: 1.6;
  color: var(--muted, #667);
  border-left: 3px solid var(--line, #ccd);
  padding-left: 0.7rem;
}

.warnings {
  margin: 0;
  padding-left: 1.1rem;
  font-size: 0.84rem;
  color: var(--warn, #a70);
}

.counts {
  display: flex;
  gap: 1.6rem;
  flex-wrap: wrap;
  margin: 0;
}

.counts div {
  display: grid;
  gap: 0.15rem;
}

.counts dt {
  font-size: 0.78rem;
  color: var(--muted, #667);
}

.counts dd {
  margin: 0;
  font-size: 1.05rem;
  font-variant-numeric: tabular-nums;
}

/* 優劣等級那一格的補充說明。書表上它是兩欄，數字容易被誤讀 */
.counts dd small {
  display: block;
  font-size: 0.72rem;
  font-weight: 400;
  color: var(--muted, #667);
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.87rem;
}

caption {
  text-align: left;
  padding-bottom: 0.4rem;
  color: var(--muted, #667);
  font-size: 0.84rem;
}

th,
td {
  border: 1px solid var(--line, #ddd);
  padding: 0.35rem 0.5rem;
  text-align: left;
  vertical-align: top;
}

thead th {
  background: var(--head, #f3f4f7);
  font-weight: 600;
  white-space: nowrap;
}

.num {
  text-align: right;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

tfoot th {
  text-align: right;
}

.tabs {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.tabs button {
  background: transparent;
  color: inherit;
  border-color: var(--line, #ccd);
  display: grid;
  gap: 0.1rem;
  padding: 0.35rem 0.7rem;
}

.tabs button.on {
  border-color: var(--accent, #35a);
  color: var(--accent, #35a);
  font-weight: 600;
}

.tabs small {
  font-variant-numeric: tabular-nums;
  opacity: 0.75;
}

.narrative {
  margin: 0.6rem 0 0;
  font-size: 0.88rem;
  line-height: 1.7;
}

.group {
  margin-top: 0.9rem;
}

.group h3 {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin: 0 0 0.3rem;
  font-size: 0.92rem;
}

.row {
  cursor: pointer;
}

.row:hover {
  background: var(--hover, #f7f8fb);
}

.row.open {
  background: color-mix(in srgb, var(--accent, #35a) 6%, transparent);
}

.row.muted td {
  color: var(--muted, #889);
}

.row small {
  display: block;
  font-size: 0.76rem;
  color: var(--muted, #778);
}

.detail td {
  background: var(--panel, #fafbfd);
}

.say {
  margin: 0 0 0.5rem;
  line-height: 1.75;
}

.detail dl {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 0.2rem 0.8rem;
  margin: 0;
  font-size: 0.83rem;
}

.detail dt {
  color: var(--muted, #667);
  white-space: nowrap;
}

.detail dd {
  margin: 0;
}

.files h3 {
  margin: 0 0 0.35rem;
  font-size: 0.95rem;
}

.files ul {
  margin: 0;
  padding-left: 1.1rem;
  font-size: 0.87rem;
}

.files li {
  margin-bottom: 0.2rem;
}

.size {
  color: var(--muted, #889);
  margin-left: 0.5rem;
  font-size: 0.8rem;
}

.hint {
  margin: 0.5rem 0 0;
  font-size: 0.82rem;
  line-height: 1.65;
  color: var(--muted, #667);
}
</style>
