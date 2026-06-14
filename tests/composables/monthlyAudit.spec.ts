import { describe, expect, it } from 'vitest'
import { calculate, resolveColumnValue, hasColumnValue, resolveFundOffset } from '../../src/composables/useCalculation'
import { buildMonthFormula, type MonthFormulaContext } from '../../src/utils/formula'
import type { PlanData } from '../../src/types'
import plan from '../fixtures/audit-plan.json'

const planData = plan as PlanData

/** 解析千分位金额字符串（含负号）为数字 */
function parseAmount(s: string): number {
  return Number(s.replace(/,/g, ''))
}

/** 提取公式中所有括号内金额（展开项），不含等号右边最终值 */
function bracketAmounts(line: string): number[] {
  return [...line.matchAll(/\((-?[\d,]+)\)/g)].map(m => parseAmount(m[1]))
}

/** 提取等号右边的最终结果值 */
function finalAmount(line: string): number {
  return parseAmount(line.match(/= (-?[\d,]+)$/)![1])
}

describe('真实数据：月度计算不变量审计', () => {
  const results = calculate(planData)
  const sp = planData.systemParams

  it('每月数值不变量全部成立（理财/结余/存款/总资产/收支/公积金链）', () => {
    const violations: string[] = []
    const approx = (a: number, b: number, m: string, month: number) => {
      if (Math.abs(a - b) > 0.01) violations.push(`${month}: ${m} → 算出 ${a.toFixed(2)}，应为 ${b.toFixed(2)}`)
    }
    results.forEach((r, i) => {
      const prevCum = i === 0 ? (sp.initialDeposit ?? 0) : results[i - 1].cumSavings
      const prevFund = i === 0 ? (sp.fundInitialBalance ?? 0) : results[i - 1].fundBalance

      approx(r.investReturn, (prevCum * sp.annualRate) / 12, '理财收益', r.month)
      approx(r.monthlyBalance, r.totalFlow + r.investReturn + r.fundOutflow, '本月结余', r.month)
      if (!r.isAnchor) approx(r.cumSavings, prevCum + r.monthlyBalance, '月末存款', r.month)
      approx(r.totalAssets, r.cumSavings + r.fundBalance, '总资产', r.month)
      approx(r.monthlyIncome - r.monthlyExpense, r.monthlyBalance, '收入-支出=结余', r.month)
      approx(r.fundOutflow, r.fundWithdrawal + r.fundOffset, '公积金转出=提取+月冲', r.month)
      approx(r.fundBalance, prevFund + r.fundContribution - r.fundWithdrawal - r.fundOffset + r.fundInterest, '公积金余额链', r.month)
    })
    expect(violations, violations.join('\n')).toEqual([])
  })

  it('结余 hover 公式：收入 − 支出 必须等于结余', () => {
    const violations: string[] = []
    results.forEach((r, i) => {
      const prevCum = i === 0 ? (sp.initialDeposit ?? 0) : results[i - 1].cumSavings
      const { lines } = buildMonthFormula(r, 'monthlyBalance', {
        annualRate: sp.annualRate, prevCum,
      })
      const line = lines[0]
      const income = parseAmount(line.match(/收入\((-?[\d,]+)\)/)![1])
      const expense = parseAmount(line.match(/支出\((-?[\d,]+)\)/)![1])
      const result = finalAmount(line)
      if (Math.abs(income - expense - result) > 1) {
        violations.push(`${r.month}: 收入(${income})-支出(${expense})=${income - expense} ≠ 结余显示 ${result}`)
      }
    })
    expect(violations, violations.join('\n')).toEqual([])
  })

  it('支出 hover 公式：展开项之和必须等于支出（含房贷月供）', () => {
    const violations: string[] = []
    results.forEach((r, i) => {
      const prevCum = i === 0 ? (sp.initialDeposit ?? 0) : results[i - 1].cumSavings
      const mortgageAbs = planData.fund ? Math.abs(resolveColumnValue(planData.fund.mortgage, r.month).amount) : 0
      const { lines } = buildMonthFormula(r, 'monthlyExpense', { annualRate: sp.annualRate, prevCum, mortgageAbs })
      const line = lines[0]
      // 无展开项（"支出 = X"）时跳过——无法从公式读出构成
      if (!line.includes('(')) return
      const sum = bracketAmounts(line).reduce((a, b) => a + b, 0)
      const result = finalAmount(line)
      if (Math.abs(sum - result) > 1) {
        violations.push(`${r.month}: 支出展开项和=${sum} ≠ 支出显示 ${result}（差 ${result - sum}；当月房贷月供=${planData.fund ? Math.abs(resolveColumnValue(planData.fund.mortgage, r.month).amount) : 0}）`)
      }
    })
    expect(violations, violations.join('\n')).toEqual([])
  })

  it('收入 hover 公式：展开项之和必须等于收入', () => {
    const violations: string[] = []
    results.forEach((r, i) => {
      const prevCum = i === 0 ? (sp.initialDeposit ?? 0) : results[i - 1].cumSavings
      const mortgageAbs = planData.fund ? Math.abs(resolveColumnValue(planData.fund.mortgage, r.month).amount) : 0
      const { lines } = buildMonthFormula(r, 'monthlyIncome', { annualRate: sp.annualRate, prevCum, mortgageAbs })
      const line = lines[0]
      if (!line.includes('(')) return
      const sum = bracketAmounts(line).reduce((a, b) => a + b, 0)
      const result = finalAmount(line)
      if (Math.abs(sum - result) > 1) {
        violations.push(`${r.month}: 收入展开项和=${sum} ≠ 收入显示 ${result}`)
      }
    })
    expect(violations, violations.join('\n')).toEqual([])
  })

  it('月冲 hover 公式：实际冲额正确，余额不足被截断时说明', () => {
    const violations: string[] = []
    results.forEach((r, i) => {
      const prevCum = i === 0 ? (sp.initialDeposit ?? 0) : results[i - 1].cumSavings
      const prevFund = i === 0 ? (sp.fundInitialBalance ?? 0) : results[i - 1].fundBalance
      const mortgageAbs = planData.fund ? Math.abs(resolveColumnValue(planData.fund.mortgage, r.month).amount) : 0
      const offsetAutoLinked = planData.fund ? !hasColumnValue(planData.fund.monthlyOffset, r.month) : false
      const target = planData.fund ? resolveFundOffset(planData.fund, r.month) : 0
      const ctx: MonthFormulaContext = {
        annualRate: sp.annualRate, prevCum, prevFundBalance: prevFund,
        fundContribution: r.fundContribution, fundWithdrawal: r.fundWithdrawal,
        fundOffset: r.fundOffset, fundInterest: r.fundInterest, fundBalance: r.fundBalance,
        fundRate: sp.fundRate, mortgageAbs, offsetAutoLinked, fundOffsetTarget: target,
      }
      const { lines } = buildMonthFormula(r, 'fundOffset', ctx)
      const line = lines[0]
      // 公式右值（实际冲额）必须等于 result.fundOffset
      const actual = finalAmount(line)
      if (Math.abs(actual - Math.round(r.fundOffset)) > 1) {
        violations.push(`${r.month}: 月冲公式实际冲额 ${actual} ≠ 显示 ${Math.round(r.fundOffset)}`)
      }
      // 被余额截断（目标 > 实际）时，公式必须说明"余额不足"
      if (target > r.fundOffset + 1 && !line.includes('余额不足')) {
        violations.push(`${r.month}: 月冲目标 ${target} > 实际 ${r.fundOffset}（被截断），公式未说明余额不足`)
      }
    })
    expect(violations, violations.join('\n')).toEqual([])
  })

  it('存款补扣 hover 公式：房贷月供 − 月冲 必须等于存款补扣', () => {
    const violations: string[] = []
    results.forEach((r, i) => {
      const prevCum = i === 0 ? (sp.initialDeposit ?? 0) : results[i - 1].cumSavings
      const mortgageAbs = planData.fund ? Math.abs(resolveColumnValue(planData.fund.mortgage, r.month).amount) : 0
      const { lines } = buildMonthFormula(r, 'fundOffsetShortfall', {
        annualRate: sp.annualRate, prevCum, mortgageAbs, fundOffset: r.fundOffset,
      })
      const line = lines[0]
      const mort = parseAmount(line.match(/房贷月供\((-?[\d,]+)\)/)![1])
      const offset = parseAmount(line.match(/公积金月冲\((-?[\d,]+)\)/)![1])
      const result = finalAmount(line)
      if (Math.abs(mort - offset - result) > 1) {
        violations.push(`${r.month}: 房贷(${mort})-月冲(${offset})=${mort - offset} ≠ 存款补扣 ${result}`)
      }
    })
    expect(violations, violations.join('\n')).toEqual([])
  })

  it('公积金余额 hover 公式：上月+缴存−提取−月冲+结息 必须等于余额', () => {
    const violations: string[] = []
    results.forEach((r, i) => {
      const prevCum = i === 0 ? (sp.initialDeposit ?? 0) : results[i - 1].cumSavings
      const prevFund = i === 0 ? (sp.fundInitialBalance ?? 0) : results[i - 1].fundBalance
      const ctx: MonthFormulaContext = {
        annualRate: sp.annualRate, prevCum, prevFundBalance: prevFund,
        fundContribution: r.fundContribution, fundWithdrawal: r.fundWithdrawal,
        fundOffset: r.fundOffset, fundInterest: r.fundInterest, fundBalance: r.fundBalance,
        fundRate: sp.fundRate,
      }
      const { lines } = buildMonthFormula(r, 'fundBalance', ctx)
      const line = lines[0]
      const prev = parseAmount(line.match(/上月余额\((-?[\d,]+)\)/)![1])
      const contrib = parseAmount(line.match(/缴存\((-?[\d,]+)\)/)![1])
      const wd = parseAmount(line.match(/提取\((-?[\d,]+)\)/)![1])
      const offset = parseAmount(line.match(/月冲\((-?[\d,]+)\)/)![1])
      const interest = parseAmount(line.match(/结息\((-?[\d,]+)\)/)![1])
      const result = finalAmount(line)
      const lhs = prev + contrib - wd - offset + interest
      if (Math.abs(lhs - result) > 1) {
        violations.push(`${r.month}: 公积金公式左边=${lhs} ≠ 余额 ${result}`)
      }
    })
    expect(violations, violations.join('\n')).toEqual([])
  })
})
