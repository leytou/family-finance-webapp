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
    isCorrected: false,
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

  it('monthlyBalance：结余 = 收入 − 支出', () => {
    const r = makeResult({
      monthlyIncome: 11000,
      monthlyExpense: 4500,
      monthlyBalance: 6500,
    })
    const { title, lines } = buildMonthFormula(r, 'monthlyBalance', { annualRate: 0.03, prevCum: 0 })
    expect(title).toBe('2026-01 - 结余')
    expect(lines).toEqual(['结余 = 收入(11,000) - 支出(4,500) = 6,500'])
  })

  it('investReturn：用 prevCum 与年利率展开，带结果', () => {
    const r = makeResult({ investReturn: 125 })
    const { lines } = buildMonthFormula(r, 'investReturn', { annualRate: 0.03, prevCum: 50000 })
    expect(lines).toEqual(['理财 = 上月存款(50,000) × 3% ÷ 12 = 125'])
  })

  it('cumSavings：非修正月展开上月存款+当月结余', () => {
    const r = makeResult({ monthlyBalance: 6625, cumSavings: 56625, isCorrected: false })
    const { lines } = buildMonthFormula(r, 'cumSavings', { annualRate: 0.03, prevCum: 50000 })
    expect(lines).toEqual(['存款 = 上月存款(50,000) + 当月结余(6,625) = 56,625'])
  })

  it('cumSavings：修正月显示修正值', () => {
    const r = makeResult({ cumSavings: 108125, isCorrected: true })
    const { lines } = buildMonthFormula(r, 'cumSavings', { annualRate: 0.03, prevCum: 50000 })
    expect(lines).toEqual(['存款 = 修正值(108,125)'])
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

  it('monthlyIncome：含理财收益与公积金提取', () => {
    const r = makeResult({
      columnValues: [{ id: 'c1', name: '月薪', amount: 10000, isEdited: true }],
      investReturn: 125,
      fundWithdrawal: 1000,
      monthlyIncome: 11125,
    })
    const { lines } = buildMonthFormula(r, 'monthlyIncome', { annualRate: 0.03, prevCum: 0 })
    expect(lines).toEqual(['收入 = 月薪(10,000) + 理财(125) + 公积金提取(1,000) = 11,125'])
  })

  it('monthlyExpense：房贷以存款补扣计入（非全额）', () => {
    const r = makeResult({
      columnValues: [{ id: 'c1', name: '日常', amount: -1500, isEdited: true }],
      fundOffsetShortfall: 3000,
      monthlyExpense: 4500,
    })
    const { lines } = buildMonthFormula(r, 'monthlyExpense', { annualRate: 0.03, prevCum: 0 })
    expect(lines).toEqual(['支出 = 日常(1,500) + 存款补扣(3,000) = 4,500'])
  })
})

function makeSummary(overrides: Partial<YearSummary> = {}): YearSummary {
  return {
    year: 2026,
    startSavings: 0,
    columnSummaries: [],
    totalFlow: 0,
    investReturn: 0,
    yearIncome: 0,
    yearExpense: 0,
    yearBalance: 0,
    endSavings: 0,
    ...overrides,
  }
}

describe('buildYearFormula', () => {
  it('startSavings：首年显示初始存款', () => {
    const s = makeSummary({ year: 2026, startSavings: 50000 })
    const { title, lines } = buildYearFormula(s, 'startSavings', {
      isFirstYear: true, firstMonthIsCorrected: false, initialDeposit: 50000, prevYearEndSavings: 0, events: [],
    })
    expect(title).toBe('2026 - 年初存款')
    expect(lines).toEqual(['年初存款 = 初始存款(50,000)'])
  })

  it('startSavings：首年首月修正显示修正值', () => {
    const s = makeSummary({ year: 2026, startSavings: 150000 })
    const { lines } = buildYearFormula(s, 'startSavings', {
      isFirstYear: true, firstMonthIsCorrected: true, initialDeposit: 0, prevYearEndSavings: 0, events: [],
    })
    expect(lines).toEqual(['年初存款 = 修正值(150,000)'])
  })

  it('startSavings：非首年显示上年年末存款', () => {
    const s = makeSummary({ year: 2027, startSavings: 120000 })
    const { lines } = buildYearFormula(s, 'startSavings', {
      isFirstYear: false, firstMonthIsCorrected: false, initialDeposit: 50000, prevYearEndSavings: 120000, events: [],
    })
    expect(lines).toEqual(['年初存款 = 上年年末存款(120,000)'])
  })

  it('investReturn：全年合计', () => {
    const s = makeSummary({ investReturn: 1560 })
    const { lines } = buildYearFormula(s, 'investReturn', {
      isFirstYear: true, firstMonthIsCorrected: false, initialDeposit: 0, prevYearEndSavings: 0, events: [],
    })
    expect(lines).toEqual(['理财收益 = 全年各月理财收益合计 = 1,560'])
  })

  it('yearBalance：年度结余 = 年收入 − 年支出', () => {
    const s = makeSummary({
      year: 2026,
      yearIncome: 121560,
      yearExpense: 18000,
      yearBalance: 103560,
    })
    const { title, lines } = buildYearFormula(s, 'yearBalance', {
      isFirstYear: true, firstMonthIsCorrected: false, initialDeposit: 0, prevYearEndSavings: 0, events: [],
    })
    expect(title).toBe('2026 - 年度结余')
    expect(lines).toEqual(['年度结余 = 年收入(121,560) - 年支出(18,000) = 103,560'])
  })

  it('endSavings：年初 + 年度结余', () => {
    const s = makeSummary({ startSavings: 50000, yearBalance: 103560, endSavings: 153560 })
    const { lines } = buildYearFormula(s, 'endSavings', {
      isFirstYear: true, firstMonthIsCorrected: false, initialDeposit: 0, prevYearEndSavings: 0, events: [],
    })
    expect(lines).toEqual(['年末存款 = 年初存款(50,000) + 年度结余(103,560) = 153,560'])
  })

  it('events：各事件带正负展开', () => {
    const s = makeSummary({ year: 2026 })
    const { title, lines } = buildYearFormula(s, 'events', {
      isFirstYear: true, firstMonthIsCorrected: false, initialDeposit: 0, prevYearEndSavings: 0,
      events: [
        { name: '买房', amount: -500000 },
        { name: '卖房', amount: 300000 },
      ],
    })
    expect(title).toBe('2026 - 专项')
    expect(lines).toEqual(['专项 = -买房(500,000) + 卖房(300,000) = -200,000'])
  })
})

