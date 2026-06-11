<script setup lang="ts">
import { computed } from 'vue'

import type { MonthResult } from '../types'
import { formatCurrency } from '../utils/format'

interface ColumnSummary {
  name: string
  total: number
}

interface YearSummary {
  year: number
  startSavings: number
  columnSummaries: ColumnSummary[]
  totalFlow: number
  investReturn: number
  yearBalance: number
  endSavings: number
}

const props = defineProps<{
  results: MonthResult[]
}>()

const yearSummaries = computed<YearSummary[]>(() => {
  const sortedResults = [...props.results].sort((left, right) => left.month - right.month)
  const groups = new Map<number, { months: MonthResult[]; previousResult?: MonthResult }>()

  sortedResults.forEach((result, index) => {
    const year = Math.floor(result.month / 100)
    const group = groups.get(year)

    if (group) {
      group.months.push(result)
    } else {
      groups.set(year, {
        months: [result],
        previousResult: sortedResults[index - 1],
      })
    }
  })

  return Array.from(groups.entries())
    .sort(([leftYear], [rightYear]) => leftYear - rightYear)
    .map(([year, group]) => {
      const { months, previousResult } = group
      const sortedMonths = [...months].sort((left, right) => left.month - right.month)
      const firstResult = sortedMonths[0]
      const lastResult = sortedMonths[sortedMonths.length - 1]

      // 聚合所有列的年度总额
      const columnSummaries = sumColumnValues(sortedMonths.flatMap((result) => result.columnValues))

      // 计算总现金流（所有列金额之和）
      const totalFlow = columnSummaries.reduce((sum, col) => sum + col.total, 0)

      // 计算理财收益总和
      const investReturn = sortedMonths.reduce((sum, result) => sum + result.investReturn, 0)

      return {
        year,
        startSavings: getStartSavings(firstResult, previousResult),
        columnSummaries,
        totalFlow,
        investReturn,
        yearBalance: totalFlow + investReturn,
        endSavings: lastResult.cumSavings,
      }
    })
})

// 获取所有出现的列名
const allColumnNames = computed(() => {
  return uniqueNames(yearSummaries.value.flatMap((summary) => summary.columnSummaries))
})

function sumColumnValues(
  items: { name: string; amount: number }[]
): ColumnSummary[] {
  const totals = new Map<string, number>()

  for (const item of items) {
    totals.set(item.name, (totals.get(item.name) ?? 0) + item.amount)
  }

  return Array.from(totals.entries()).map(([name, total]) => ({ name, total }))
}

function uniqueNames(items: { name: string }[]): string[] {
  return Array.from(new Set(items.map((item) => item.name)))
}

function getStartSavings(firstResult: MonthResult, previousResult?: MonthResult): number {
  if (previousResult) {
    return previousResult.cumSavings
  }

  if (firstResult.isAnchor) {
    return firstResult.cumSavings
  }

  return firstResult.cumSavings - firstResult.monthlyBalance
}

function getColumnTotal(summary: YearSummary, name: string): number {
  return summary.columnSummaries.find((col) => col.name === name)?.total ?? 0
}
</script>

<template>
  <div class="h-full overflow-auto border rounded bg-white">
    <table class="min-w-full border-collapse text-[11px] leading-tight">
      <thead class="sticky top-0 z-1 bg-gray-50">
        <tr class="border-b">
          <th class="px-1 py-0 text-left font-semibold whitespace-nowrap">项目</th>
          <th
            v-for="summary in yearSummaries"
            :key="summary.year"
            class="px-1 py-0 text-right tabular-nums font-semibold whitespace-nowrap"
          >
            {{ summary.year }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr class="border-b hover:bg-gray-50">
          <td class="px-1 py-0 whitespace-nowrap">年初存款</td>
          <td
            v-for="summary in yearSummaries"
            :key="`start-${summary.year}`"
            class="px-1 py-0 text-right tabular-nums whitespace-nowrap"
            :class="{ 'italic': summary.startSavings < 0 }"
          >
            {{ formatCurrency(summary.startSavings) }}
          </td>
        </tr>

        <tr v-for="name in allColumnNames" :key="`col-${name}`" class="border-b hover:bg-gray-50">
          <td class="px-1 py-0 whitespace-nowrap">{{ name }}</td>
          <td
            v-for="summary in yearSummaries"
            :key="`col-${summary.year}-${name}`"
            class="px-1 py-0 text-right tabular-nums whitespace-nowrap"
            :class="{
              'italic': getColumnTotal(summary, name) < 0
            }"
          >
            {{ formatCurrency(getColumnTotal(summary, name)) }}
          </td>
        </tr>

        <tr class="border-b hover:bg-gray-50">
          <td class="px-1 py-0 whitespace-nowrap">理财收益</td>
          <td
            v-for="summary in yearSummaries"
            :key="`invest-${summary.year}`"
            class="px-1 py-0 text-right tabular-nums whitespace-nowrap"
            :class="{ 'italic': summary.investReturn < 0 }"
          >
            {{ formatCurrency(summary.investReturn) }}
          </td>
        </tr>

        <tr class="border-b font-semibold hover:bg-gray-50">
          <td class="px-1 py-0 whitespace-nowrap">年度结余</td>
          <td
            v-for="summary in yearSummaries"
            :key="`balance-${summary.year}`"
            class="px-1 py-0 text-right tabular-nums whitespace-nowrap"
            :class="{ 'italic': summary.yearBalance < 0 }"
          >
            {{ formatCurrency(summary.yearBalance) }}
          </td>
        </tr>

        <tr class="border-b bg-gray-50 font-bold">
          <td class="px-1 py-0 whitespace-nowrap">年末存款</td>
          <td
            v-for="summary in yearSummaries"
            :key="`end-${summary.year}`"
            class="px-1 py-0 text-right tabular-nums whitespace-nowrap"
            :class="{ 'italic': summary.endSavings < 0 }"
          >
            {{ formatCurrency(summary.endSavings) }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
