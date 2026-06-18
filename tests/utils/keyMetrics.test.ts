import { describe, it, expect } from 'vitest'
import { computeKeyMetrics } from '../../src/utils/keyMetrics'
import type { MonthResult } from '../../src/types'

// 构造最小 MonthResult（只填聚合用到的字段，其余置 0/false）
function mk(month: number, over: Partial<MonthResult> = {}): MonthResult {
  return {
    month,
    columnValues: [], totalFlow: 0, investReturn: 0,
    monthlyIncome: 0, monthlyExpense: 0, monthlyBalance: 0, cumSavings: 0,
    isAnchor: false, fundBalance: 0, fundInterest: 0, fundContribution: 0,
    fundOffset: 0, fundOffsetShortfall: 0, fundWithdrawal: 0, fundOutflow: 0,
    isFundAnchor: false, totalAssets: 0,
    ...over,
  }
}

describe('computeKeyMetrics', () => {
  it('最终累计 = 末月 cumSavings', () => {
    const r = [mk(202601, { cumSavings: 100 }), mk(202602, { cumSavings: 250 })]
    expect(computeKeyMetrics(r, false).finalCum).toBe(250)
  })

  it('期间最低余额取最小 cumSavings 及其月份', () => {
    const r = [
      mk(202601, { cumSavings: 500 }),
      mk(202604, { cumSavings: 300 }),
      mk(202606, { cumSavings: 400 }),
    ]
    const m = computeKeyMetrics(r, false)
    expect(m.minCum).toBe(300)
    expect(m.minMonth).toBe(202604)
  })

  it('累计理财收益 = investReturn 求和', () => {
    const r = [mk(202601, { investReturn: 100 }), mk(202602, { investReturn: 50.5 })]
    expect(computeKeyMetrics(r, false).totalReturn).toBe(150.5)
  })

  it('累计总支出 = monthlyExpense 求和（正值金额）', () => {
    const r = [mk(202601, { monthlyExpense: 14000 }), mk(202602, { monthlyExpense: 14500 })]
    expect(computeKeyMetrics(r, false).totalExpense).toBe(28500)
  })

  it('空结果返回 0 且不抛错', () => {
    const m = computeKeyMetrics([], false)
    expect(m.finalCum).toBe(0)
    expect(m.minMonth).toBe(0)
  })

  it('fundEnabled 时返回末月公积金余额，否则为 null', () => {
    const r = [mk(202601, { fundBalance: 1000 }), mk(202602, { fundBalance: 2000 })]
    expect(computeKeyMetrics(r, true).fundBalance).toBe(2000)
    expect(computeKeyMetrics(r, false).fundBalance).toBeNull()
  })
})
