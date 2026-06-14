import { describe, expect, it } from 'vitest'
import type { MonthResult } from '../../src/types'
import { formatAxisLabel, buildChartData, buildChartOption, formatAxisAmount } from '../../src/utils/financeChart'

function makeResult(overrides: Partial<MonthResult> = {}): MonthResult {
  return {
    month: 202601,
    columnValues: [],
    totalFlow: 0,
    investReturn: 0,
    monthlyIncome: 0,
    monthlyExpense: 0,
    monthlyBalance: 0,
    cumSavings: 0,
    isAnchor: false,
    ...overrides,
  }
}

describe('formatAxisLabel', () => {
  it('YYYYMM → YY/MM 两位补零', () => {
    expect(formatAxisLabel(202601)).toBe('26/01')
    expect(formatAxisLabel(202612)).toBe('26/12')
    expect(formatAxisLabel(203007)).toBe('30/07')
  })
})

describe('formatAxisAmount', () => {
  it('<1万 千分位整数', () => {
    expect(formatAxisAmount(500)).toBe('500')
    expect(formatAxisAmount(0)).toBe('0')
    expect(formatAxisAmount(9200)).toBe('9,200')
  })
  it('≥1万 显示 X.X万（去尾零）', () => {
    expect(formatAxisAmount(15800)).toBe('1.6万')
    expect(formatAxisAmount(1234567)).toBe('123.5万')
    expect(formatAxisAmount(150000)).toBe('15万')
  })
  it('≥1亿 显示 X.X亿', () => {
    expect(formatAxisAmount(120000000)).toBe('1.2亿')
  })
  it('负值带 - 前缀', () => {
    expect(formatAxisAmount(-1500000)).toBe('-150万')
  })
})

describe('buildChartData', () => {
  it('按月：categories 用 YY/MM，支出为正值', () => {
    const results = [
      makeResult({ month: 202601, monthlyIncome: 10000, monthlyExpense: 6000, cumSavings: 50000 }),
      makeResult({ month: 202602, monthlyIncome: 10000, monthlyExpense: 6000, cumSavings: 55000 }),
    ]

    expect(buildChartData(results, 'month')).toEqual({
      categories: ['26/01', '26/02'],
      income: [10000, 10000],
      expense: [6000, 6000],
      cumSavings: [50000, 55000],
    })
  })

  it('按年：按自然年聚合，支出为正值，categories 用年份', () => {
    const results = [
      makeResult({ month: 202612, monthlyIncome: 10000, monthlyExpense: 5000, cumSavings: 110000 }),
      makeResult({ month: 202701, monthlyIncome: 12000, monthlyExpense: 5000, cumSavings: 120000 }),
    ]

    expect(buildChartData(results, 'year')).toEqual({
      categories: ['2026', '2027'],
      income: [10000, 12000],
      expense: [5000, 5000],
      cumSavings: [110000, 120000],
    })
  })
})

describe('buildChartOption', () => {
  it('三系列：收入/支出走左轴，累计储蓄走右轴；数据与配色正确', () => {
    const data = { categories: ['26/01'], income: [10000], expense: [6000], cumSavings: [50000] }

    const option = buildChartOption(data)

    expect(option.series.map(s => s.name)).toEqual(['收入', '支出', '累计储蓄'])
    expect(option.series.map(s => s.type)).toEqual(['bar', 'bar', 'line'])
    expect(option.series[0].yAxisIndex).toBe(0)
    expect(option.series[1].yAxisIndex).toBe(0)
    expect(option.series[2].yAxisIndex).toBe(1)
    expect(option.series[0].data).toEqual([10000])
    expect(option.series[1].data).toEqual([6000])
    expect(option.series[2].data).toEqual([50000])
    expect(option.series[0].itemStyle?.color).toBe('#c0504d')
    expect(option.series[1].itemStyle?.color).toBe('#6b8e7b')
    expect(option.xAxis.data).toEqual(['26/01'])
    expect(option.legend.data).toEqual(['收入', '支出', '累计储蓄'])
  })

  it('累计储蓄为渐变面积主线：含 areaStyle 与 2.5px 粗线', () => {
    const data = { categories: ['26/01'], income: [10000], expense: [6000], cumSavings: [50000] }
    const cum = buildChartOption(data).series[2]

    expect(cum.areaStyle).toBeDefined()
    expect(cum.areaStyle?.color).toBeDefined()
    expect(cum.lineStyle?.width).toBe(2.5)
  })

  it('收支柱为正值并列双柱，顶部圆角', () => {
    const data = { categories: ['26/01'], income: [10000], expense: [6000], cumSavings: [50000] }
    const option = buildChartOption(data)
    const income = option.series[0]
    const expense = option.series[1]

    expect(income.itemStyle?.borderRadius).toEqual([2, 2, 0, 0])
    expect(expense.itemStyle?.borderRadius).toEqual([2, 2, 0, 0])
    expect(income.barCategoryGap).toBe('40%')
  })

  it('仅左轴画网格，右轴不画（避免双重网格）', () => {
    const data = { categories: ['26/01'], income: [10000], expense: [6000], cumSavings: [50000] }
    const [left, right] = buildChartOption(data).yAxis

    expect(left.splitLine?.show ?? true).toBe(true)
    expect(right.splitLine?.show).toBe(false)
  })

  it('左右轴有万元 formatter，X 轴标签稀疏', () => {
    const data = { categories: ['26/01'], income: [10000], expense: [6000], cumSavings: [50000] }
    const option = buildChartOption(data)

    expect(typeof option.yAxis[0].axisLabel?.formatter).toBe('function')
    expect(typeof option.yAxis[1].axisLabel?.formatter).toBe('function')
    // formatter 行为：15800 → 1.6万
    expect((option.yAxis[0].axisLabel!.formatter as (v: number) => string)(15800)).toBe('1.6万')
    expect(option.xAxis.axisLabel?.interval).toBe('auto')
  })

  it('tooltip 为浅色卡片，formatter 含收入/支出/净结余/累计且金额万元化', () => {
    const data = {
      categories: ['26/08'],
      income: [15800], expense: [9200], cumSavings: [1234567],
    }
    const option = buildChartOption(data)

    expect(option.tooltip.backgroundColor).toBe('#ffffff')
    expect(option.tooltip.borderColor).toBe('#e2e8f0')
    expect(option.tooltip.textStyle?.color).toBe('#0f172a')

    const html = (option.tooltip.formatter as (p: Array<{ seriesName: string; value: number }>) => string)([
      { seriesName: '收入', value: 15800 },
      { seriesName: '支出', value: 9200 },
      { seriesName: '累计储蓄', value: 1234567 },
    ])
    expect(html).toContain('收入')
    expect(html).toContain('支出')
    expect(html).toContain('净结余')
    expect(html).toContain('累计')
    expect(html).toContain('1.6万')        // 收入 15800
    expect(html).toContain('9,200')        // 支出 9200（<1万 千分位）
    expect(html).toContain('123.5万')      // 累计 1234567
  })
})
