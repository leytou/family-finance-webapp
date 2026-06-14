<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'

import AnnualTable from './components/AnnualTable.vue'
import MonthlyTable from './components/MonthlyTable.vue'
import ScenarioTabs from './components/ScenarioTabs.vue'
import ComparisonView from './components/ComparisonView.vue'
import ToolsMenu from './components/ToolsMenu.vue'
import MonthPicker from './components/MonthPicker.vue'
import FinanceChart from './components/FinanceChart.vue'
import { calculate } from './composables/useCalculation'
import { useStore } from './composables/useStore'
import { useHistory } from './composables/useHistory'

const { data, setStartMonth } = useStore()
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
type ActiveView = 'table' | 'chart' | 'comparison'
const activeView = ref<ActiveView>('table')

// 显式切换：三按钮各点击直接设置目标视图（取代旧 toggle）
function setActiveView(view: ActiveView) {
  activeView.value = view
}

// 起始月份：双向绑定桥接到 store 受控入口 setStartMonth（选出的值恒合法，原样写入）
const startMonth = computed({
  get: () => data.value.systemParams.startMonth,
  set: (v: number) => { setStartMonth(v) },
})
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
          <ToolsMenu />
        </div>
      </div>
      <!-- 第二行 · 操作层：参数标签 + 参数输入 / 撤销·重做 -->
      <div class="h-9 flex items-center justify-between px-4 bg-neutral-50 border-t">
        <div class="flex items-center gap-4">
          <span data-testid="param-row-label" class="text-[10px] uppercase tracking-wide text-neutral-400 border-r pr-3">参数</span>
          <div class="flex items-center gap-2">
            <label for="start-month" class="text-xs whitespace-nowrap">起始月份</label>
            <MonthPicker v-model="startMonth" input-id="start-month" />
          </div>
          <div class="flex items-center gap-2">
            <label class="text-xs whitespace-nowrap">年化收益率(%)</label>
            <input
              :value="(data.systemParams.annualRate * 100).toFixed(3)"
              @input="(e: Event) => { const target = e.target as HTMLInputElement; data.systemParams.annualRate = Number(target.value) / 100 }"
              type="number"
              step="0.001"
              class="border rounded px-2 py-1 text-sm w-20"
            />
          </div>
          <div class="flex items-center gap-2">
            <label class="text-xs whitespace-nowrap">初始存款</label>
            <input
              v-model.number="data.systemParams.initialDeposit"
              type="number"
              class="border rounded px-2 py-1 text-sm w-28"
              placeholder="元"
            />
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button
            data-testid="undo-btn"
            class="px-3 py-1 border rounded text-sm disabled:cursor-not-allowed disabled:opacity-40"
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
            class="px-3 py-1 border rounded text-sm disabled:cursor-not-allowed disabled:opacity-40"
            :class="canRedo ? 'hover:bg-neutral-50' : ''"
            type="button"
            :disabled="!canRedo"
            title="重做 (Ctrl+Shift+Z)"
            @click="doRedo"
          >
            <span aria-hidden="true">↷</span>重做
          </button>
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
