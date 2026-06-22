import { describe, expect, it } from 'vitest'
import type { MonthResult } from '../../src/types'
import { formatAxisLabel, buildChartData, buildChartOption, formatAxisAmount, monthYearBoundaries, keyPointIndices } from '../../src/utils/financeChart'

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
    fundBalance: 0,
    fundInterest: 0,
    fundContribution: 0,
    fundOffset: 0,
    fundWithdrawal: 0,
    fundOutflow: 0,
    isFundAnchor: false,
    totalAssets: 0,
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
      makeResult({ month: 202601, monthlyIncome: 10000, monthlyExpense: 6000, cumSavings: 50000, totalAssets: 50000 }),
      makeResult({ month: 202602, monthlyIncome: 10000, monthlyExpense: 6000, cumSavings: 55000, totalAssets: 55000 }),
    ]

    expect(buildChartData(results, 'month')).toEqual({
      categories: ['26/01', '26/02'],
      income: [10000, 10000],
      expense: [6000, 6000],
      cumSavings: [50000, 55000],
      fundBalance: [0, 0],
    })
  })

  it('按年：按自然年聚合，支出为正值，categories 用年份', () => {
    const results = [
      makeResult({ month: 202612, monthlyIncome: 10000, monthlyExpense: 5000, cumSavings: 110000, totalAssets: 110000 }),
      makeResult({ month: 202701, monthlyIncome: 12000, monthlyExpense: 5000, cumSavings: 120000, totalAssets: 120000 }),
    ]

    expect(buildChartData(results, 'year')).toEqual({
      categories: ['2026', '2027'],
      income: [10000, 12000],
      expense: [5000, 5000],
      cumSavings: [110000, 120000],
      fundBalance: [0, 0],
    })
  })
})

describe('buildChartOption · 双 grid 结构', () => {
  const baseData = () => ({
    categories: ['26/01'], income: [10000], expense: [6000], cumSavings: [50000], fundBalance: [0],
  })

  it('两个 grid(上下块);存款归上块轴、收支归下块轴', () => {
    const opt = buildChartOption(baseData(), false, 'month')
    expect(opt.grid).toHaveLength(2)
    const cum = opt.series.find(s => s.name === '存款')!
    const income = opt.series.find(s => s.name === '收入')!
    const expense = opt.series.find(s => s.name === '支出')!
    expect(cum.xAxisIndex).toBe(0); expect(cum.yAxisIndex).toBe(0)
    expect(income.xAxisIndex).toBe(1); expect(income.yAxisIndex).toBe(1)
    expect(expense.xAxisIndex).toBe(1); expect(expense.yAxisIndex).toBe(1)
  })

  it('yAxis 仅两个单轴:上块「余额」、下块「金额」', () => {
    const opt = buildChartOption(baseData(), false, 'month')
    expect(opt.yAxis).toHaveLength(2)
    expect(opt.yAxis[0].name).toBe('余额')
    expect(opt.yAxis[1].name).toBe('金额')
    expect(opt.yAxis[0].gridIndex).toBe(0)
    expect(opt.yAxis[1].gridIndex).toBe(1)
  })

  it('存款为渐变面积主线;收支柱顶部圆角', () => {
    const opt = buildChartOption(baseData(), false, 'month')
    const cum = opt.series.find(s => s.name === '存款')!
    expect(cum.areaStyle).toBeDefined()
    expect(cum.lineStyle?.width).toBe(2.5)
    expect(opt.series.find(s => s.name === '收入')!.itemStyle?.borderRadius).toEqual([2, 2, 0, 0])
  })

  it('配色不变:收入朱砂/支出竹青/存款靛蓝', () => {
    const opt = buildChartOption(baseData(), false, 'month')
    expect(opt.series.find(s => s.name === '收入')!.itemStyle?.color).toBe('#c0504d')
    expect(opt.series.find(s => s.name === '支出')!.itemStyle?.color).toBe('#6b8e7b')
    expect(opt.series.find(s => s.name === '存款')!.itemStyle?.color).toBe('#4f46e5')
  })

  it('tooltip formatter 仍含收入/支出/结余/存款且金额万元化;退化模式不含公积金', () => {
    const data = { categories: ['26/08'], income: [15800], expense: [9200], cumSavings: [1234567], fundBalance: [0] }
    const opt = buildChartOption(data, false, 'month')
    const html = opt.tooltip.formatter([
      { seriesName: '收入', value: 15800 }, { seriesName: '支出', value: 9200 }, { seriesName: '存款', value: 1234567 },
    ])
    expect(html).toContain('收入'); expect(html).toContain('结余'); expect(html).toContain('123.5万')
    expect(html).not.toContain('公积金余额')
  })

  it('赤字场景:净结余用竹青色 + 千分位负数', () => {
    const data = { categories: ['26/08'], income: [5000], expense: [9000], cumSavings: [1234567], fundBalance: [0] }
    const opt = buildChartOption(data, false, 'month')
    const html = opt.tooltip.formatter([
      { seriesName: '收入', value: 5000 }, { seriesName: '支出', value: 9000 }, { seriesName: '存款', value: 1234567 },
    ])
    expect(html).toContain('#5e8270')
    expect(html).toContain('-4,000')
  })
})

