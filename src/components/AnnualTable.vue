<script setup lang="ts">
import { computed, ref } from 'vue'

import FormulaPopover from './FormulaPopover.vue'
import type { MonthResult, YearSummary, ColumnSummary } from '../types'
import { formatCurrency } from '../utils/format'
import { buildYearFormula, type YearFormulaField, type YearFormulaContext } from '../utils/formula'
import { computePopoverX } from '../utils/popover'
import { useStore } from '../composables/useStore'
import { resolveColumnValue } from '../composables/useCalculation'

const props = defineProps<{
  results: MonthResult[]
}>()

const store = useStore()

const fund = computed(() => store.data.value.fund)

// 专项事件按年聚合（供专项行 hover 公式使用）
const eventsByYear = computed(() => {
  const map = new Map<number, { name: string; amount: number }[]>()
  for (const e of store.data.value.events) {
    const year = Math.floor(e.month / 100)
    const arr = map.get(year) ?? []
    arr.push({ name: e.name, amount: e.amount })
    map.set(year, arr)
  }
  return map
})

// hover 公式弹窗状态
const popover = ref<{ title: string; lines: string[]; x: number; y: number } | null>(null)

// 首年首月是否为锚点（供 startSavings 首年公式区分锚点/初始存款）
function isFirstMonthAnchor(): boolean {
  if (yearSummaries.value.length === 0) return false
  const firstYear = yearSummaries.value[0].year
  const firstYearMonths = props.results.filter(r => Math.floor(r.month / 100) === firstYear)
  if (firstYearMonths.length === 0) return false
  const firstMonth = Math.min(...firstYearMonths.map(r => r.month))
  return props.results.find(r => r.month === firstMonth)?.isAnchor ?? false
}