describe('buildMonthFormula · 公积金字段', () => {
  function makeResult(overrides: Partial<MonthResult> = {}): MonthResult {
    return {
      month: 202602, columnValues: [], totalFlow: 0, investReturn: 0,
      monthlyIncome: 0, monthlyExpense: 0, monthlyBalance: 0, cumSavings: 5000,
      isCorrected: false,
      fundBalance: 3000, fundInterest: 0, fundContribution: 2000,
      fundOffset: 1000, fundWithdrawal: 1000, fundOutflow: 2000,
      isFundCorrected: false, totalAssets: 8000,
      ...overrides,
    }
  }

  it('月冲公式（自动联动房贷月供）', () => {
    const r = makeResult({ fundOffset: 5000 })
    const { lines } = buildMonthFormula(r, 'fundOffset', {
      annualRate: 0.03, prevCum: 0,
      prevFundBalance: 0, fundContribution: 0, fundWithdrawal: 0,
      fundOffset: 5000, fundInterest: 0, fundBalance: 0,
      fundRate: 0.015, mortgageAbs: 5000, offsetAutoLinked: true,
    })
    expect(lines[0]).toContain('房贷月供(5,000)')
    expect(lines[0]).toContain('自动联动')
  })

  it('月冲公式（手填覆盖）', () => {
    const r = makeResult({ fundOffset: 3000 })
    const { lines } = buildMonthFormula(r, 'fundOffset', {
      annualRate: 0.03, prevCum: 0,
      prevFundBalance: 0, fundContribution: 0, fundWithdrawal: 0,
      fundOffset: 3000, fundInterest: 0, fundBalance: 0,
      fundRate: 0.015, mortgageAbs: 5000, offsetAutoLinked: false,
    })
    expect(lines[0]).toContain('手填值(3,000)')
  })

  it('公积金余额公式', () => {
    const r = makeResult({ month: 202602, fundBalance: 2000 })
    const { lines } = buildMonthFormula(r, 'fundBalance', {
      annualRate: 0.03, prevCum: 0,
      prevFundBalance: 2000, fundContribution: 2000, fundWithdrawal: 1000,
      fundOffset: 1000, fundInterest: 0, fundBalance: 2000,
      fundRate: 0.015, mortgageAbs: 0, offsetAutoLinked: false,
    })
    expect(lines[0]).toContain('上月余额(2,000)')
    expect(lines[0]).toContain('缴存(2,000)')
    expect(lines[0]).toContain('提取(1,000)')
    expect(lines[0]).toContain('月冲(1,000)')
    expect(lines[0]).toContain('= 2,000')
  })

  it('结息公式（结息月）', () => {
    const r = makeResult({ fundInterest: 2800 })
    const { lines } = buildMonthFormula(r, 'fundInterest', {
      annualRate: 0.03, prevCum: 0, fundRate: 0.015,
    })
    expect(lines[0]).toContain('应计利息(2,800)')
    expect(lines[0]).toContain('1.5%')
  })
})

describe('buildYearFormula · 公积金字段', () => {
  it('年末公积金公式', () => {
    const summary: YearSummary = {
      year: 2026, startSavings: 0, columnSummaries: [], totalFlow: 0,
      investReturn: 0, yearBalance: 0, endSavings: 5000,
    }
    const { lines } = buildYearFormula(summary, 'fundBalance', {
      isFirstYear: true, firstMonthIsCorrected: false, initialDeposit: 0,
      prevYearEndSavings: 0, events: [],
    } as any)
    expect(lines[0]).toContain('年末公积金')
  })
})
