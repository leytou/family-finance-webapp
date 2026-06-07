<script setup lang="ts">
import { computed } from 'vue'

import type { MonthResult } from '../types'
import { formatCurrency } from '../utils/format'

interface AnnualItemSummary {
  name: string
  total: number
}

interface YearSummary {
  year: number
  startSavings: number
  incomeItems: AnnualItemSummary[]
  totalIncome: number
  expenseItems: AnnualItemSummary[]
  totalExpense: number
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
      const incomeItems = sumItems(sortedMonths.flatMap((result) => result.incomeItems))
      const expenseItems = sumItems(sortedMonths.flatMap((result) => result.expenseItems))
      const investReturn = sortedMonths.reduce((sum, result) => sum + result.investReturn, 0)
      const incomeTotal = incomeItems.reduce((sum, item) => sum + item.total, 0)
      const totalExpense = expenseItems.reduce((sum, item) => sum + item.total, 0)
      const totalIncome = incomeTotal + investReturn

      return {
        year,
        startSavings: previousResult?.cumSavings ?? firstResult.cumSavings - firstResult.netSavings,
        incomeItems,
        totalIncome,
        expenseItems,
        totalExpense,
        investReturn,
        yearBalance: totalIncome - totalExpense,
        endSavings: lastResult.cumSavings,
      }
    })
})

const allIncomeNames = computed(() => {
  return uniqueNames(yearSummaries.value.flatMap((summary) => summary.incomeItems))
})

const allExpenseNames = computed(() => {
  return uniqueNames(yearSummaries.value.flatMap((summary) => summary.expenseItems))
})

function sumItems(items: { name: string; amount: number }[]): AnnualItemSummary[] {
  const totals = new Map<string, number>()

  for (const item of items) {
    totals.set(item.name, (totals.get(item.name) ?? 0) + item.amount)
  }

  return Array.from(totals.entries()).map(([name, total]) => ({ name, total }))
}

function uniqueNames(items: { name: string }[]): string[] {
  return Array.from(new Set(items.map((item) => item.name)))
}

function getItemTotal(summary: YearSummary, name: string, type: 'income' | 'expense'): number {
  const items = type === 'income' ? summary.incomeItems : summary.expenseItems

  return items.find((item) => item.name === name)?.total ?? 0
}
</script>

<template>
  <div class="h-full overflow-auto border rounded bg-white">
    <table class="min-w-full border-collapse text-sm">
      <thead class="sticky top-0 z-1 bg-gray-50">
        <tr class="border-b">
          <th class="px-3 py-2 text-left font-semibold whitespace-nowrap">项目</th>
          <th
            v-for="summary in yearSummaries"
            :key="summary.year"
            class="px-3 py-2 text-right font-semibold whitespace-nowrap"
          >
            {{ summary.year }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr class="border-b hover:bg-gray-50">
          <td class="px-3 py-2 whitespace-nowrap">年初储蓄</td>
          <td
            v-for="summary in yearSummaries"
            :key="`start-${summary.year}`"
            class="px-3 py-2 text-right whitespace-nowrap"
          >
            {{ formatCurrency(summary.startSavings) }}
          </td>
        </tr>

        <tr v-for="name in allIncomeNames" :key="`income-${name}`" class="border-b hover:bg-gray-50">
          <td class="px-3 py-2 text-green-700 whitespace-nowrap">{{ name }}</td>
          <td
            v-for="summary in yearSummaries"
            :key="`income-${summary.year}-${name}`"
            class="px-3 py-2 text-right whitespace-nowrap"
          >
            {{ formatCurrency(getItemTotal(summary, name, 'income')) }}
          </td>
        </tr>

        <tr class="border-b hover:bg-gray-50">
          <td class="px-3 py-2 text-green-700 whitespace-nowrap">理财收益</td>
          <td
            v-for="summary in yearSummaries"
            :key="`invest-${summary.year}`"
            class="px-3 py-2 text-right whitespace-nowrap"
          >
            {{ formatCurrency(summary.investReturn) }}
          </td>
        </tr>

        <tr class="border-b font-semibold hover:bg-gray-50">
          <td class="px-3 py-2 whitespace-nowrap">收入合计</td>
          <td
            v-for="summary in yearSummaries"
            :key="`income-total-${summary.year}`"
            class="px-3 py-2 text-right whitespace-nowrap"
          >
            {{ formatCurrency(summary.totalIncome) }}
          </td>
        </tr>

        <tr v-for="name in allExpenseNames" :key="`expense-${name}`" class="border-b hover:bg-gray-50">
          <td class="px-3 py-2 text-red-700 whitespace-nowrap">{{ name }}</td>
          <td
            v-for="summary in yearSummaries"
            :key="`expense-${summary.year}-${name}`"
            class="px-3 py-2 text-right whitespace-nowrap"
          >
            {{ formatCurrency(getItemTotal(summary, name, 'expense')) }}
          </td>
        </tr>

        <tr class="border-b font-semibold hover:bg-gray-50">
          <td class="px-3 py-2 whitespace-nowrap">支出合计</td>
          <td
            v-for="summary in yearSummaries"
            :key="`expense-total-${summary.year}`"
            class="px-3 py-2 text-right whitespace-nowrap"
          >
            {{ formatCurrency(summary.totalExpense) }}
          </td>
        </tr>

        <tr class="border-b font-semibold hover:bg-gray-50">
          <td class="px-3 py-2 whitespace-nowrap">年度结余</td>
          <td
            v-for="summary in yearSummaries"
            :key="`balance-${summary.year}`"
            class="px-3 py-2 text-right whitespace-nowrap"
            :class="{ 'text-red-600': summary.yearBalance < 0 }"
          >
            {{ formatCurrency(summary.yearBalance) }}
          </td>
        </tr>

        <tr class="border-b bg-gray-50 font-bold">
          <td class="px-3 py-2 whitespace-nowrap">年末储蓄</td>
          <td
            v-for="summary in yearSummaries"
            :key="`end-${summary.year}`"
            class="px-3 py-2 text-right whitespace-nowrap"
          >
            {{ formatCurrency(summary.endSavings) }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
