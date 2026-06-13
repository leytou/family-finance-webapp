import { describe, expect, it } from 'vitest'
import type { MonthResult, YearSummary } from '../../src/types'
import { buildMonthFormula, buildYearFormula } from '../../src/utils/formula'

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

describe('buildMonthFormula', () => {
  it('monthlyIncome：展开正向列，负向列不出现', () => {
    const r = makeResult({
      month: 202602,
      columnValues: [
        { id: 'c1', name: '月薪', amount: 10000, isEdited: true },
        { id: 'c2', name: '奖金', amount: 1000, isEdited: true },
        { id: 'c3', name: '日常', amount: -1500, isEdited: true },
      ],
      monthlyIncome: 11000,
    })
    const { title, lines } = buildMonthFormula(r, 'monthlyIncome', { annualRate: 0.03, prevCum: 0 })
    expect(title).toBe('2026-02 - 收入')
    expect(lines).toEqual(['收入 = 月薪(10,000) + 奖金(1,000) = 11,000'])
  })

  it('monthlyExpense：负向列按绝对值展开', () => {
    const r = makeResult({
      columnValues: [
        { id: 'c1', name: '日常', amount: -1500, isEdited: true },
        { id: 'c2', name: '房租', amount: -3000, isEdited: true },
        { id: 'c3', name: '月薪', amount: 10000, isEdited: true },
      ],
      monthlyExpense: 4500,
    })
    const { lines } = buildMonthFormula(r, 'monthlyExpense', { annualRate: 0.03, prevCum: 0 })
    expect(lines).toEqual(['支出 = 日常(1,500) + 房租(3,000) = 4,500'])
  })

  it('monthlyBalance：引用收入/支出/理财', () => {
    const r = makeResult({
      monthlyIncome: 11000,
      monthlyExpense: 4500,
      investReturn: 125,
      monthlyBalance: 6625,
    })
    const { title, lines } = buildMonthFormula(r, 'monthlyBalance', { annualRate: 0.03, prevCum: 0 })
    expect(title).toBe('2026-01 - 结余')
    expect(lines).toEqual(['结余 = 收入(11,000) - 支出(4,500) + 理财(125) = 6,625'])
  })

  it('investReturn：用 prevCum 与年利率展开，带结果', () => {
    const r = makeResult({ investReturn: 125 })
    const { lines } = buildMonthFormula(r, 'investReturn', { annualRate: 0.03, prevCum: 50000 })
    expect(lines).toEqual(['理财 = 上月存款(50,000) × 3% ÷ 12 = 125'])
  })

  it('cumSavings：非锚点月展开上月存款+当月结余', () => {
    const r = makeResult({ monthlyBalance: 6625, cumSavings: 56625, isAnchor: false })
    const { lines } = buildMonthFormula(r, 'cumSavings', { annualRate: 0.03, prevCum: 50000 })
    expect(lines).toEqual(['存款 = 上月存款(50,000) + 当月结余(6,625) = 56,625'])
  })

  it('cumSavings：锚点月显示锚点值', () => {
    const r = makeResult({ cumSavings: 108125, isAnchor: true })
    const { lines } = buildMonthFormula(r, 'cumSavings', { annualRate: 0.03, prevCum: 50000 })
    expect(lines).toEqual(['存款 = 锚点值(108,125)'])
  })

  it('禁用列不出现在收入/支出公式', () => {
    const r = makeResult({
      columnValues: [
        { id: 'c1', name: '月薪', amount: 10000, isEdited: true, enabled: true },
        { id: 'c2', name: '外快', amount: 2000, isEdited: true, enabled: false },
      ],
      monthlyIncome: 10000,
    })
    const { lines } = buildMonthFormula(r, 'monthlyIncome', { annualRate: 0.03, prevCum: 0 })
    expect(lines).toEqual(['收入 = 月薪(10,000) = 10,000'])
  })

  it('收入为 0（无正向列）时简洁展示', () => {
    const r = makeResult({ columnValues: [{ id: 'c1', name: '日常', amount: -1500, isEdited: true }], monthlyIncome: 0 })
    const { lines } = buildMonthFormula(r, 'monthlyIncome', { annualRate: 0.03, prevCum: 0 })
    expect(lines).toEqual(['收入 = 0'])
  })

  it('专项虚拟列按正负参与收入/支出', () => {
    const r = makeResult({
      columnValues: [
        { id: 'c1', name: '月薪', amount: 10000, isEdited: true },
        { id: '__events__', name: '专项', amount: 5000, isEdited: false, enabled: true },
      ],
      monthlyIncome: 15000,
    })
    const { lines } = buildMonthFormula(r, 'monthlyIncome', { annualRate: 0.03, prevCum: 0 })
    expect(lines).toEqual(['收入 = 月薪(10,000) + 专项(5,000) = 15,000'])
  })
})

