<script setup lang="ts">
import { computed } from 'vue'

import AnnualTable from './components/AnnualTable.vue'
import MonthlyTable from './components/MonthlyTable.vue'
import ParamPanel from './components/ParamPanel.vue'
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
  if (confirm('确定要重置所有数据？此操作不可撤销。')) {
    reset()
  }
}
</script>

<template>
  <div class="h-screen flex flex-col">
    <header class="h-12 flex items-center justify-between px-4 border-b">
      <h1 class="text-lg font-bold">家庭财务规划</h1>
      <div class="flex items-center gap-2">
        <button class="px-3 py-1 border rounded text-sm hover:bg-gray-50" type="button" @click="handleExport">
          导出
        </button>
        <button class="px-3 py-1 border rounded text-sm hover:bg-gray-50" type="button" @click="handleReset">
          重置
        </button>
      </div>
    </header>
    <main class="flex-1 flex overflow-hidden">
      <aside class="w-80 border-r overflow-y-auto p-4">
        <ParamPanel />
      </aside>
      <section class="flex-1 flex flex-col overflow-hidden p-4">
        <AnnualTable :results="results" class="max-h-[40%]" />
        <MonthlyTable :results="results" class="flex-1" />
      </section>
    </main>
  </div>
</template>
