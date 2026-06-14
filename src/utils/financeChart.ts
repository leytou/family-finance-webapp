import type { MonthResult } from '../types'
import { aggregateByYear } from '../composables/useCalculation'

export type Granularity = 'month' | 'year'

export interface ChartData {
  categories: string[]
  income: number[]
  expense: number[]      // 正值（不再取负）
  cumSavings: number[]
  totalAssets: number[]  // 总资产（cumSavings + fundBalance）
  fundBalance: number[]  // 公积金余额
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
  tooltip: {
    trigger: string
    backgroundColor?: string
    borderColor?: string
    borderWidth?: number
    textStyle?: { color: string }
    formatter: (params: Array<{ seriesName: string; value: number }>) => string
  }
  legend: { data: string[] }
  grid: { left: string; right: string; bottom: string; containLabel: boolean }
  xAxis: {
    type: string; data: string[]
    axisLine?: { lineStyle: { color: string } }
    axisLabel?: { interval: string | number }
  }
  yAxis: {
    type: string; alignTicks: boolean
    splitLine?: { show?: boolean; lineStyle?: { color: string } }
    axisLabel?: { formatter: (v: number) => string }
  }[]
  series: ChartSeries[]
}

// 配色（中式柔和：收入朱砂 / 支出竹青 / 总资产靛蓝 / 公积金琥珀），与表格语义同源
const COLOR_INCOME = '#c0504d'   // zhusha-600
const COLOR_EXPENSE = '#6b8e7b'  // zhuqing-500（柱用柔和阶）
const COLOR_NET_NEG = '#5e8270'  // zhuqing-600 净结余赤字
const COLOR_CUM = '#4f46e5'      // 总资产主线
const COLOR_FUND = '#d97706'     // 公积金余额副线（琥珀）
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
      totalAssets: years.map(p => p.totalAssets),
      fundBalance: years.map(p => p.fundBalance),
    }
  }

  return {
    categories: results.map(r => formatAxisLabel(r.month)),
    income: results.map(r => r.monthlyIncome),
    expense: results.map(r => r.monthlyExpense),
    cumSavings: results.map(r => r.cumSavings),
    totalAssets: results.map(r => r.totalAssets),
    fundBalance: results.map(r => r.fundBalance),
  }
}

/**
 * 由 ChartData 构造 ECharts option：收入/支支柱状（左轴）+ 总资产渐变面积折线（右轴）。
 * fundEnabled 时叠加公积金余额副线（右轴）；否则退化仅三系列。
 * 字段名遵循 ECharts option 规范，组件内以 `as any` 桥接第三方类型。
 */
export function buildChartOption(data: ChartData, fundEnabled: boolean): ChartOption {
  const legendData = fundEnabled
    ? ['收入', '支出', '总资产', '公积金余额']
    : ['收入', '支出', '总资产']

  const series: ChartSeries[] = [
    {
      name: '收入', type: 'bar', yAxisIndex: 0, data: data.income,
      itemStyle: { color: COLOR_INCOME, borderRadius: [2, 2, 0, 0] },
      barCategoryGap: '40%',
    },
    {
      name: '支出', type: 'bar', yAxisIndex: 0, data: data.expense,
      itemStyle: { color: COLOR_EXPENSE, borderRadius: [2, 2, 0, 0] },
      barCategoryGap: '40%',
    },
    {
      name: '总资产', type: 'line', yAxisIndex: 1, data: data.totalAssets,
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
  ]

  if (fundEnabled) {
    series.push({
      name: '公积金余额', type: 'line', yAxisIndex: 1, data: data.fundBalance,
      smooth: true, showSymbol: false,
      lineStyle: { color: COLOR_FUND },
      itemStyle: { color: COLOR_FUND },
    })
  }

  return {
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#ffffff',
      borderColor: '#e2e8f0',
      borderWidth: 1,
      textStyle: { color: '#0f172a' },
      formatter: params => {
        const get = (name: string) => params.find(p => p.seriesName === name)?.value ?? 0
        const income = get('收入')
        const expense = get('支出')
        const total = get('总资产')
        const fund = get('公积金余额')
        const net = income - expense
        const netColor = net >= 0 ? COLOR_INCOME : COLOR_NET_NEG   // 盈余朱砂 / 赤字竹青
        const row = (label: string, val: number, color = '#0f172a') =>
          `<div style="display:flex;justify-content:space-between;gap:16px;font-size:12px;line-height:18px">`
          + `<span style="color:#64748b">${label}</span>`
          + `<span style="color:${color};font-weight:600">${formatAxisAmount(val)}</span></div>`
        let html = row('收入', income) + row('支出', expense)
          + row('净结余', net, netColor)
          + `<div style="height:1px;background:#e2e8f0;margin:4px 0"></div>`
          + row('总资产', total)
        if (fundEnabled) html += row('公积金余额', fund)
        return html
      },
    },
    legend: { data: legendData },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: {
      type: 'category', data: data.categories,
      axisLine: { lineStyle: { color: COLOR_AXIS } },
      axisLabel: { interval: 'auto' },
    },
    yAxis: [
      {
        type: 'value', alignTicks: true,
        axisLabel: { formatter: (v: number) => formatAxisAmount(v) },
        splitLine: { lineStyle: { color: COLOR_GRID } },
      },
      {
        type: 'value', alignTicks: true,
        axisLabel: { formatter: (v: number) => formatAxisAmount(v) },
        splitLine: { show: false },
      },
    ],
    series,
  }
}
