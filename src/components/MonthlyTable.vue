<script setup lang="ts">
import { computed, ref } from 'vue'

import FormulaPopover from './FormulaPopover.vue'
import type { MonthResult } from '../types'
import { formatCurrency } from '../utils/format'
import { formatMonth } from '../utils/month'

const props = defineProps<{
  results: MonthResult[]
}>()

const popover = ref<{
  result: MonthResult
  field: string
  x: number
  y: number
} | null>(null)

const allIncomeNames = computed(() => {
  return uniqueNames(props.results.flatMap((result) => result.incomeItems))
})

const allExpenseNames = computed(() => {
  return uniqueNames(props.results.flatMap((result) => result.expenseItems))
})

function uniqueNames(items: { name: string }[]): string[] {
  return Array.from(new Set(items.map((item) => item.name)))
}

function getItemAmount(result: MonthResult, name: string, type: 'income' | 'expense'): number {
  const items = type === 'income' ? result.incomeItems : result.expenseItems

  return items.find((item) => item.name === name)?.amount ?? 0
}

function showFormula(result: MonthResult, field: string, event: MouseEvent): void {
  popover.value = {
    result,
    field,
    x: event.clientX + 10,
    y: event.clientY + 10,
  }
}
</script>

<template>
  <div class="h-full overflow-auto border rounded bg-white">
    <table class="min-w-full border-collapse text-sm">
      <thead class="sticky top-0 z-1 bg-gray-50">
        <tr class="border-b">
          <th class="px-3 py-2 text-left font-semibold whitespace-nowrap">月份</th>
          <th
            v-for="name in allIncomeNames"
            :key="`income-${name}`"
            class="px-3 py-2 text-right font-semibold text-green-700 whitespace-nowrap"
          >
            {{ name }}
          </th>
          <th
            v-for="name in allExpenseNames"
            :key="`expense-${name}`"
            class="px-3 py-2 text-right font-semibold text-red-700 whitespace-nowrap"
          >
            {{ name }}
          </th>
          <th class="px-3 py-2 text-right font-semibold whitespace-nowrap">理财</th>
          <th class="px-3 py-2 text-right font-semibold whitespace-nowrap">净储蓄</th>
          <th class="px-3 py-2 text-right font-semibold whitespace-nowrap">累计</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="result in results"
          :key="result.month"
          class="border-b hover:bg-gray-50"
          :class="{ 'bg-blue-50': result.isAnchor }"
        >
          <td class="px-3 py-2 whitespace-nowrap">{{ formatMonth(result.month) }}</td>
          <td
            v-for="name in allIncomeNames"
            :key="`income-${result.month}-${name}`"
            class="px-3 py-2 text-right whitespace-nowrap"
          >
            {{ formatCurrency(getItemAmount(result, name, 'income')) }}
          </td>
          <td
            v-for="name in allExpenseNames"
            :key="`expense-${result.month}-${name}`"
            class="px-3 py-2 text-right whitespace-nowrap"
          >
            {{ formatCurrency(getItemAmount(result, name, 'expense')) }}
          </td>
          <td
            class="px-3 py-2 text-right whitespace-nowrap cursor-pointer"
            @click="showFormula(result, 'investReturn', $event)"
          >
            {{ formatCurrency(result.investReturn) }}
          </td>
          <td
            class="px-3 py-2 text-right whitespace-nowrap cursor-pointer"
            :class="{ 'text-red-600': result.netSavings < 0 }"
            @click="showFormula(result, 'netSavings', $event)"
          >
            {{ formatCurrency(result.netSavings) }}
          </td>
          <td
            class="px-3 py-2 text-right font-bold whitespace-nowrap cursor-pointer"
            @click="showFormula(result, 'cumSavings', $event)"
          >
            {{ formatCurrency(result.cumSavings) }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
  <FormulaPopover
    v-if="popover"
    :result="popover.result"
    :field="popover.field"
    :x="popover.x"
    :y="popover.y"
    @close="popover = null"
  />
</template>
