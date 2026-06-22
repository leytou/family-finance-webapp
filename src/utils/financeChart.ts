import type { MonthResult } from '../types'
import { aggregateByYear } from '../composables/useCalculation'

export type Granularity = 'month' | 'year'

export interface ChartData {
  categories: string[]
  income: number[]
  expense: number[]      // 正值（不再取负）
  cumSavings: number[]
  fundBalance: number[]  // 公积金余额
}

export interface ChartSeries {
  name: string
  type: 'bar' | 'line'
  data: number[]
  xAxisIndex?: number
  yAxisIndex?: number
  itemStyle?: { color: string; borderRadius?: number[]; opacity?: number }
  lineStyle?: { color: string; width?: number }
  areaStyle?: { color: unknown }
  smooth?: boolean
  showSymbol?: boolean
  symbolSize?: number
  barCategoryGap?: string
  label?: {
    show: boolean
    position?: string
    color?: string
    fontSize?: number
    textBorderColor?: string
    textBorderWidth?: number
    formatter: (p: { dataIndex: number; value: number }) => string
  }
}

export interface ChartAxis {
  type: string
  gridIndex?: number
  data?: string[]
  name?: string
  alignTicks?: boolean
  offset?: number
  axisLine?: { show?: boolean; lineStyle?: { color: string } }
  axisTick?: { show?: boolean }
  axisLabel?: {
    show?: boolean
    interval?: string | number | ((index: number) => boolean)
    formatter?: unknown
  }
  splitLine?: { show?: boolean; interval?: unknown; lineStyle?: { color: string; type?: string } }
}

export interface ChartOption {
  tooltip: {
    trigger: string
    backgroundColor?: string
    borderColor?: string
    borderWidth?: number
    textStyle?: { color: string }
    axisPointer?: { link: Array<{ xAxisIndex: string }> }
    formatter: (params: Array<{ seriesName: string; value: number }>) => string
  }
  legend: { data: string[] }
  grid: Array<{ left: string; right: string; top: string; height: string }>
  xAxis: ChartAxis[]
  yAxis: ChartAxis[]
  series: ChartSeries[]
}

// 配色（中式柔和：收入朱砂 / 支出竹青 / 存款靛蓝 / 公积金琥珀），与表格语义同源
const COLOR_INCOME = '#c0504d'   // zhusha-600
const COLOR_EXPENSE = '#6b8e7b'  // zhuqing-500（柱用柔和阶）
const COLOR_NET_NEG = '#5e8270'  // zhuqing-600 净结余赤字
const COLOR_CUM = '#4f46e5'      // 存款主线（cumSavings）
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

/**
 * 按月 categories(YY/MM)→ 每个年份首次出现的索引(升序)。
 * 供按月横轴的「年份标注」与「年份分隔竖线」使用。空数组返回空。
 */
export function monthYearBoundaries(categories: string[]): number[] {
  if (categories.length === 0) return []
  const bounds: number[] = []
  let lastYear = ''
  categories.forEach((cat, i) => {
    const year = cat.slice(0, 2)
    if (year !== lastYear) {
      bounds.push(i)
      lastYear = year
    }
  })
  return bounds
}

/**
 * 数值序列 → [起点, 最低点, 终点] 索引(升序去重)。
 * 最低点取第一个最小值的位置;空数组返回空。
 */
export function keyPointIndices(values: number[]): number[] {
  if (values.length === 0) return []
  let minIdx = 0
  values.forEach((v, i) => { if (v < values[minIdx]) minIdx = i })
  return Array.from(new Set([0, minIdx, values.length - 1])).sort((a, b) => a - b)
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
      fundBalance: years.map(p => p.fundBalance),
    }
  }

  return {
    categories: results.map(r => formatAxisLabel(r.month)),
    income: results.map(r => r.monthlyIncome),
    expense: results.map(r => r.monthlyExpense),
    cumSavings: results.map(r => r.cumSavings),
    fundBalance: results.map(r => r.fundBalance),
  }
}

/** tooltip 明细:收入/支出/结余/存款(+公积金余额),金额万元化;结余盈余朱砂/赤字竹青。 */
function tooltipFormatter(fundEnabled: boolean) {
  return (params: Array<{ seriesName: string; value: number }>) => {
    const get = (name: string) => params.find(p => p.seriesName === name)?.value ?? 0
    const income = get('收入')
    const expense = get('支出')
    const total = get('存款')
    const fund = get('公积金余额')
    const net = income - expense
    const netColor = net >= 0 ? COLOR_INCOME : COLOR_NET_NEG
    const row = (label: string, val: number, color = '#0f172a') =>
      `<div style="display:flex;justify-content:space-between;gap:16px;font-size:12px;line-height:18px">`
      + `<span style="color:#64748b">${label}</span>`
      + `<span style="color:${color};font-weight:600">${formatAxisAmount(val)}</span></div>`
    let html = row('收入', income) + row('支出', expense)
      + row('结余', net, netColor)
      + `<div style="height:1px;background:#e2e8f0;margin:4px 0"></div>`
      + row('存款', total)
    if (fundEnabled) html += row('公积金余额', fund)
    return html
  }
}

/**
 * 由 ChartData 构造 ECharts 双 grid option：
 * 上块(gridIndex 0)= 存款 + 公积金余额 折线(单「余额」轴);
 * 下块(gridIndex 1)= 收入 + 支出 柱(单「金额」轴)。
 * granularity 控制标注/横轴分层(标注=Task4,分层=Task5)。字段名遵循 ECharts option 规范,组件内以 `as any` 桥接。
 */
