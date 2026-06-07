<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'

import FormulaPopover from './FormulaPopover.vue'
import type { MonthResult } from '../types'
import { formatCurrency } from '../utils/format'
import { formatMonth } from '../utils/month'

type FormulaField = 'investReturn' | 'netSavings' | 'cumSavings'

const props = defineProps<{
  results: MonthResult[]
}>()

const emit = defineEmits<{
  'update-anchor': [month: number, value: number]
  'remove-anchor': [month: number]
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

const editingMonth = ref<number | null>(null)
const editValue = ref<string>('')
const editInput = ref<HTMLInputElement | null>(null)

function startEdit(result: MonthResult) {
  editingMonth.value = result.month
  editValue.value = String(result.cumSavings)
  nextTick(() => {
    if (editInput.value && typeof editInput.value.select === 'function') {
      editInput.value.select()
    }
  })
}

function confirmEdit(month: number) {
  if (editingMonth.value === null) return
  const trimmed = editValue.value.trim()
  if (trimmed === '') {
    emit('remove-anchor', month)
  } else {
    const num = Number(trimmed)
    if (Number.isFinite(num)) {
      emit('update-anchor', month, num)
    }
  }
  editingMonth.value = null
}

function cancelEdit() {
  editingMonth.value = null
  editValue.value = ''
}
</script>

<template>
  <div class="h-full overflow-auto border rounded bg-white">
    <table class="min-w-full border-collapse text-[11px] leading-tight">
      <thead class="sticky top-0 z-1 bg-gray-50">
        <tr class="border-b">
          <th class="px-1 py-0 text-left font-semibold whitespace-nowrap">月份</th>
          <th
            v-for="name in allIncomeNames"
            :key="`income-${name}`"
            class="px-1 py-0 text-right tabular-nums font-semibold text-green-700 whitespace-nowrap"
          >
            {{ name }}
          </th>
          <th
            v-for="name in allExpenseNames"
            :key="`expense-${name}`"
            class="px-1 py-0 text-right tabular-nums font-semibold text-red-700 whitespace-nowrap"
          >
            {{ name }}
          </th>
          <th class="px-1 py-0 text-right tabular-nums font-semibold whitespace-nowrap">理财</th>
          <th class="px-1 py-0 text-right tabular-nums font-semibold whitespace-nowrap">净储蓄</th>
          <th class="px-1 py-0 text-right tabular-nums font-semibold whitespace-nowrap">累计</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="result in results"
          :key="result.month"
          class="border-b hover:bg-gray-50"
          :class="{ 'bg-blue-50': result.isAnchor }"
        >
          <td class="px-1 py-0 whitespace-nowrap">{{ formatMonth(result.month) }}</td>
          <td
            v-for="name in allIncomeNames"
            :key="`income-${result.month}-${name}`"
            class="px-1 py-0 text-right tabular-nums whitespace-nowrap"
            :class="{ 'text-red-600': getItemAmount(result, name, 'income') < 0 }"
          >
            {{ formatCurrency(getItemAmount(result, name, 'income')) }}
          </td>
          <td
            v-for="name in allExpenseNames"
            :key="`expense-${result.month}-${name}`"
            class="px-1 py-0 text-right tabular-nums whitespace-nowrap"
            :class="{ 'text-red-600': getItemAmount(result, name, 'expense') < 0 }"
          >
            {{ formatCurrency(getItemAmount(result, name, 'expense')) }}
          </td>
          <td
            class="px-1 py-0 text-right tabular-nums whitespace-nowrap"
            :class="{ 'text-red-600': result.investReturn < 0 }"
          >
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
            class="px-1 py-0 text-right tabular-nums whitespace-nowrap"
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
          <td
            class="px-1 py-0 text-right tabular-nums font-bold whitespace-nowrap"
            :class="{ 'text-red-600': result.cumSavings < 0 }"
          >
            <input
              v-if="editingMonth === result.month"
              ref="editInput"
              type="number"
              class="w-full h-full border rounded px-1 text-right text-[11px]"
              :value="editValue"
              @input="editValue = ($event.target as HTMLInputElement).value"
              @keyup.enter="confirmEdit(result.month)"
              @keyup.escape="cancelEdit"
              @blur="confirmEdit(result.month)"
            />
            <span
              v-else
              class="block w-full cursor-pointer text-right"
              :aria-label="`编辑 ${formatMonth(result.month)} 累计储蓄`"
              @click="startEdit(result)"
              @mouseenter="showFormula(result, 'cumSavings', $event)"
              @mouseleave="popover = null"
            >
              {{ formatCurrency(result.cumSavings) }}
            </span>
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
