import type { MonthResult } from '../types'
import { aggregateByYear } from '../composables/useCalculation'

export type Granularity = 'month' | 'year'

export interface ChartData {
  categories: string[]
  income: number[]
  expense: number[]      // 已取负（支出向下）
  cumSavings: number[]
}

export interface ChartSeries {
  name: string
  type: 'bar' | 'line'
  data: number[]
  yAxisIndex?: number
  itemStyle?: { color: string }
  lineStyle?: { color: string }
  smooth?: boolean
  showSymbol?: boolean
}

export interface ChartOption {
  tooltip: { trigger: string }
  legend: { data: string[] }
  grid: { left: string; right: string; bottom: string; containLabel: boolean }
  xAxis: { type: string; data: string[] }
  yAxis: { type: string; alignTicks: boolean }[]
  series: ChartSeries[]
}

// 配色：收入绿 / 支出红 / 累计储蓄蓝
const COLOR_INCOME = '#16a34a'
const COLOR_EXPENSE = '#dc2626'
const COLOR_CUM = '#2563eb'

/** YYYYMM → 紧凑 YY/MM（如 26/01），用于按月视图 x 轴标签。 */
export function formatAxisLabel(month: number): string {
  const year = Math.floor(month / 100) % 100
  const m = month % 100
  return `${String(year).padStart(2, '0')}/${String(m).padStart(2, '0')}`
}

/** 把月度结果按粒度转成图表数据；支出统一取负（向下画）。 */
export function buildChartData(results: MonthResult[], granularity: Granularity): ChartData {
  if (granularity === 'year') {
    const years = aggregateByYear(results)
    return {
      categories: years.map(p => String(p.year)),
      income: years.map(p => p.income),
      expense: years.map(p => -p.expense),
      cumSavings: years.map(p => p.cumSavings),
    }
  }

  return {
    categories: results.map(r => formatAxisLabel(r.month)),
    income: results.map(r => r.monthlyIncome),
    expense: results.map(r => -r.monthlyExpense),
    cumSavings: results.map(r => r.cumSavings),
  }
}

/**
 * 由 ChartData 构造 ECharts option：收入/支支柱状（左轴）+ 累计储蓄折线（右轴）。
 * 字段名遵循 ECharts option 规范，组件内以 `as any` 桥接第三方类型。
 */
export function buildChartOption(data: ChartData): ChartOption {
  return {
    tooltip: { trigger: 'axis' },
    legend: { data: ['收入', '支出', '累计储蓄'] },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: { type: 'category', data: data.categories },
    yAxis: [
      { type: 'value', alignTicks: true },
      { type: 'value', alignTicks: true },
    ],
    series: [
      { name: '收入', type: 'bar', yAxisIndex: 0, data: data.income, itemStyle: { color: COLOR_INCOME } },
      { name: '支出', type: 'bar', yAxisIndex: 0, data: data.expense, itemStyle: { color: COLOR_EXPENSE } },
      { name: '累计储蓄', type: 'line', yAxisIndex: 1, data: data.cumSavings, smooth: true, showSymbol: false, lineStyle: { color: COLOR_CUM }, itemStyle: { color: COLOR_CUM } },
    ],
  }
}
