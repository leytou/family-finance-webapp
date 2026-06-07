<script setup lang="ts">
import { computed, ref } from 'vue'

import FormulaPopover from './FormulaPopover.vue'
import type { MonthResult } from '../types'
import { formatCurrency } from '../utils/format'
import { formatMonth } from '../utils/month'

type FormulaField = 'investReturn' | 'netSavings' | 'cumSavings'

const props = defineProps<{
  results: MonthResult[]
}>()

const popover = ref<{
  result: MonthResult
  field: FormulaField
  x: number
  y: number
} | null>(null)

const formulaLabels: Record<FormulaField, string> = {
  investReturn: '理财收益',
  netSavings: '净储蓄',
  cumSavings: '累计储蓄',
}

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

function showFormula(result: MonthResult, field: FormulaField, event: MouseEvent): void {
  popover.value = {
    result,
    field,
    x: event.clientX + 10,
    y: event.clientY + 10,
  }
}

function getFormulaAriaLabel(result: MonthResult, field: FormulaField): string {
  return `查看 ${formatMonth(result.month)} ${formulaLabels[field]}公式`
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
          <td class="px-3 py-2 text-right whitespace-nowrap">
            <button
              type="button"
              class="block w-full cursor-pointer border-0 bg-transparent p-0 text-right text-inherit"
              :aria-label="getFormulaAriaLabel(result, 'investReturn')"
              style="font: inherit"
              @click="showFormula(result, 'investReturn', $event)"
              @mouseleave="popover = null"
            >
              {{ formatCurrency(result.investReturn) }}
            </button>
          </td>
          <td
            class="px-3 py-2 text-right whitespace-nowrap"
            :class="{ 'text-red-600': result.netSavings < 0 }"
          >
            <button
              type="button"
              class="block w-full cursor-pointer border-0 bg-transparent p-0 text-right text-inherit"
              :aria-label="getFormulaAriaLabel(result, 'netSavings')"
              style="font: inherit"
              @click="showFormula(result, 'netSavings', $event)"
              @mouseleave="popover = null"
            >
              {{ formatCurrency(result.netSavings) }}
            </button>
          </td>
          <td class="px-3 py-2 text-right font-bold whitespace-nowrap">
            <button
              type="button"
              class="block w-full cursor-pointer border-0 bg-transparent p-0 text-right text-inherit"
              :aria-label="getFormulaAriaLabel(result, 'cumSavings')"
              style="font: inherit"
              @click="showFormula(result, 'cumSavings', $event)"
              @mouseleave="popover = null"
            >
              {{ formatCurrency(result.cumSavings) }}
            </button>
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
