<script setup lang="ts">
import { computed } from 'vue'

import AnnualTable from './components/AnnualTable.vue'
import MonthlyTable from './components/MonthlyTable.vue'
import { calculate } from './composables/useCalculation'
import { useStore } from './composables/useStore'

const { data, reset, exportData } = useStore()
const results = computed(() => calculate(data.value))

function handleExport() {
  const blob = new Blob([exportData()], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')

  anchor.href = url
  anchor.download = 'finance-plan.json'
  anchor.click()
  URL.revokeObjectURL(url)
}

function handleReset() {
  if (window.confirm('确定要重置所有数据？此操作不可撤销。')) {
    reset()
  }
}
</script>

<template>
  <div class="h-screen flex flex-col px-8">
    <header class="h-12 flex items-center justify-between px-4 border-b">
      <h1 class="text-lg font-bold">家庭财务规划</h1>
      <div class="flex items-center gap-4">
        <div class="flex items-center gap-2">
          <label class="text-xs whitespace-nowrap">起始月份</label>
          <input
            v-model.number="data.systemParams.startMonth"
            type="number"
            class="border rounded px-2 py-1 text-sm w-24"
            placeholder="YYYYMM"
          />
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
        <button class="px-3 py-1 border rounded text-sm hover:bg-gray-50" type="button" @click="handleExport">
          导出
        </button>
        <button class="px-3 py-1 border rounded text-sm hover:bg-gray-50" type="button" @click="handleReset">
          重置
        </button>
      </div>
    </header>
    <main class="flex-1 flex flex-col overflow-hidden">
      <div class="flex-none max-h-[35%] overflow-auto border-b">
        <AnnualTable :results="results" />
      </div>
      <div class="flex-1 overflow-auto">
        <MonthlyTable :results="results" />
      </div>
    </main>
  </div>
</template>
