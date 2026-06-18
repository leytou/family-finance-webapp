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

// 期间最低是否低于初始存款（告警色判定）
const minIsWarn = computed(() => m.value.minCum < props.initialDeposit)

interface Cell { label: string; value: string; sub?: string; tone: '' | 'pos' | 'neg' | 'warn' }
const cells = computed<Cell[]>(() => {
  const base: Cell[] = [
    {
      label: '最终累计',
      value: formatCurrency(m.value.finalCum),
      sub: props.initialDeposit > 0
        ? `较初始 ${((m.value.finalCum - props.initialDeposit) / props.initialDeposit * 100).toFixed(1)}%`
        : undefined,
      tone: '',
    },
    {
      label: '期间最低余额',
      value: formatCurrency(m.value.minCum),
      sub: m.value.minMonth ? monthToLabel(m.value.minMonth) : undefined,
      tone: minIsWarn.value ? 'warn' : '',
    },
    { label: '累计理财收益', value: formatCurrency(m.value.totalReturn), tone: 'pos' },
    { label: '累计总支出', value: formatCurrency(m.value.totalExpense), tone: 'neg' },
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
                'bg-brand': c.tone === '',
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
