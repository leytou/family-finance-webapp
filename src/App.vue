<script setup lang="ts">
import { computed } from 'vue'

import AnnualTable from './components/AnnualTable.vue'
import MonthlyTable from './components/MonthlyTable.vue'
import ParamPanel from './components/ParamPanel.vue'
import { calculate } from './composables/useCalculation'
import { useStore } from './composables/useStore'

const { data } = useStore()
const results = computed(() => calculate(data.value))
</script>

<template>
  <div class="h-screen flex flex-col">
    <header class="h-12 flex items-center px-4 border-b">
      <h1 class="text-lg font-bold">家庭财务规划</h1>
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
