<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'

import AnnualTable from './components/AnnualTable.vue'
import MonthlyTable from './components/MonthlyTable.vue'
import ScenarioTabs from './components/ScenarioTabs.vue'
import ComparisonView from './components/ComparisonView.vue'
import CalculatorView from './components/CalculatorView.vue'
import ToolsMenu from './components/ToolsMenu.vue'
import MonthPicker from './components/MonthPicker.vue'
import FinanceChart from './components/FinanceChart.vue'
import { calculate } from './composables/useCalculation'
import { useStore } from './composables/useStore'
import { useHistory } from './composables/useHistory'
import { monthDiff } from './utils/month'

const {
  data,
  setStartMonth,
  setEndMonth,
  enableFund,
  disableFund,
  setFundRate,
  setFundInterestMonth,
  setFundInitialBalance,
} = useStore()
const { undo, redo, canUndo, canRedo } = useHistory()

// 失焦当前输入框（触发进行中编辑的失焦提交），再执行撤销/重做
function blurActive() {
  ;(document.activeElement as HTMLElement | null)?.blur()
}

function doUndo() {
  blurActive()
  undo()
}

function doRedo() {
  blurActive()
  redo()
}

function onKeydown(e: KeyboardEvent) {
  const mod = e.ctrlKey || e.metaKey
  if (!mod) return
  const key = e.key.toLowerCase()
  if (key === 'z' && !e.shiftKey) {
    e.preventDefault()
    doUndo()
  } else if ((key === 'z' && e.shiftKey) || key === 'y') {
    e.preventDefault()
    doRedo()
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
const results = computed(() => calculate(data.value))

// 视图切换：table（默认） / chart（财务趋势图） / comparison（多方案对比），三态互斥
type ActiveView = 'table' | 'chart' | 'comparison' | 'calculator'
const activeView = ref<ActiveView>('table')

// 显式切换：三按钮各点击直接设置目标视图（取代旧 toggle）
function setActiveView(view: ActiveView) {
  activeView.value = view
}

const periodError = ref('')

// 起始月份：双向绑定桥接到 store 受控入口 setStartMonth；非法时显示内联提示、不写入
const startMonth = computed({
  get: () => data.value.systemParams.startMonth,
  set: (v: number) => {
    if (setStartMonth(v)) {
      periodError.value = ''
    } else {
      periodError.value = '起始月需早于结束月，且期限不超过 30 年'
    }
  },
})

// 结束月份：桥接到 setEndMonth；非法时显示内联提示、不写入
const endMonth = computed({
  get: () => data.value.systemParams.endMonth,
  set: (v: number) => {
    if (setEndMonth(v)) {
      periodError.value = ''
    } else {
      periodError.value = '结束月需晚于起始月，且期限不超过 30 年'
    }
  },
})

// 期限提示：「共 X 年」「共 X 年 Y 个月」「共 Y 个月」
const projectionText = computed(() => {
  const start = data.value.systemParams.startMonth
  const end = data.value.systemParams.endMonth
  const total = Math.max(1, monthDiff(start, end) + 1)
  const years = Math.floor(total / 12)
  const months = total % 12
  if (years === 0) return `共 ${months} 个月`
  if (months === 0) return `共 ${years} 年`
  return `共 ${years} 年 ${months} 个月`
})

// 公积金启用开关：勾选→enableFund，取消→disableFund（二次确认防误删）
const fundEnabled = computed(() => !!data.value.fund)
function onFundToggle(e: Event) {
  const checked = (e.target as HTMLInputElement).checked
  if (checked) {
    enableFund()
  } else {
    if (window.confirm('关闭公积金将清空所有缴存/月冲/提取/锚点配置，确定？')) {
      disableFund()
    } else {
      ;(e.target as HTMLInputElement).checked = true
    }
  }
}
</script>

<template>
  <div class="h-screen flex flex-col px-8 bg-white text-neutral-900">
    <header class="border-b flex-none">
      <!-- 第一行 · 导航层：标题 / 方案标签 / 视图三按钮 / 更多 -->
      <div class="h-12 flex items-center justify-between px-4">
        <div class="flex items-center gap-3">
          <h1 class="text-lg font-bold whitespace-nowrap">家庭财务规划</h1>
          <div class="border-l pl-3">
            <ScenarioTabs />
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button
            class="px-3 py-1 border rounded text-sm"
            :class="activeView === 'table' ? 'bg-brand-50 border-brand-200' : 'hover:bg-neutral-50'"
            type="button"
            @click="setActiveView('table')"
          >
            表格
          </button>
          <button
            class="px-3 py-1 border rounded text-sm"
            :class="activeView === 'chart' ? 'bg-brand-50 border-brand-200' : 'hover:bg-neutral-50'"
            type="button"
            @click="setActiveView('chart')"
          >
            图表
          </button>
          <button
            class="px-3 py-1 border rounded text-sm"
            :class="activeView === 'comparison' ? 'bg-brand-50 border-brand-200' : 'hover:bg-neutral-50'"
            type="button"
            @click="setActiveView('comparison')"
          >
            对比
          </button>
          <div class="border-l h-5 mx-2" />
          <button
            data-testid="calc-view-btn"
            class="px-3 py-1 border rounded text-sm"
            :class="activeView === 'calculator' ? 'bg-brand-50 border-brand-200' : 'hover:bg-neutral-50'"
            type="button"
            @click="setActiveView('calculator')"
          >
            🧮 计算器
          </button>
          <div class="border-l h-5 mx-2" />
          <button
            data-testid="undo-btn"
            class="px-3 py-1 border rounded text-sm whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-40"
            :class="canUndo ? 'hover:bg-neutral-50' : ''"
            type="button"
            :disabled="!canUndo"
            title="撤销 (Ctrl+Z)"
            @click="doUndo"
          >
            <span aria-hidden="true">↶</span>撤销
          </button>
          <button
            data-testid="redo-btn"
            class="px-3 py-1 border rounded text-sm whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-40"
            :class="canRedo ? 'hover:bg-neutral-50' : ''"
            type="button"
            :disabled="!canRedo"
            title="重做 (Ctrl+Shift+Z)"
            @click="doRedo"
          >
            <span aria-hidden="true">↷</span>重做
          </button>
          <div class="border-l h-5 mx-2" />
          <ToolsMenu />
        </div>
      </div>
      <!-- 第二行 · 参数层：参数标签 + 参数输入 / 撤销·重做（字体与表格同 11px，整体紧凑）-->
      <div v-if="activeView !== 'calculator'" data-testid="param-row" class="min-h-8 flex items-center gap-4 px-4 py-0.5 bg-neutral-50 border-t">
        <div class="flex flex-wrap items-center gap-x-3 gap-y-0.5">
          <span data-testid="param-row-label" class="text-[10px] uppercase tracking-wide text-neutral-400 border-r pr-3">参数</span>
          <div class="flex items-center gap-2">
            <label for="start-month" class="text-[11px] whitespace-nowrap">起始月份</label>
            <MonthPicker v-model="startMonth" input-id="start-month" />
          </div>
          <div class="flex items-center gap-2">
            <label for="end-month" class="text-[11px] whitespace-nowrap">结束月份</label>
            <MonthPicker v-model="endMonth" input-id="end-month" />
            <span data-testid="projection-text" class="text-[11px] text-neutral-400 whitespace-nowrap">{{ projectionText }}</span>
          </div>
          <span v-if="periodError" data-testid="end-month-error" class="text-[11px] text-negative-600 whitespace-nowrap">{{ periodError }}</span>
          <div class="flex items-center gap-2">
            <label class="text-[11px] whitespace-nowrap">年化收益率(%)</label>
            <input
              :value="(data.systemParams.annualRate * 100).toFixed(3)"
              @input="(e: Event) => { const target = e.target as HTMLInputElement; data.systemParams.annualRate = Number(target.value) / 100 }"
              type="number"
              step="0.001"
              class="border rounded px-2 py-0.5 text-[11px] w-[85px]"
            />
          </div>
          <div class="flex items-center gap-2">
            <label class="text-[11px] whitespace-nowrap">初始存款</label>
            <input
              v-model.number="data.systemParams.initialDeposit"
              type="number"
              class="border rounded px-2 py-0.5 text-[11px] w-24"
              placeholder="元"
            />
          </div>
          <!-- 公积金子分组：另起一行展示；仅 fund 启用时显示 3 输入 -->
          <div class="flex items-center gap-2 w-full">
            <label class="text-[11px] whitespace-nowrap flex items-center gap-1">
              <input
                data-testid="fund-enable-toggle"
                type="checkbox"
                :checked="fundEnabled"
                @change="onFundToggle"
              />
              公积金
            </label>
            <template v-if="fundEnabled">
              <label class="text-[11px] whitespace-nowrap">年利率(%)</label>
              <input
                data-testid="fund-rate-input"
                :value="(data.systemParams.fundRate * 100).toFixed(1)"
                @input="(e: Event) => setFundRate(Number((e.target as HTMLInputElement).value) / 100)"
                type="number"
                step="0.1"
                class="border rounded px-2 py-0.5 text-[11px] w-[85px]"
              />
              <label class="text-[11px] whitespace-nowrap">结息月</label>
              <input
                data-testid="fund-interest-month-input"
                :value="data.systemParams.fundInterestMonth"
                @input="(e: Event) => setFundInterestMonth(Math.round(Number((e.target as HTMLInputElement).value)))"
                type="number"
                min="1"
                max="12"
                class="border rounded px-2 py-0.5 text-[11px] w-12"
              />
              <label class="text-[11px] whitespace-nowrap">初始余额</label>
              <input
                data-testid="fund-initial-balance-input"
                :value="data.systemParams.fundInitialBalance ?? 0"
                @input="(e: Event) => setFundInitialBalance(Number((e.target as HTMLInputElement).value))"
                type="number"
                class="border rounded px-2 py-0.5 text-[11px] w-24"
                placeholder="元"
              />
            </template>
          </div>
        </div>
      </div>
    </header>
    <main class="flex-1 flex flex-col overflow-hidden">
      <template v-if="activeView === 'comparison'">
        <div class="flex-1 overflow-auto">
          <ComparisonView @close="activeView = 'table'" />
        </div>
      </template>
      <template v-else-if="activeView === 'chart'">
        <div class="flex-1">
          <FinanceChart :results="results" />
        </div>
      </template>
      <template v-else-if="activeView === 'calculator'">
        <div class="flex-1 overflow-auto">
          <CalculatorView />
        </div>
      </template>
      <template v-else>
        <div class="flex-none max-h-[35%] overflow-auto border-b">
          <AnnualTable :results="results" />
        </div>
        <div class="flex-1 overflow-auto">
          <MonthlyTable :results="results" />
        </div>
      </template>
    </main>
  </div>
</template>
