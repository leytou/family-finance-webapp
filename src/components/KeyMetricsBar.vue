<script setup lang="ts">
import { computed } from 'vue'
import type { MonthResult } from '../types'
import { computeKeyMetrics } from '../utils/keyMetrics'
import { formatCurrency } from '../utils/format'
import { monthToLabel } from '../utils/month'

const props = defineProps<{
  results: MonthResult[]
  fundEnabled: boolean
  initialDeposit: number
}>()

const m = computed(() => computeKeyMetrics(props.results, props.fundEnabled))

interface Cell { label: string; value: string; sub?: string; tone: '' | 'pos' | 'neg' | 'warn' }
const cells = computed<Cell[]>(() => {
  // 月均净存入 = (期末累计 − 初始本金 − 理财收益) ÷ 月数，即平均每月靠结余存下的钱
  const monthCount = props.results.length
  const monthlyAvg = monthCount > 0
    ? (m.value.finalCum - props.initialDeposit - m.value.totalReturn) / monthCount
    : 0
  const base: Cell[] = [
    {
      label: '期末存款',
      value: formatCurrency(m.value.finalCum),
      sub: monthCount > 0 ? `月均净存入 ¥${formatCurrency(monthlyAvg)}` : undefined,
      tone: '',
    },
    {
      label: '期间最低存款',
      value: formatCurrency(m.value.minCum),
      sub: m.value.minMonth ? monthToLabel(m.value.minMonth) : undefined,
      tone: '',
    },
    { label: '累计总收入', value: formatCurrency(m.value.totalIncome), tone: 'pos' },
    { label: '累计总支出', value: formatCurrency(m.value.totalExpense), tone: 'neg' },
    { label: '累计理财收益', value: formatCurrency(m.value.totalReturn), tone: 'pos' },
  ]
  if (m.value.fundBalance !== null) {
    base.push({ label: '公积金期末余额', value: formatCurrency(m.value.fundBalance), tone: 'warn' })
  }
  return base
})
</script>

<template>
  <div class="grid border-b border-line bg-surface"
       :style="{ gridTemplateColumns: `repeat(${cells.length}, 1fr)` }">
    <div v-for="(c, i) in cells" :key="c.label"
         class="px-4 py-3"
         :class="i < cells.length - 1 ? 'border-r border-line-soft' : ''">
      <div class="font-mono text-[9.5px] tracking-[0.16em] uppercase text-ink-3 flex items-center gap-1.5">
        <span class="inline-block w-1.5 h-1.5 rounded-full"
              :class="{
                'bg-ink': c.tone === '',
                'bg-positive-600': c.tone === 'pos',
                'bg-negative-600': c.tone === 'neg',
                'bg-warning-600': c.tone === 'warn',
              }" />
        {{ c.label }}
      </div>
      <div class="font-mono text-[22px] font-bold mt-1 tabular-nums"
           :class="{
             'text-ink': c.tone === '',
             'text-positive-600': c.tone === 'pos',
             'text-negative-600': c.tone === 'neg',
             'text-warning-600': c.tone === 'warn',
           }">
        <span class="text-ink-3 text-[13px] font-medium mr-0.5">¥</span>{{ c.value }}
      </div>
      <div v-if="c.sub" class="font-mono text-[10px] text-ink-3 mt-0.5">{{ c.sub }}</div>
    </div>
  </div>
</template>
