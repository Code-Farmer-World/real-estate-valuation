<script setup lang="ts">
/**
 * 主畫面：上傳查估書表 PDF → 三張表 → 點格子看依據 → 審查結論。
 */
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'

import EvidencePanel from '@/components/EvidencePanel.vue'
import Table1Panel from '@/components/Table1Panel.vue'
import Table4Panel from '@/components/Table4Panel.vue'
import Table52Panel from '@/components/Table52Panel.vue'
import { useCaseStore } from '@/stores/case'

const store = useCaseStore()
const { fileName, parsed, computed: result, reviewed, loading, errorMessage } = storeToRefs(store)
const { table1, table52, table4, firstComparable, correctionsByFactor } = storeToRefs(store)

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
        上傳查估書表 PDF，系統辨識表1、表5-2、表4，依評價基準明細表重算，
        逐格比對估價師填的值。<b>每個數字都指得回來源，沒有任何一個是模型生成的。</b>
      </p>
    </header>

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
        <span class="hint">或點一下選檔。範本在 real-estate-valuation-doc/查估書表範本.pdf</span>
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
        <div class="card" :class="reviewed?.verdict">
          <span class="k">審查結論</span>
          <span class="v">{{ reviewed?.verdict === 'match' ? '相符' : `${reviewed?.finding_count} 處不符` }}</span>
          <span class="unit">逐格比對 {{ reviewed?.checked_total }} 格</span>
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
  </div>
</template>

<style scoped>
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
