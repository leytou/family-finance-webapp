import { describe, expect, it } from 'vitest'
import type { MonthResult } from '../../src/types'
import { formatAxisLabel, buildChartData, buildChartOption } from '../../src/utils/financeChart'

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

describe('buildChartData', () => {
  it('按月：categories 用 YY/MM，支出取负', () => {
    const results = [
      makeResult({ month: 202601, monthlyIncome: 10000, monthlyExpense: 6000, cumSavings: 50000 }),
      makeResult({ month: 202602, monthlyIncome: 10000, monthlyExpense: 6000, cumSavings: 55000 }),
    ]

    expect(buildChartData(results, 'month')).toEqual({
      categories: ['26/01', '26/02'],
      income: [10000, 10000],
      expense: [-6000, -6000],
      cumSavings: [50000, 55000],
    })
  })

  it('按年：按自然年聚合，支出取负，categories 用年份', () => {
    const results = [
      makeResult({ month: 202612, monthlyIncome: 10000, monthlyExpense: 5000, cumSavings: 110000 }),
      makeResult({ month: 202701, monthlyIncome: 12000, monthlyExpense: 5000, cumSavings: 120000 }),
    ]

    expect(buildChartData(results, 'year')).toEqual({
      categories: ['2026', '2027'],
      income: [10000, 12000],
      expense: [-5000, -5000],
      cumSavings: [110000, 120000],
    })
  })
})

describe('buildChartOption', () => {
  it('三系列：收入/支出走左轴，累计储蓄走右轴；数据与配色正确', () => {
    const data = { categories: ['26/01'], income: [10000], expense: [-6000], cumSavings: [50000] }

    const option = buildChartOption(data)

    expect(option.series.map(s => s.name)).toEqual(['收入', '支出', '累计储蓄'])
    expect(option.series.map(s => s.type)).toEqual(['bar', 'bar', 'line'])
    expect(option.series[0].yAxisIndex).toBe(0)
    expect(option.series[1].yAxisIndex).toBe(0)
    expect(option.series[2].yAxisIndex).toBe(1)
    expect(option.series[0].data).toEqual([10000])
    expect(option.series[1].data).toEqual([-6000])
    expect(option.series[2].data).toEqual([50000])
    expect(option.series[0].itemStyle?.color).toBe('#16a34a')
    expect(option.series[1].itemStyle?.color).toBe('#dc2626')
    expect(option.xAxis.data).toEqual(['26/01'])
    expect(option.legend.data).toEqual(['收入', '支出', '累计储蓄'])
  })
})
