import type { MonthResult } from '../types'
import { aggregateByYear } from '../composables/useCalculation'

export type Granularity = 'month' | 'year'

export interface ChartData {
  categories: string[]
  income: number[]
  expense: number[]      // 正值（不再取负）
  cumSavings: number[]
}

export interface ChartSeries {
  name: string
  type: 'bar' | 'line'
  data: number[]
  yAxisIndex?: number
  itemStyle?: { color: string; borderRadius?: number[] }
  lineStyle?: { color: string; width?: number }
  areaStyle?: { color: unknown }   // ECharts 渐变对象，类型宽松
  smooth?: boolean
  showSymbol?: boolean
  barCategoryGap?: string
}

export interface ChartOption {
  tooltip: { trigger: string }
  legend: { data: string[] }
  grid: { left: string; right: string; bottom: string; containLabel: boolean }
  xAxis: { type: string; data: string[]; axisLine?: { lineStyle: { color: string } } }
  yAxis: { type: string; alignTicks: boolean; splitLine?: { lineStyle: { color: string } } }[]
  series: ChartSeries[]
}

// 配色（中式柔和：收入朱砂 / 支出竹青 / 累计靛蓝），与表格语义同源
const COLOR_INCOME = '#c0504d'   // zhusha-600
const COLOR_EXPENSE = '#6b8e7b'  // zhuqing-500（柱用柔和阶）
const COLOR_CUM = '#4f46e5'
// 中性轴/网格（slate），网格更淡
const COLOR_AXIS = '#cbd5e1'
const COLOR_GRID = '#eef2f7'

/** YYYYMM → 紧凑 YY/MM（如 26/01），用于按月视图 x 轴标签。 */
export function formatAxisLabel(month: number): string {
  const year = Math.floor(month / 100) % 100
  const m = month % 100
  return `${String(year).padStart(2, '0')}/${String(m).padStart(2, '0')}`
}

/** 轴刻度 / 摘要智能缩写：<1万 千分位整数，≥1万 X.X万，≥1亿 X.X亿（去尾零）。 */
export function formatAxisAmount(v: number): string {
  const abs = Math.abs(v)
  if (abs >= 1e8) return (v / 1e8).toFixed(1).replace(/\.0$/, '') + '亿'
  if (abs >= 1e4) return (v / 1e4).toFixed(1).replace(/\.0$/, '') + '万'
  return Math.round(v).toLocaleString('en-US')
}

/** 把月度结果按粒度转成图表数据；支出为正值（不再镜像负轴）。 */
export function buildChartData(results: MonthResult[], granularity: Granularity): ChartData {
  if (granularity === 'year') {
    const years = aggregateByYear(results)
    return {
      categories: years.map(p => String(p.year)),
      income: years.map(p => p.income),
      expense: years.map(p => p.expense),
      cumSavings: years.map(p => p.cumSavings),
    }
  }

  return {
    categories: results.map(r => formatAxisLabel(r.month)),
    income: results.map(r => r.monthlyIncome),
    expense: results.map(r => r.monthlyExpense),
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
    xAxis: { type: 'category', data: data.categories, axisLine: { lineStyle: { color: COLOR_AXIS } } },
    yAxis: [
      { type: 'value', alignTicks: true, splitLine: { lineStyle: { color: COLOR_GRID } } },
      { type: 'value', alignTicks: true, splitLine: { lineStyle: { color: COLOR_GRID } } },
    ],
    series: [
      { name: '收入', type: 'bar', yAxisIndex: 0, data: data.income, itemStyle: { color: COLOR_INCOME } },
      { name: '支出', type: 'bar', yAxisIndex: 0, data: data.expense, itemStyle: { color: COLOR_EXPENSE } },
      {
        name: '累计储蓄', type: 'line', yAxisIndex: 1, data: data.cumSavings,
        smooth: true, showSymbol: false,
        lineStyle: { color: COLOR_CUM, width: 2.5 },
        itemStyle: { color: COLOR_CUM },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(79,70,229,0.28)' },
              { offset: 1, color: 'rgba(79,70,229,0.02)' },
            ],
          },
        },
      },
    ],
  }
}