describe('buildChartOption · fund 双线', () => {
  it('fundEnabled=true 含存款与公积金余额两线,均归上块轴;配色正确', () => {
    const opt = buildChartOption(buildChartData([], 'month'), true, 'month')
    const names = opt.series.map(s => s.name)
    expect(names).toEqual(['存款', '公积金余额', '收入', '支出'])
    expect(opt.legend.data).toEqual(['收入', '支出', '存款', '公积金余额'])
    const fund = opt.series.find(s => s.name === '公积金余额')!
    expect(fund.xAxisIndex).toBe(0); expect(fund.yAxisIndex).toBe(0)
    expect(fund.itemStyle?.color).toBe('#d97706')
  })

  it('fundEnabled=false 不含公积金余额', () => {
    const opt = buildChartOption(buildChartData([], 'month'), false, 'month')
    expect(opt.series.map(s => s.name)).not.toContain('公积金余额')
  })

  it('fundEnabled=true tooltip 含公积金余额行', () => {
    const opt = buildChartOption(buildChartData([], 'month'), true, 'month')
    const html = opt.tooltip.formatter([
      { seriesName: '收入', value: 10000 }, { seriesName: '支出', value: 6000 },
      { seriesName: '存款', value: 80000 }, { seriesName: '公积金余额', value: 30000 },
    ])
    expect(html).toContain('公积金余额'); expect(html).toContain('3万')
  })
})

describe('monthYearBoundaries', () => {
  it('返回每个年份首次出现的索引(升序)', () => {
    const cats = ['26/01', '26/02', '26/12', '27/01', '27/03', '28/01']
    expect(monthYearBoundaries(cats)).toEqual([0, 3, 5])
  })
  it('单年 → 仅 [0]', () => {
    expect(monthYearBoundaries(['26/01', '26/12'])).toEqual([0])
  })
  it('空数组 → []', () => {
    expect(monthYearBoundaries([])).toEqual([])
  })
})

describe('keyPointIndices', () => {
  it('返回起点/最低点/终点索引(升序去重)', () => {
    expect(keyPointIndices([50000, 40000, 47000, 61000])).toEqual([0, 1, 3])
  })
  it('单元素 → [0]', () => {
    expect(keyPointIndices([5])).toEqual([0])
  })
  it('空数组 → []', () => {
    expect(keyPointIndices([])).toEqual([])
  })
  it('全相同 → [0, 末位]', () => {
    expect(keyPointIndices([3, 3, 3])).toEqual([0, 2])
  })
})
