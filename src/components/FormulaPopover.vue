<script setup lang="ts">
import type { MonthResult } from '../types'
import { formatCurrency } from '../utils/format'
import { formatMonth } from '../utils/month'

const props = defineProps<{
  result: MonthResult
  field: string
  x: number
  y: number
}>()

const emit = defineEmits<{
  close: []
}>()

function getFormula(): string {
  const r = props.result

  switch (props.field) {
    case 'investReturn':
      return '理财收益 = 上月累计储蓄 × 年利率 / 12'
    case 'netSavings':
      return `净储蓄 = 总收入(${formatCurrency(r.totalIncome)}) - 总支出(${formatCurrency(r.totalExpense)}) + 理财(${formatCurrency(r.investReturn)}) = ${formatCurrency(r.netSavings)}`
    case 'cumSavings':
      if (r.isAnchor) {
        return `锚点月份，实际储蓄 = ${formatCurrency(r.cumSavings)}`
      }

      return `累计储蓄 = 上月累计 + 当月净储蓄(${formatCurrency(r.netSavings)})`
    default:
      return ''
  }
}
</script>

<template>
  <div
    class="fixed z-50 max-w-96 border rounded bg-white p-3 text-sm shadow-lg"
    :style="{ left: `${x}px`, top: `${y}px` }"
    @mouseleave="emit('close')"
  >
    <div class="mb-2 font-semibold">{{ formatMonth(result.month) }} - {{ field }}</div>
    <div class="text-gray-700">{{ getFormula() }}</div>
  </div>
</template>
