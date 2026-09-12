<script setup lang="ts">
/**
 * 主畫面：上傳查估書表 PDF → 三張表 → 點格子看依據 → 審查結論。
 */
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'

import EvidencePanel from '@/components/EvidencePanel.vue'
import SurveyPanel from '@/components/SurveyPanel.vue'
import Table1Panel from '@/components/Table1Panel.vue'
import Table4Panel from '@/components/Table4Panel.vue'
import Table52Panel from '@/components/Table52Panel.vue'
import { formDownloadUrl } from '@/services/valuationService'
import { useCaseStore } from '@/stores/case'

/** 產出模式與審查模式。預設產出模式，那是正式題目要的 */
const mode = ref<'survey' | 'review'>('survey')

const store = useCaseStore()
const { fileName, parsed, computed: result, reviewed, loading, errorMessage } = storeToRefs(store)
const { table1, table52, table4, firstComparable, correctionsByFactor } = storeToRefs(store)
const { forms, formsLoading } = storeToRefs(store)

const tab = ref<'表4' | '表5-2' | '表1'>('表4')
const selectedFactor = ref<string | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)

const selectedCorrection = computed(() =>
  selectedFactor.value ? (correctionsByFactor.value[selectedFactor.value] ?? null) : null,
)

const selectedSource = computed(() => {
  if (!selectedFactor.value || !parsed.value) return null
  return parsed.value.provenance[`表4.benchmark.facts.${selectedFactor.value}`] ?? null
})

const selectedTitle = computed(() =>
  selectedFactor.value ? (table4.value?.factor_labels[selectedFactor.value] ?? selectedFactor.value) : '',
)

const allFindings = computed(() => {
  const layers = reviewed.value?.layers
  if (!layers) return []
  return [
    ...layers.table1_internal.map((f) => ({ ...f, layer: '表1 內部' })),
    ...layers.table1_to_table5_2.map((f) => ({ ...f, layer: '表1 → 表5-2' })),
    ...layers.table5_2_to_table4.map((f) => ({ ...f, layer: '表5-2 → 表4' })),
  ]
})

/**
 * 合理性檢查的結果。
 *
 * 與「審查發現」分開顯示，因為兩者要採取的行動不同：審查發現是估價師填錯，
 * 要去改書表；合理性問題是這個數字本身不對，要先去確認辨識有沒有讀錯。
 */
const sanity = computed(() => reviewed.value?.sanity ?? [])
const sanityErrors = computed(() => sanity.value.filter((s) => s.level === 'error'))

/**
 * 有 error 級的可疑值時，「相符」這兩個字會誤導人——三層檢核確實沒抓到不符，
 * 但那是因為輸入本身就不可信。這時要先講輸入有問題。
 */
const verdictText = computed(() => {
  const r = reviewed.value
  if (!r) return ''
  if (sanityErrors.value.length) return '輸入值有疑慮'
  return r.verdict === 'match' ? '相符' : `${r.finding_count} 處不符`
})

/** 三層檢核的摘要。層名與法源對應作業手冊印刷頁 11–13 的審查重點 */
const layerSummary = computed(() => {
  const r = reviewed.value
  if (!r) return []
  return [
    {
      key: 'table1_internal',
      name: '第一層　表1 內部',
      basis: '量測值 vs 所填等級',
      checked: r.checked.table1_internal,
      findings: r.layers.table1_internal.length,
    },
    {
      key: 'table1_to_table5_2',
      name: '第二層　表1 → 表5-2',
      basis: '審查重點第 vi 項：兩表等級須一致',
      checked: r.checked.table1_to_table5_2,
      findings: r.layers.table1_to_table5_2.length,
    },
    {
      key: 'table5_2_to_table4',
      name: '第三層　表5-2 → 表4',
      basis: '審查重點第 vii 項：總修正數須相符',
      checked: r.checked.table5_2_to_table4,
      findings: r.layers.table5_2_to_table4.length,
    },
  ]
})

function onPick(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file) {
    selectedFactor.value = null
    store.analyze(file)
  }
}