function showYearFormula(summary: YearSummary, field: YearFormulaField, event: MouseEvent): void {
  const idx = yearSummaries.value.findIndex(s => s.year === summary.year)
  const ctx: YearFormulaContext = {
    isFirstYear: idx === 0,
    firstMonthIsAnchor: idx === 0 && isFirstMonthAnchor(),
    initialDeposit: store.data.value.systemParams.initialDeposit ?? 0,
    prevYearEndSavings: idx > 0 ? yearSummaries.value[idx - 1].endSavings : 0,
    events: eventsByYear.value.get(summary.year) ?? [],
    yearEndFundBalance: summary.fundBalance ?? 0,
    yearMortgage: summary.yearMortgage ?? 0,
    yearFundInflow: summary.yearFundInflow ?? 0,
  }
  const { title, lines } = buildYearFormula(summary, field, ctx)
  popover.value = { title, lines, x: computePopoverX(event.clientX), y: event.clientY + 10 }
}

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

      // 仅聚合启用列；缺省(undefined)视为启用，禁用列既不单独成行也不计入年度总额
      const columnSummaries = sumColumnValues(
        sortedMonths.flatMap((result) => result.columnValues).filter((cv) => cv.enabled !== false),
      )

      // 计算总现金流（所有列金额之和）
      const totalFlow = columnSummaries.reduce((sum, col) => sum + col.total, 0)

      // 计算理财收益总和
      const investReturn = sortedMonths.reduce((sum, result) => sum + result.investReturn, 0)

      // 年度收入/支出：各月 monthlyIncome / monthlyExpense 求和（口径与月度一致）
      const yearIncome = sortedMonths.reduce((sum, result) => sum + result.monthlyIncome, 0)
      const yearExpense = sortedMonths.reduce((sum, result) => sum + result.monthlyExpense, 0)

      // 年度房贷月供合计（公积金专区列不在 columnValues，单独累加；负数=支出）
      const yearMortgage = fund.value
        ? sortedMonths.reduce((sum, r) => sum + resolveColumnValue(fund.value!.mortgage, r.month).amount, 0)
        : 0
      // 年度公积金转入可支配合计（月冲 + 提取）
      const yearFundInflow = sortedMonths.reduce((sum, r) => sum + r.fundOutflow, 0)
      // 年度结余 = 各月结余之和，口径与月度一致（含房贷支出与公积金转入）
      const yearBalance = sortedMonths.reduce((sum, r) => sum + r.monthlyBalance, 0)

      return {
        year,
        startSavings: getStartSavings(firstResult, previousResult),
        columnSummaries,
        totalFlow,
        investReturn,
        yearIncome,
        yearExpense,
        yearBalance,
        endSavings: lastResult.cumSavings,
        fundBalance: lastResult.fundBalance,
        totalAssets: lastResult.totalAssets,
        yearMortgage,
        yearFundInflow,
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
  <div class="border border-line rounded bg-surface">
    <table class="min-w-full border-collapse text-[11px] leading-tight">
      <thead class="bg-surface-2">
        <tr class="border-b">
          <th class="px-1 py-0 text-left font-mono font-semibold whitespace-nowrap">项目</th>
          <th
            v-for="summary in yearSummaries"
            :key="summary.year"
            class="px-1 py-0 text-right font-mono tabular-nums font-semibold whitespace-nowrap"
          >
            {{ summary.year }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr class="border-b">
          <td class="px-1 py-0 whitespace-nowrap">年初存款</td>
          <td
            v-for="summary in yearSummaries"
            :key="`start-${summary.year}`"
            class="px-1 py-0 text-right font-mono tabular-nums whitespace-nowrap"
            :class="{ 'text-negative-600': summary.startSavings < 0 }"
          >
            <span
              class="block w-full"
              @mouseenter="showYearFormula(summary, 'startSavings', $event)"
              @mouseleave="popover = null"
            >{{ formatCurrency(summary.startSavings) }}</span>
          </td>
        </tr>

        <tr v-for="name in allColumnNames" :key="`col-${name}`" class="border-b">
          <td class="px-1 py-0 whitespace-nowrap">{{ name }}</td>
          <td
            v-for="summary in yearSummaries"
            :key="`col-${summary.year}-${name}`"
            class="px-1 py-0 text-right font-mono tabular-nums whitespace-nowrap"
            :class="{
              'text-negative-600': getColumnTotal(summary, name) < 0
            }"
          >
            <span
              v-if="name === '专项'"
              class="block w-full"
              @mouseenter="showYearFormula(summary, 'events', $event)"
              @mouseleave="popover = null"
            >{{ formatCurrency(getColumnTotal(summary, name)) }}</span>
            <template v-else>{{ formatCurrency(getColumnTotal(summary, name)) }}</template>
          </td>
        </tr>

        <tr class="border-b">
          <td class="px-1 py-0 whitespace-nowrap">理财收益</td>
          <td
            v-for="summary in yearSummaries"
            :key="`invest-${summary.year}`"
            class="px-1 py-0 text-right font-mono tabular-nums whitespace-nowrap"
            :class="{ 'text-negative-600': summary.investReturn < 0 }"
          >
            <span
              class="block w-full"
              @mouseenter="showYearFormula(summary, 'investReturn', $event)"
              @mouseleave="popover = null"
            >{{ formatCurrency(summary.investReturn) }}</span>
          </td>
        </tr>

        <tr class="border-b">
          <td class="px-1 py-0 whitespace-nowrap">年收入</td>
          <td
            v-for="summary in yearSummaries"
            :key="`income-${summary.year}`"
            class="px-1 py-0 text-right font-mono tabular-nums whitespace-nowrap"
            :class="{ 'text-negative-600': summary.yearIncome < 0 }"
          >
            <span class="block w-full">{{ formatCurrency(summary.yearIncome) }}</span>
          </td>
        </tr>

        <tr class="border-b">
          <td class="px-1 py-0 whitespace-nowrap">年支出</td>
          <td
            v-for="summary in yearSummaries"
            :key="`expense-${summary.year}`"
            class="px-1 py-0 text-right font-mono tabular-nums whitespace-nowrap"
            :class="{ 'text-negative-600': summary.yearExpense < 0 }"
          >
            <span class="block w-full">{{ formatCurrency(summary.yearExpense) }}</span>
          </td>
        </tr>

        <template v-if="fund">
          <tr class="border-b">
            <td class="px-1 py-0 whitespace-nowrap">年末公积金</td>
            <td
              v-for="summary in yearSummaries"
              :key="`fund-${summary.year}`"
              class="px-1 py-0 text-right font-mono tabular-nums whitespace-nowrap"
            >
              <span
                class="block w-full"
                @mouseenter="showYearFormula(summary, 'fundBalance', $event)"
                @mouseleave="popover = null"
              >{{ formatCurrency(summary.fundBalance ?? 0) }}</span>
            </td>
          </tr>
        </template>

        <tr class="border-b font-semibold">
          <td class="px-1 py-0 whitespace-nowrap">年度结余</td>
          <td
            v-for="summary in yearSummaries"
            :key="`balance-${summary.year}`"
            class="px-1 py-0 text-right font-mono tabular-nums whitespace-nowrap"
            :class="{ 'text-negative-600': summary.yearBalance < 0 }"
          >
            <span
              class="block w-full"
              @mouseenter="showYearFormula(summary, 'yearBalance', $event)"
              @mouseleave="popover = null"
            >{{ formatCurrency(summary.yearBalance) }}</span>
          </td>
        </tr>

        <tr class="border-b bg-surface-2 font-bold">
          <td class="px-1 py-0 whitespace-nowrap">年末存款</td>
          <td
            v-for="summary in yearSummaries"
            :key="`end-${summary.year}`"
            class="px-1 py-0 text-right font-mono tabular-nums whitespace-nowrap"
            :class="{ 'text-negative-600': summary.endSavings < 0 }"
          >
            <span
              class="block w-full"
              @mouseenter="showYearFormula(summary, 'endSavings', $event)"
              @mouseleave="popover = null"
            >{{ formatCurrency(summary.endSavings) }}</span>
          </td>
        </tr>
      </tbody>
    </table>
    <FormulaPopover
      v-if="popover"
      :title="popover.title"
      :lines="popover.lines"
      :x="popover.x"
      :y="popover.y"
      @close="popover = null"
    />
  </div>
</template>

<style scoped>
/* 隔行斑马纹：偶数行极淡灰，排除年末存款汇总行 */
tbody tr:nth-child(even):not(:last-child) {
  background-color: rgb(100 116 139 / 0.04);
}
/* 行 hover：统一中性 surface-2（与 hover:bg-surface-2 一致），覆盖斑马纹与汇总行灰底 */
tbody tr:hover {
  background-color: #f8fafc;
}
/* hover 行内单元格同步变 surface-2，覆盖单元格背景 */
tbody tr:hover td {
  background-color: #f8fafc;
}
</style>