export function buildChartOption(data: ChartData, fundEnabled: boolean, granularity: Granularity = 'month'): ChartOption {
  const legendData = fundEnabled
    ? ['收入', '支出', '存款', '公积金余额']
    : ['收入', '支出', '存款']

  const isMonth = granularity === 'month'
  const yearBounds = isMonth ? monthYearBoundaries(data.categories) : []
  // 存款线标注点:按月仅起点/最低/终点,按年全点
  const cumKey = isMonth
    ? keyPointIndices(data.cumSavings)
    : data.cumSavings.map((_, i) => i)
  const cumLabelFormatter = (p: { dataIndex: number; value: number }) =>
    cumKey.includes(p.dataIndex) ? formatAxisAmount(p.value) : ''
  // 下块收支柱:按年柱顶标数值,按月不标
  const barLabel = isMonth
    ? undefined
    : { show: true, position: 'top', fontSize: 10, formatter: (p: { dataIndex: number; value: number }) => formatAxisAmount(p.value) }

  const series: ChartSeries[] = [
    {
      name: '存款', type: 'line', xAxisIndex: 0, yAxisIndex: 0, data: data.cumSavings,
      smooth: true,
      // 不用 showSymbol:false——它会抑制 label 渲染(ECharts 已知问题 #8885);
      // 改用极小+透明 symbol 保留 label 锚点,视觉上仍看不到圆点
      showSymbol: true, symbolSize: 4,
      lineStyle: { color: COLOR_CUM, width: 2.5 }, itemStyle: { color: COLOR_CUM },
      areaStyle: {
        color: {
          type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(79,70,229,0.28)' },
            { offset: 1, color: 'rgba(79,70,229,0.02)' },
          ],
        },
      },
      label: { show: true, position: 'top', color: COLOR_CUM, fontSize: 11, textBorderColor: '#ffffff', textBorderWidth: 2, formatter: cumLabelFormatter },
    },
  ]

  if (fundEnabled) {
    series.push({
      name: '公积金余额', type: 'line', xAxisIndex: 0, yAxisIndex: 0, data: data.fundBalance,
      smooth: true, showSymbol: true, symbolSize: 1,
      lineStyle: { color: COLOR_FUND }, itemStyle: { color: COLOR_FUND, opacity: 0 },
    })
  }

  series.push(
    {
      name: '收入', type: 'bar', xAxisIndex: 1, yAxisIndex: 1, data: data.income,
      itemStyle: { color: COLOR_INCOME, borderRadius: [2, 2, 0, 0] }, barCategoryGap: '40%',
      label: barLabel,
    },
    {
      name: '支出', type: 'bar', xAxisIndex: 1, yAxisIndex: 1, data: data.expense,
      itemStyle: { color: COLOR_EXPENSE, borderRadius: [2, 2, 0, 0] }, barCategoryGap: '40%',
      label: barLabel,
    },
  )

  return {
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#ffffff', borderColor: '#e4e8f1', borderWidth: 1,
      textStyle: { color: '#0f172a' },
      axisPointer: { link: [{ xAxisIndex: 'all' }] },
      formatter: tooltipFormatter(fundEnabled),
    },
    legend: { data: legendData },
    grid: [
      { left: '3%', right: '4%', top: '6%', height: '54%' },
      { left: '3%', right: '4%', top: '66%', height: '26%' },
    ],
    xAxis: isMonth
      ? [
          // 上块类目轴:不显示标签,但在年份边界画分隔竖线(与下块对齐 → 视觉连贯)
          { type: 'category', gridIndex: 0, data: data.categories,
            axisLine: { lineStyle: { color: COLOR_AXIS } }, axisLabel: { show: false }, axisTick: { show: false },
            splitLine: { show: true, interval: (i: number) => yearBounds.includes(i), lineStyle: { color: COLOR_AXIS, type: 'dashed' } } },
          // 下块类目轴:显示月份(去前导零)
          { type: 'category', gridIndex: 1, data: data.categories,
            axisLine: { lineStyle: { color: COLOR_AXIS } }, axisLabel: { interval: 'auto', formatter: (val: string) => String(Number(val.slice(3, 5))) },
            splitLine: { show: true, interval: (i: number) => yearBounds.includes(i), lineStyle: { color: COLOR_AXIS, type: 'dashed' } } },
          // 年份辅助轴(下沉一层):仅每年首月显示年份
          { type: 'category', gridIndex: 1, data: data.categories, offset: 28,
            axisLine: { show: false }, axisTick: { show: false },
            axisLabel: { interval: 0, formatter: (val: string, i: number) => yearBounds.includes(i) ? `20${val.slice(0, 2)}` : '' } },
        ]
      : [
          { type: 'category', gridIndex: 0, data: data.categories,
            axisLine: { lineStyle: { color: COLOR_AXIS } }, axisLabel: { show: false }, axisTick: { show: false } },
          { type: 'category', gridIndex: 1, data: data.categories,
            axisLine: { lineStyle: { color: COLOR_AXIS } }, axisLabel: { interval: 'auto' } },
        ],
    yAxis: [
      { type: 'value', gridIndex: 0, name: '余额', alignTicks: true,
        axisLabel: { formatter: (v: number) => formatAxisAmount(v) }, splitLine: { lineStyle: { color: COLOR_GRID } } },
      { type: 'value', gridIndex: 1, name: '金额', alignTicks: true,
        axisLabel: { formatter: (v: number) => formatAxisAmount(v) }, splitLine: { lineStyle: { color: COLOR_GRID } } },
    ],
    series,
  }
}
