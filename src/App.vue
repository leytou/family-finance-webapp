<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'

import AnnualTable from './components/AnnualTable.vue'
import MonthlyTable from './components/MonthlyTable.vue'
import ScenarioTabs from './components/ScenarioTabs.vue'
import ComparisonView from './components/ComparisonView.vue'
import ToolsMenu from './components/ToolsMenu.vue'
import MonthPicker from './components/MonthPicker.vue'
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

// 对比视图切换
const showComparison = ref(false)

// 起始月份：双向绑定桥接到 store 受控入口 setStartMonth（选出的值恒合法，原样写入）
const startMonth = computed({
  get: () => data.value.systemParams.startMonth,
  set: (v: number) => { setStartMonth(v) },
})
</script>

<template>
  <div class="h-screen flex flex-col px-8">
    <header class="h-12 flex items-center justify-between px-4 border-b">
      <div class="flex items-center gap-3">
        <h1 class="text-lg font-bold whitespace-nowrap">家庭财务规划</h1>
        <div class="border-l pl-3">
          <ScenarioTabs />
        </div>
      </div>
      <div class="flex items-center gap-4">
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
        <ToolsMenu />
        <button
          data-testid="undo-btn"
          class="px-3 py-1 border rounded text-sm disabled:cursor-not-allowed disabled:opacity-40"
          :class="canUndo ? 'hover:bg-gray-50' : ''"
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
          :class="canRedo ? 'hover:bg-gray-50' : ''"
          type="button"
          :disabled="!canRedo"
          title="重做 (Ctrl+Shift+Z)"
          @click="doRedo"
        >
          <span aria-hidden="true">↷</span>重做
        </button>
        <button
          class="px-3 py-1 border rounded text-sm"
          :class="showComparison ? 'bg-blue-100 border-blue-300' : 'hover:bg-gray-50'"
          type="button"
          @click="showComparison = !showComparison"
        >
          对比
        </button>
      </div>
    </header>
    <main class="flex-1 flex flex-col overflow-hidden">
      <template v-if="showComparison">
        <div class="flex-1 overflow-auto">
          <ComparisonView @close="showComparison = false" />
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