function makeSummary(overrides: Partial<YearSummary> = {}): YearSummary {
  return {
    year: 2026,
    startSavings: 0,
    columnSummaries: [],
    totalFlow: 0,
    investReturn: 0,
    yearBalance: 0,
    endSavings: 0,
    ...overrides,
  }
}

describe('buildYearFormula', () => {
  it('startSavings：首年显示初始存款', () => {
    const s = makeSummary({ year: 2026, startSavings: 50000 })
    const { title, lines } = buildYearFormula(s, 'startSavings', {
      isFirstYear: true, initialDeposit: 50000, prevYearEndSavings: 0, events: [],
    })
    expect(title).toBe('2026 - 年初存款')
    expect(lines).toEqual(['年初存款 = 初始存款(50,000)'])
  })

  it('startSavings：非首年显示上年年末存款', () => {
    const s = makeSummary({ year: 2027, startSavings: 120000 })
    const { lines } = buildYearFormula(s, 'startSavings', {
      isFirstYear: false, initialDeposit: 50000, prevYearEndSavings: 120000, events: [],
    })
    expect(lines).toEqual(['年初存款 = 上年年末存款(120,000)'])
  })

  it('investReturn：全年合计', () => {
    const s = makeSummary({ investReturn: 1560 })
    const { lines } = buildYearFormula(s, 'investReturn', {
      isFirstYear: true, initialDeposit: 0, prevYearEndSavings: 0, events: [],
    })
    expect(lines).toEqual(['理财收益 = 全年各月理财收益合计 = 1,560'])
  })

  it('yearBalance：各列带正负 + 理财收益', () => {
    const s = makeSummary({
      year: 2026,
      columnSummaries: [
        { name: '工资', total: 120000 },
        { name: '育儿', total: -18000 },
      ],
      investReturn: 1560,
      yearBalance: 103560,
    })
    const { title, lines } = buildYearFormula(s, 'yearBalance', {
      isFirstYear: true, initialDeposit: 0, prevYearEndSavings: 0, events: [],
    })
    expect(title).toBe('2026 - 年度结余')
    expect(lines).toEqual(['年度结余 = 工资(120,000) - 育儿(18,000) + 理财收益(1,560) = 103,560'])
  })

  it('endSavings：年初 + 年度结余', () => {
    const s = makeSummary({ startSavings: 50000, yearBalance: 103560, endSavings: 153560 })
    const { lines } = buildYearFormula(s, 'endSavings', {
      isFirstYear: true, initialDeposit: 0, prevYearEndSavings: 0, events: [],
    })
    expect(lines).toEqual(['年末存款 = 年初存款(50,000) + 年度结余(103,560) = 153,560'])
  })

  it('events：各事件带正负展开', () => {
    const s = makeSummary({ year: 2026 })
    const { title, lines } = buildYearFormula(s, 'events', {
      isFirstYear: true, initialDeposit: 0, prevYearEndSavings: 0,
      events: [
        { name: '买房', amount: -500000 },
        { name: '卖房', amount: 300000 },
      ],
    })
    expect(title).toBe('2026 - 专项')
    expect(lines).toEqual(['专项 = -买房(500,000) + 卖房(300,000) = -200,000'])
  })
})
