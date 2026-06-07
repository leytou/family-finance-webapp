<script setup lang="ts">
import type { MonthResult } from '../types'
import { formatCurrency } from '../utils/format'
import { formatMonth } from '../utils/month'

type FormulaField = 'investReturn' | 'monthlyBalance' | 'cumSavings'

const props = defineProps<{
  result: MonthResult
  field: FormulaField
  x: number
  y: number
}>()

const emit = defineEmits<{
  close: []
}>()

const formulaLabels: Record<FormulaField, string> = {
  investReturn: '理财收益',
  monthlyBalance: '本月结余',
  cumSavings: '余额',
}

function getFormula(): string {
  const r = props.result

  switch (props.field) {
    case 'investReturn':
      return '理财收益 = 上月累计储蓄 × 年利率 / 12'
    case 'monthlyBalance':
      return `本月结余 = 收入(${formatCurrency(r.monthlyIncome)}) - 支出(${formatCurrency(r.monthlyExpense)}) + 理财(${formatCurrency(r.investReturn)}) = ${formatCurrency(r.monthlyBalance)}`
    case 'cumSavings':
      if (r.isAnchor) {
        return `锚点月份，余额 = ${formatCurrency(r.cumSavings)}`
      }

      return `余额 = 上月余额 + 当月结余(${formatCurrency(r.monthlyBalance)})`
  }
}
</script>

<template>
  <div
    class="fixed z-50 max-w-96 border rounded bg-white p-3 text-sm shadow-lg"
    :style="{ left: `${x}px`, top: `${y}px` }"
    @mouseleave="emit('close')"
  >
    <div class="mb-2 font-semibold">{{ formatMonth(result.month) }} - {{ formulaLabels[field] }}</div>
    <div class="text-gray-700">{{ getFormula() }}</div>
  </div>
</template>