function onDrop(event: DragEvent) {
  const file = event.dataTransfer?.files?.[0]
  if (file) {
    selectedFactor.value = null
    store.analyze(file)
  }
}
</script>

<template>
  <div class="page">
    <header>
      <h1>不動產估價案件審查</h1>
      <p class="sub">
        依評價基準明細表計算與比對查估書表。<b>每個數字都指得回來源，沒有任何一個是模型生成的。</b>
      </p>
    </header>

    <!-- 兩種模式各自獨立。產出走 xlsx（格位對映，結構化），
         審查走 PDF（座標比對，綁版面）。其中一條失敗不影響另一條。 -->
    <nav class="modes" role="tablist" aria-label="選擇模式">
      <button
        type="button"
        role="tab"
        :aria-selected="mode === 'survey'"
        :class="{ on: mode === 'survey' }"
        @click="mode = 'survey'"
      >
        產出模式
        <small>從勘查表算出該填什麼</small>
      </button>
      <button
        type="button"
        role="tab"
        :aria-selected="mode === 'review'"
        :class="{ on: mode === 'review' }"
        @click="mode = 'review'"
      >
        審查模式
        <small>比對已填好的書表</small>
      </button>
    </nav>

    <SurveyPanel v-if="mode === 'survey'" />

    <template v-else>
    <p class="sub mode-note">
      上傳查估書表 PDF，系統辨識表1、表5-2、表4，依評價基準明細表重算，
      逐格比對估價師填的值。此模式的版面辨識已對金山範本校準，
      換一種版面需重新校準格位。
    </p>

    <section
      class="drop"
      :class="{ busy: loading }"
      @click="fileInput?.click()"
      @dragover.prevent
      @drop.prevent="onDrop"
    >
      <input ref="fileInput" type="file" accept="application/pdf" hidden @change="onPick" />
      <template v-if="loading">
        <span class="spinner" />
        <span>辨識中……</span>
      </template>
      <template v-else-if="fileName">
        <b>{{ fileName }}</b>
        <span class="hint">點一下換一份，或直接把 PDF 拖進來</span>
      </template>
      <template v-else>
        <b>把查估書表 PDF 拖進來</b>
        <span class="hint">或點一下選檔。範本在 docs/official/real-estate-valuation/查估書表範本.pdf</span>
      </template>
    </section>

    <p v-if="errorMessage" class="error">{{ errorMessage }}</p>

    <template v-if="parsed">
      <section class="cards">
        <div class="card">
          <span class="k">案號</span>
          <span class="v mono">{{ parsed.case_id }}</span>
        </div>
        <div class="card">
          <span class="k">個別因素合計</span>
          <span class="v mono">{{ firstComparable?.individual_total_pct?.toFixed(2) }}%</span>
        </div>
        <div class="card">
          <span class="k">比準地比較價格</span>
          <span class="v mono">{{ result?.benchmark_comparison_price?.toLocaleString() }}</span>
          <span class="unit">元/㎡</span>
        </div>
        <div class="card">
          <span class="k">比準地地價<i>（第21條進位）</i></span>
          <span class="v mono">{{ result?.benchmark_land_price_rounded?.toLocaleString() }}</span>
          <span class="unit">元/㎡</span>
        </div>
        <div class="card" :class="sanityErrors.length ? 'mismatch' : reviewed?.verdict">
          <span class="k">審查結論</span>
          <span class="v">{{ verdictText }}</span>
          <span class="unit">逐格比對 {{ reviewed?.checked_total }} 格</span>
        </div>
      </section>

      <section v-if="sanity.length" class="sanity">
        <h2>輸入值有疑慮（{{ sanity.length }}）</h2>
        <p class="lead">
          這一類不是「估價師填錯」，是<b>這個數字本身不合理</b>。
          在排除辨識誤讀之前，下面的審查結果不宜採信。
        </p>
        <div v-for="(s, i) in sanity" :key="i" class="sitem" :class="s.level">
          <div class="sh">
            <span class="slv">{{ s.level === 'error' ? '幾乎確定誤讀' : '可疑' }}</span>
            <b>{{ s.label }}</b>
            <span class="sval mono">{{ JSON.stringify(s.value) }}</span>
          </div>
          <p class="sr">{{ s.reason }}</p>
          <p class="spath mono">{{ s.path }}</p>
        </div>
      </section>

      <section v-if="allFindings.length" class="findings">
        <h2>審查發現</h2>
        <div v-for="(f, i) in allFindings" :key="i" class="finding">
          <div class="fh">
            <span class="layer">{{ f.layer }}</span>
            <span class="fid">{{ f.factor_id }}</span>
          </div>
          <div class="fv">
            表上填 <b class="filed">{{ JSON.stringify(f.filed) }}</b>
            ，應為 <b class="right">{{ JSON.stringify(f.computed) }}</b>
          </div>
          <p class="fb">{{ f.basis }}</p>
        </div>
        <p v-if="reviewed?.price_impact?.diff_per_sqm" class="impact">
          單價差額 <b>{{ reviewed.price_impact.diff_per_sqm.toLocaleString() }}</b> 元/㎡
        </p>
      </section>

      <section v-if="reviewed" class="layers">
        <div v-for="l in layerSummary" :key="l.key" class="layer-card" :class="{ bad: l.findings > 0 }">
          <span class="ln">{{ l.name }}</span>
          <span class="lc">{{ l.checked }} 格</span>
          <span class="lr">{{ l.findings > 0 ? `${l.findings} 處不符` : '相符' }}</span>
          <span class="lb">{{ l.basis }}</span>
        </div>
      </section>

      <section class="output">
        <div class="oh">
          <div>
            <h2>產出官方格式書表</h2>
            <p>
              把引擎算出來的等級與修正率填回官方版面，輸出三張可交件的 PDF。
              框線與欄位名都是從官方書表抽出來的，不是重畫的版面。
            </p>
          </div>
          <button :disabled="formsLoading" @click="store.makeForms()">
            {{ formsLoading ? '產出中……' : forms ? '重新產出' : '產出三張書表' }}
          </button>
        </div>
        <ul v-if="forms" class="files">
          <li v-for="f in forms.files" :key="f.filename">
            <a :href="formDownloadUrl(f.link)" target="_blank" rel="noopener">
              <b>{{ f.table }}</b>
              <span class="fn">{{ f.filename }}</span>
              <span class="fs">{{ Math.round(f.size / 1024) }} KB</span>
            </a>
          </li>
        </ul>
      </section>

      <nav class="tabs">
        <button
          v-for="t in (['表4', '表5-2', '表1'] as const)"
          :key="t"
          :class="{ on: tab === t }"
          @click="tab = t"
        >
          {{ t }}
          <small>{{ { 表4: '比較法調查估價表', '表5-2': '區域因素分析明細表', 表1: '地價區段勘查表' }[t] }}</small>
        </button>
      </nav>

      <div class="body">
        <main>
          <Table4Panel
            v-if="tab === '表4' && table4 && table4.comparables[0]"
            :table="table4"
            :comparable="table4.comparables[0]"
            :corrections="correctionsByFactor"
            :selected="selectedFactor"
            @select="selectedFactor = $event"
          />
          <Table52Panel v-else-if="tab === '表5-2' && table52" :table="table52" :table1="table1" />
          <Table1Panel v-else-if="tab === '表1' && table1" :table="table1" />
          <p v-else class="missing">這份 PDF 裡沒有 {{ tab }}。</p>
        </main>

        <EvidencePanel
          v-if="tab === '表4'"
          :title="selectedTitle"
          :correction="selectedCorrection"
          :source="selectedSource"
        />
      </div>

      <section v-if="reviewed?.not_checkable?.length" class="skipped">
        <h2>查不動的項目（{{ reviewed.not_checkable.length }}）</h2>
        <p>
          {{ reviewed.not_checkable[0]?.reason }}——這些細項的規則還沒補進規則集，
          所以第一層（量測值 vs 等級）查不了。列出來是為了不讓「沒查」被誤讀成「通過」。
        </p>
      </section>
    </template>
    </template>
  </div>
</template>

<style scoped>
.modes {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.2rem;
}

.modes button {
  display: grid;
  gap: 0.15rem;
  border: 1px solid var(--line, #ccd);
  background: transparent;
  color: inherit;
  border-radius: 8px;
  padding: 0.5rem 0.9rem;
  font: inherit;
  cursor: pointer;
  text-align: left;
}

.modes button.on {
  border-color: var(--accent, #35a);
  color: var(--accent, #35a);
  font-weight: 600;
}

.modes small {
  font-size: 0.76rem;
  font-weight: 400;
  opacity: 0.8;
}

.mode-note {
  margin-top: 0;
}

.page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem 1.5rem 4rem;
  display: grid;
  gap: 1.5rem;
}
h1 {
  margin: 0 0 0.4rem;
  font-size: 1.5rem;
  letter-spacing: -0.01em;
}
.sub {
  margin: 0;
  max-width: 62ch;
  color: var(--muted);
  font-size: 0.88rem;
  line-height: 1.8;
}
.sub b {
  color: var(--text);
  font-weight: 600;
}

.drop {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
  padding: 1.6rem;
  border: 1.5px dashed var(--line-strong);
  border-radius: 10px;
  background: var(--surface);
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}
.drop:hover {
  border-color: var(--accent);
  background: var(--hover);
}
.drop.busy {
  cursor: progress;
}
.hint {
  font-size: 0.8rem;
  color: var(--muted);
}
.spinner {
  width: 18px;
  height: 18px;
  border: 2px solid var(--line-strong);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.error {
  margin: 0;
  padding: 0.7rem 0.9rem;
  border-radius: 8px;
  background: var(--bad-bg);
  color: var(--bad);
  font-size: 0.85rem;
}

.cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 0.75rem;
}
.card {
  padding: 0.75rem 0.9rem;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface);
  display: grid;
  gap: 0.15rem;
}
.card .k {
  font-size: 0.72rem;
  color: var(--muted);
}
.card .k i {
  font-style: normal;
  opacity: 0.7;
}
.card .v {
  font-size: 1.15rem;
  font-weight: 600;
}
.card .unit {
  font-size: 0.7rem;
  color: var(--muted);
}
.card.match .v {
  color: var(--ok);
}
.card.mismatch .v {
  color: var(--bad);
}

.sanity {
  display: grid;
  gap: 0.6rem;
  padding: 1rem 1.1rem;
  border: 1px solid var(--warn);
  border-radius: 10px;
  background: var(--warn-bg);
}
.sanity h2 {
  margin: 0;
  font-size: 0.95rem;
  color: var(--warn);
}
.sanity .lead {
  margin: 0;
  max-width: 64ch;
  font-size: 0.8rem;
  color: var(--muted);
  line-height: 1.7;
}
.sanity .lead b {
  color: var(--text);
}
.sitem {
  padding: 0.6rem 0.75rem;
  background: var(--surface);
  border-radius: 8px;
  border-left: 3px solid var(--warn);
}
.sitem.error {
  border-left-color: var(--bad);
}
.sh {
  display: flex;
  gap: 0.5rem;
  align-items: baseline;
  font-size: 0.85rem;
  flex-wrap: wrap;
}
.slv {
  padding: 0.05rem 0.4rem;
  border-radius: 4px;
  background: var(--chip);
  font-size: 0.72rem;
}
.sitem.error .slv {
  background: var(--bad-bg);
  color: var(--bad);
}
.sval {
  color: var(--bad);
}
.sr {
  margin: 0.3rem 0 0;
  font-size: 0.8rem;
  color: var(--muted);
  line-height: 1.7;
}
.spath {
  margin: 0.25rem 0 0;
  font-size: 0.7rem;
  color: var(--muted);
  opacity: 0.75;
}

.findings {
  display: grid;
  gap: 0.6rem;
  padding: 1rem 1.1rem;
  border: 1px solid var(--bad);
  border-radius: 10px;
  background: var(--bad-bg);
}
.findings h2 {
  margin: 0;
  font-size: 0.95rem;
  color: var(--bad);
}
.finding {
  padding: 0.6rem 0.75rem;
  background: var(--surface);
  border-radius: 8px;
}
.fh {
  display: flex;
  gap: 0.5rem;
  align-items: baseline;
  font-size: 0.75rem;
}
.layer {
  padding: 0.05rem 0.4rem;
  border-radius: 4px;
  background: var(--chip);
}
.fid {
  font-family: var(--mono);
  color: var(--muted);
}
.fv {
  margin-top: 0.3rem;
  font-size: 0.85rem;
}
.filed {
  font-family: var(--mono);
  color: var(--bad);
}
.right {
  font-family: var(--mono);
  color: var(--ok);
}
.fb {
  margin: 0.3rem 0 0;
  font-size: 0.78rem;
  color: var(--muted);
  line-height: 1.6;
}
.impact {
  margin: 0;
  font-size: 0.85rem;
}
.impact b {
  font-family: var(--mono);
  color: var(--bad);
}

.layers {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
  gap: 0.75rem;
}
.layer-card {
  display: grid;
  gap: 0.15rem;
  padding: 0.7rem 0.9rem;
  border: 1px solid var(--line);
  border-left: 3px solid var(--ok);
  border-radius: 8px;
  background: var(--surface);
}
.layer-card.bad {
  border-left-color: var(--bad);
}
.layer-card .ln {
  font-weight: 600;
  font-size: 0.85rem;
}
.layer-card .lc {
  font-family: var(--mono);
  font-size: 0.75rem;
  color: var(--muted);
}
.layer-card .lr {
  font-size: 0.85rem;
  color: var(--ok);
  font-weight: 600;
}
.layer-card.bad .lr {
  color: var(--bad);
}
.layer-card .lb {
  font-size: 0.72rem;
  color: var(--muted);
  line-height: 1.5;
}

.output {
  padding: 1rem 1.1rem;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface);
  display: grid;
  gap: 0.8rem;
}
.oh {
  display: flex;
  gap: 1.5rem;
  align-items: flex-start;
  justify-content: space-between;
}
.output h2 {
  margin: 0 0 0.25rem;
  font-size: 0.95rem;
}
.output p {
  margin: 0;
  max-width: 60ch;
  font-size: 0.8rem;
  color: var(--muted);
  line-height: 1.7;
}
.output button {
  flex: none;
  padding: 0.5rem 1rem;
  border: 1px solid var(--accent);
  border-radius: 8px;
  background: var(--accent);
  color: #fff;
  font: inherit;
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
}
.output button:disabled {
  opacity: 0.6;
  cursor: progress;
}
.files {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.4rem;
}
.files a {
  display: flex;
  align-items: baseline;
  gap: 0.6rem;
  padding: 0.45rem 0.7rem;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface-2);
  color: inherit;
  text-decoration: none;
  font-size: 0.85rem;
}
.files a:hover {
  border-color: var(--accent);
}
.files .fn {
  font-family: var(--mono);
  font-size: 0.78rem;
  color: var(--muted);
}
.files .fs {
  margin-left: auto;
  font-family: var(--mono);
  font-size: 0.75rem;
  color: var(--muted);
}

.tabs {
  display: flex;
  gap: 0.4rem;
  border-bottom: 1px solid var(--line);
}
.tabs button {
  display: grid;
  gap: 0.1rem;
  padding: 0.55rem 0.9rem;
  border: none;
  border-bottom: 2px solid transparent;
  background: none;
  font: inherit;
  font-weight: 600;
  color: var(--muted);
  cursor: pointer;
  text-align: left;
}
.tabs button small {
  font-weight: 400;
  font-size: 0.7rem;
  opacity: 0.8;
}
.tabs button.on {
  color: var(--accent);
  border-bottom-color: var(--accent);
}

.body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 1.5rem;
  align-items: start;
}
@media (max-width: 900px) {
  .body {
    grid-template-columns: 1fr;
  }
}
.missing {
  color: var(--muted);
  font-size: 0.85rem;
}

.skipped {
  padding: 0.9rem 1.1rem;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface-2);
}
.skipped h2 {
  margin: 0 0 0.35rem;
  font-size: 0.88rem;
  color: var(--warn);
}
.skipped p {
  margin: 0;
  font-size: 0.8rem;
  color: var(--muted);
  line-height: 1.8;
}
</style>
